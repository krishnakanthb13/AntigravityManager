import { Injectable, Logger, Inject } from '@nestjs/common';
import { isEmpty, isNil } from 'lodash-es';
import { TokenManagerService } from './token-manager.service';
import { GeminiClient } from './clients/gemini.client';
import { v4 as uuidv4 } from 'uuid';
import { Observable } from 'rxjs';
import { transformClaudeRequestIn } from '../../../lib/antigravity/ClaudeRequestMapper';
import { transformResponse } from '../../../lib/antigravity/ClaudeResponseMapper';
import { StreamingState, PartProcessor } from '../../../lib/antigravity/ClaudeStreamingMapper';
import {
  ClaudeRequest,
  ClaudeResponse,
  GeminiInternalRequest,
  GeminiPart as InternalGeminiPart,
} from '../../../lib/antigravity/types';
import { calculateRetryDelay, sleep } from '../../../lib/antigravity/retry-utils';
import {
  classifyStreamError,
  formatErrorForSSE,
} from '../../../lib/antigravity/stream-error-utils';
import {
  OpenAIChatRequest,
  AnthropicChatRequest,
  GeminiResponse,
  GeminiRequest,
  AnthropicChatResponse,
  OpenAIChatResponse,
  AnthropicContent,
} from './interfaces/request-interfaces';
import { getServerConfig } from '../../server-config';
import { resolveModelRoute } from '../../../lib/antigravity/ModelMapping';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly defaultRequestUserAgent = 'antigravity/1.11.9 windows/amd64';

  constructor(
    @Inject(TokenManagerService) private readonly tokenManager: TokenManagerService,
    @Inject(GeminiClient) private readonly geminiClient: GeminiClient,
  ) {}

  // --- Anthropic Handlers ---

  async handleAnthropicMessages(
    request: AnthropicChatRequest,
  ): Promise<AnthropicChatResponse | Observable<string>> {
    const sessionKey = this.getSessionKeyFromAnthropic(request);

    const targetModel = this.mapModel(request.model);
    const extraHeaders = this.buildModelSpecificHeaders(request.model);
    this.logger.log(
      `Received Anthropic request for model: ${request.model} (Mapped: ${targetModel}, Stream: ${request.stream})`,
    );

    // Retry loop
    let lastError: unknown = null;
    const maxRetries = 3;
    const attemptedAccountIds = new Set<string>();

    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) {
        const delay = calculateRetryDelay(i - 1);
        this.logger.log(`Retry attempt ${i + 1}/${maxRetries}, waiting ${delay}ms (jittered)`);
        await sleep(delay);
      }

      const token = await this.tokenManager.getNextToken({
        sessionKey,
        excludeAccountIds: Array.from(attemptedAccountIds),
      });
      if (!token) {
        throw new Error('No available accounts');
      }
      attemptedAccountIds.add(token.id);

      try {
        const projectId = token.token.project_id ?? '';
        const geminiBody = transformClaudeRequestIn(this.toClaudeRequest(request), projectId);

        if (request.stream) {
          const stream = await this.geminiClient.streamGenerateInternal(
            geminiBody,
            token.token.access_token,
            token.token.upstream_proxy_url,
            extraHeaders,
          );
          return this.processAnthropicInternalStream(stream, geminiBody.model);
        } else {
          const response = await this.generateInternalWithStreamFallback(
            geminiBody,
            token.token.access_token,
            token.token.upstream_proxy_url,
            extraHeaders,
          );
          return this.toAnthropicChatResponse(transformResponse(response));
        }
      } catch (error) {
        if (error instanceof Error && this.isProjectContextError(error.message)) {
          this.logger.warn(
            `Anthropic request hit project context issue, retrying without project: ${error.message}`,
          );
          try {
            const fallbackBody = transformClaudeRequestIn(this.toClaudeRequest(request), '');
            if (request.stream) {
              const stream = await this.geminiClient.streamGenerateInternal(
                fallbackBody,
                token.token.access_token,
                token.token.upstream_proxy_url,
                extraHeaders,
              );
              return this.processAnthropicInternalStream(stream, fallbackBody.model);
            } else {
              const response = await this.generateInternalWithStreamFallback(
                fallbackBody,
                token.token.access_token,
                token.token.upstream_proxy_url,
                extraHeaders,
              );
              return this.toAnthropicChatResponse(transformResponse(response));
            }
          } catch (fallbackErr) {
            lastError = fallbackErr;
          }
        }

        if (error instanceof Error && this.isQuotaExhaustedError(error.message)) {
          this.logger.warn(
            `Anthropic request hit quota exhaustion on mapped model, retrying with fallback model gemini-2.5-flash: ${error.message}`,
          );
          try {
            const downgradedRequest: ClaudeRequest = {
              ...this.toClaudeRequest(request),
              model: 'gemini-2.5-flash',
            };
            const downgradedBody = transformClaudeRequestIn(
              downgradedRequest,
              token.token.project_id ?? '',
            );
            if (request.stream) {
              const stream = await this.geminiClient.streamGenerateInternal(
                downgradedBody,
                token.token.access_token,
                token.token.upstream_proxy_url,
                extraHeaders,
              );
              return this.processAnthropicInternalStream(stream, downgradedBody.model);
            } else {
              const response = await this.generateInternalWithStreamFallback(
                downgradedBody,
                token.token.access_token,
                token.token.upstream_proxy_url,
                extraHeaders,
              );
              const transformed = this.toAnthropicChatResponse(transformResponse(response));
              return {
                ...transformed,
                model: request.model,
              };
            }
          } catch (downgradeErr) {
            lastError = downgradeErr;
          }
        }

        lastError = error;
        if (error instanceof Error) {
          this.logger.warn(`Anthropic Request failed: ${error.message}`);
          const decision = this.classifyUpstreamError(error.message);
          if (decision.retry) {
            if (decision.markAsForbidden) {
              this.tokenManager.markAsForbidden(token.id);
            } else if (decision.markAsRateLimited) {
              this.tokenManager.markAsRateLimited(token.id);
            }
          }
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  private processAnthropicInternalStream(
    upstreamStream: NodeJS.ReadableStream,
    model: string,
  ): Observable<string> {
    return new Observable<string>((subscriber) => {
      const decoder = new TextDecoder();
      let buffer = '';

      const state = new StreamingState();
      const processor = new PartProcessor(state);

      let lastFinishReason: string | undefined;
      let lastUsageMetadata: Record<string, unknown> | undefined;

      let receivedData = false;

      upstreamStream.on('data', (chunk: Buffer) => {
        receivedData = true; // Mark that we got data
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);

            if (json) {
              const startMsg = state.emitMessageStart(json);
              if (startMsg) subscriber.next(startMsg);
            }

            const candidate = json.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (candidate?.finishReason) {
              lastFinishReason = candidate.finishReason;
            }
            if (json.usageMetadata) {
              lastUsageMetadata = json.usageMetadata;
            }

            if (this.isGeminiPart(part)) {
              const chunks = processor.process(part);
              chunks.forEach((c) => subscriber.next(c));
            }

            // Reset error state on successful parse
            state.resetErrorState();
          } catch (e) {
            this.logger.error('Stream parse error', e);
            const errorChunks = state.handleParseError(dataStr);
            errorChunks.forEach((c) => subscriber.next(c));
          }
        }
      });

      upstreamStream.on('end', () => {
        if (!receivedData) {
          this.logger.warn('Empty response stream detected');
          subscriber.error(new Error('Empty response stream'));
          return;
        }

        const finishChunks = state.emitFinish(lastFinishReason, lastUsageMetadata);
        finishChunks.forEach((c) => subscriber.next(c));
        subscriber.complete();
      });

      upstreamStream.on('error', (err: unknown) => {
        const cleanError = err instanceof Error ? err : new Error(String(err));
        const { type, message } = classifyStreamError(cleanError);

        this.logger.error(`Stream error: ${type} - ${cleanError.message}`);

        // Send SSE error event before closing
        subscriber.next(formatErrorForSSE(type, message));
        subscriber.error(cleanError);
      });
    });
  }

  // --- OpenAI / Universal Handlers ---
  async handleGeminiGenerateContent(
    model: string,
    request: GeminiRequest,
  ): Promise<GeminiResponse> {
    const normalizedModel = this.normalizeGeminiModel(model);
    const targetModel = this.mapModel(normalizedModel);
    const extraHeaders = this.buildModelSpecificHeaders(normalizedModel);
    this.logger.log(
      `Received Gemini request for model: ${normalizedModel} (Mapped: ${targetModel})`,
    );

    let lastError: unknown = null;
    const maxRetries = 3;
    const attemptedAccountIds = new Set<string>();

    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) {
        const delay = calculateRetryDelay(i - 1);
        this.logger.log(`Gemini retry attempt ${i + 1}/${maxRetries}, waiting ${delay}ms`);
        await sleep(delay);
      }

      const token = await this.tokenManager.getNextToken({
        excludeAccountIds: Array.from(attemptedAccountIds),
      });
      if (!token) {
        throw new Error('No available accounts (all exhausted or rate limited)');
      }
      attemptedAccountIds.add(token.id);

      try {
        const internalBody = this.createGeminiInternalRequest(
          targetModel,
          request,
          token.token.project_id ?? '',
          'generate-content',
        );

        const response = await this.generateInternalWithStreamFallback(
          internalBody,
          token.token.access_token,
          token.token.upstream_proxy_url,
          extraHeaders,
        );

        return this.normalizeGeminiGenerateResponse(response);
      } catch (err) {
        if (err instanceof Error && this.isProjectContextError(err.message)) {
          this.logger.warn(
            `Gemini request hit project context issue, retrying without project: ${err.message}`,
          );
          try {
            const fallbackBody = this.createGeminiInternalRequest(
              targetModel,
              request,
              '',
              'generate-content',
            );
            const response = await this.generateInternalWithStreamFallback(
              fallbackBody,
              token.token.access_token,
              token.token.upstream_proxy_url,
              extraHeaders,
            );
            return this.normalizeGeminiGenerateResponse(response);
          } catch (fallbackErr) {
            lastError = fallbackErr;
          }
        } else {
          lastError = err;
        }

        if (lastError instanceof Error) {
          this.logger.warn(`Gemini request failed with account ${token.email}: ${lastError.message}`);
          const decision = this.classifyUpstreamError(lastError.message);
          if (decision.retry) {
            if (decision.markAsForbidden) {
              this.tokenManager.markAsForbidden(token.id);
            } else if (decision.markAsRateLimited) {
              this.tokenManager.markAsRateLimited(token.id);
            }
          }
        }
      }
    }

    throw lastError || new Error('Gemini request failed after retries');
  }

  async handleGeminiStreamGenerateContent(
    model: string,
    request: GeminiRequest,
  ): Promise<Observable<string>> {
    const normalizedModel = this.normalizeGeminiModel(model);
    const targetModel = this.mapModel(normalizedModel);
    const extraHeaders = this.buildModelSpecificHeaders(normalizedModel);
    this.logger.log(
      `Received Gemini stream request for model: ${normalizedModel} (Mapped: ${targetModel})`,
    );

    let lastError: unknown = null;
    const maxRetries = 3;
    const attemptedAccountIds = new Set<string>();

    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) {
        const delay = calculateRetryDelay(i - 1);
        this.logger.log(`Gemini stream retry attempt ${i + 1}/${maxRetries}, waiting ${delay}ms`);
        await sleep(delay);
      }

      const token = await this.tokenManager.getNextToken({
        excludeAccountIds: Array.from(attemptedAccountIds),
      });
      if (!token) {
        throw new Error('No available accounts (all exhausted or rate limited)');
      }
      attemptedAccountIds.add(token.id);

      try {
        const internalBody = this.createGeminiInternalRequest(
          targetModel,
          request,
          token.token.project_id ?? '',
          'generate-content',
        );

        const stream = await this.geminiClient.streamGenerateInternal(
          internalBody,
          token.token.access_token,
          token.token.upstream_proxy_url,
          extraHeaders,
        );
        return this.passthroughSseStream(stream);
      } catch (err) {
        if (err instanceof Error && this.isProjectContextError(err.message)) {
          this.logger.warn(
            `Gemini stream request hit project context issue, retrying without project: ${err.message}`,
          );
          try {
            const fallbackBody = this.createGeminiInternalRequest(
              targetModel,
              request,
              '',
              'generate-content',
            );
            const stream = await this.geminiClient.streamGenerateInternal(
              fallbackBody,
              token.token.access_token,
              token.token.upstream_proxy_url,
              extraHeaders,
            );
            return this.passthroughSseStream(stream);
          } catch (fallbackErr) {
            lastError = fallbackErr;
          }
        } else {
          lastError = err;
        }

        if (lastError instanceof Error) {
          this.logger.warn(
            `Gemini stream request failed with account ${token.email}: ${lastError.message}`,
          );
          const decision = this.classifyUpstreamError(lastError.message);
          if (decision.retry) {
            if (decision.markAsForbidden) {
              this.tokenManager.markAsForbidden(token.id);
            } else if (decision.markAsRateLimited) {
              this.tokenManager.markAsRateLimited(token.id);
            }
          }
        }
      }
    }

    throw lastError || new Error('Gemini stream request failed after retries');
  }

  private passthroughSseStream(upstreamStream: NodeJS.ReadableStream): Observable<string> {
    return new Observable<string>((subscriber) => {
      const decoder = new TextDecoder();
      let receivedData = false;

      upstreamStream.on('data', (chunk: Buffer) => {
        receivedData = true;
        subscriber.next(decoder.decode(chunk, { stream: true }));
      });

      upstreamStream.on('end', () => {
        if (!receivedData) {
          subscriber.error(new Error('Empty response stream'));
          return;
        }
        subscriber.complete();
      });

      upstreamStream.on('error', (err: unknown) => {
        const cleanError = err instanceof Error ? new Error(err.message) : new Error(String(err));
        subscriber.error(cleanError);
      });
    });
  }

  private normalizeGeminiModel(model: string): string {
    return model.replace(/^models\//i, '');
  }

  private createGeminiInternalRequest(
    model: string,
    request: GeminiRequest,
    projectId: string | undefined,
    requestType: string,
  ): GeminiInternalRequest {
    const normalizedProjectId = projectId?.trim();

    const internalRequest: GeminiInternalRequest = {
      requestId: uuidv4(),
      request: this.toInternalGeminiRequest(request),
      model,
      userAgent: process.env.PROXY_REQUEST_USER_AGENT ?? this.defaultRequestUserAgent,
      requestType,
    };

    if (normalizedProjectId) {
      internalRequest.project = normalizedProjectId;
    }

    return internalRequest;
  }

  private normalizeGeminiGenerateResponse(response: GeminiResponse): GeminiResponse {
    const candidates = Array.isArray(response.candidates)
      ? response.candidates.map((candidate, index) => ({
          content: candidate?.content,
          finishReason: candidate?.finishReason,
          index: typeof candidate?.index === 'number' ? candidate.index : index,
        }))
      : [];

    const normalized: GeminiResponse = {
      candidates,
    };

    const usage = response.usageMetadata;
    if (usage) {
      const usageMetadata: NonNullable<GeminiResponse['usageMetadata']> = {};
      if (usage.promptTokenCount !== undefined) {
        usageMetadata.promptTokenCount = usage.promptTokenCount;
      }
      if (usage.candidatesTokenCount !== undefined) {
        usageMetadata.candidatesTokenCount = usage.candidatesTokenCount;
      }
      if (usage.totalTokenCount !== undefined) {
        usageMetadata.totalTokenCount = usage.totalTokenCount;
      }
      if (usage.thoughtsTokenCount !== undefined) {
        usageMetadata.thoughtsTokenCount = usage.thoughtsTokenCount;
      }
      if (usage.promptTokensDetails !== undefined) {
        usageMetadata.promptTokensDetails = usage.promptTokensDetails;
      }
      if (usage.candidatesTokensDetails !== undefined) {
        usageMetadata.candidatesTokensDetails = usage.candidatesTokensDetails;
      }
      if (usage.trafficType !== undefined) {
        usageMetadata.trafficType = usage.trafficType;
      }
      if (!isEmpty(usageMetadata)) {
        normalized.usageMetadata = usageMetadata;
      }
    }

    return normalized;
  }

  async handleChatCompletions(
    request: OpenAIChatRequest,
  ): Promise<OpenAIChatResponse | Observable<string>> {
    const sessionKey = this.getSessionKeyFromOpenAI(request);

    const targetModel = this.mapModel(request.model);
    const extraHeaders = this.buildModelSpecificHeaders(request.model);
    this.logger.log(
      `Received request for model: ${request.model} (Mapped: ${targetModel}, Stream: ${request.stream})`,
    );

    // Retry loop for account selection
    let lastError: unknown = null;
    const maxRetries = 3;
    const attemptedAccountIds = new Set<string>();

    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) {
        const delay = calculateRetryDelay(i - 1);
        this.logger.log(`Retry attempt ${i + 1}/${maxRetries}, waiting ${delay}ms (jittered)`);
        await sleep(delay);
      }

      // 1. Get Token
      const token = await this.tokenManager.getNextToken({
        sessionKey,
        excludeAccountIds: Array.from(attemptedAccountIds),
      });
      if (!token) {
        throw new Error('No available accounts (all exhausted or rate limited)');
      }
      attemptedAccountIds.add(token.id);

      try {
        const claudeRequest = this.convertOpenAIToClaude(request);
        const projectId = token.token.project_id ?? '';
        const geminiBody = transformClaudeRequestIn(claudeRequest, projectId);

        // Use v1internal API (same as Anthropic handler)
        if (request.stream) {
          try {
            const stream = await this.geminiClient.streamGenerateInternal(
              geminiBody,
              token.token.access_token,
              token.token.upstream_proxy_url,
              extraHeaders,
            );
            return this.processStreamResponse(stream, request.model);
          } catch (streamError) {
            this.logger.warn(
              `Stream request failed for ${request.model}, falling back to non-stream generation: ${
                streamError instanceof Error ? streamError.message : String(streamError)
              }`,
            );

            const response = await this.generateInternalWithStreamFallback(
              geminiBody,
              token.token.access_token,
              token.token.upstream_proxy_url,
              extraHeaders,
            );
            this.logger.log(
              `Upstream response snippet (stream fallback): ${JSON.stringify(response).substring(0, 500)}`,
            );
            const claudeResponse = transformResponse(response);
            const openaiResponse = this.convertClaudeToOpenAIResponse(
              claudeResponse,
              request.model,
            );
            return this.createSyntheticOpenAIStream(openaiResponse);
          }
        } else {
          const response = await this.generateInternalWithStreamFallback(
            geminiBody,
            token.token.access_token,
            token.token.upstream_proxy_url,
            extraHeaders,
          );
          this.logger.log(
            `Upstream response snippet: ${JSON.stringify(response).substring(0, 500)}`,
          );
          // Transform Gemini response to OpenAI format
          const claudeResponse = transformResponse(response);
          this.logger.log(`Claude Response: ${JSON.stringify(claudeResponse).substring(0, 500)}`);
          return this.convertClaudeToOpenAIResponse(claudeResponse, request.model);
        }
      } catch (err) {
        if (err instanceof Error && this.isProjectContextError(err.message)) {
          this.logger.warn(
            `OpenAI compatibility request hit project context issue, retrying without project: ${err.message}`,
          );
          try {
            const claudeRequest = this.convertOpenAIToClaude(request);
            const fallbackBody = transformClaudeRequestIn(claudeRequest, '');
            if (request.stream) {
              const stream = await this.geminiClient.streamGenerateInternal(
                fallbackBody,
                token.token.access_token,
                token.token.upstream_proxy_url,
                extraHeaders,
              );
              return this.processStreamResponse(stream, request.model);
            }

            const response = await this.generateInternalWithStreamFallback(
              fallbackBody,
              token.token.access_token,
              token.token.upstream_proxy_url,
              extraHeaders,
            );
            const claudeResponse = transformResponse(response);
            return this.convertClaudeToOpenAIResponse(claudeResponse, request.model);
          } catch (fallbackErr) {
            lastError = fallbackErr;
          }
        } else {
          lastError = err;
        }

        if (lastError instanceof Error) {
          this.logger.warn(`Request failed with account ${token.email}: ${lastError.message}`);

          const decision = this.classifyUpstreamError(lastError.message);
          if (decision.retry) {
            if (decision.markAsForbidden) {
              this.tokenManager.markAsForbidden(token.id);
            } else if (decision.markAsRateLimited) {
              this.tokenManager.markAsRateLimited(token.id);
            }
          }
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  private async generateInternalWithStreamFallback(
    body: GeminiInternalRequest,
    accessToken: string,
    upstreamProxyUrl?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<GeminiResponse> {
    const direct = await this.geminiClient.generateInternal(
      body,
      accessToken,
      upstreamProxyUrl,
      extraHeaders,
    );
    if (this.hasUsableGeminiCandidate(direct)) {
      return direct;
    }

    this.logger.warn('Empty non-stream response detected, falling back to stream aggregation.');
    const stream = await this.geminiClient.streamGenerateInternal(
      body,
      accessToken,
      upstreamProxyUrl,
      extraHeaders,
    );
    return this.collectGeminiStreamAsResponse(stream);
  }

  private hasUsableGeminiCandidate(response: GeminiResponse): boolean {
    const candidates = response?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return false;
    }

    const first = candidates[0];
    const parts = first?.content?.parts;
    return Array.isArray(parts) && parts.length > 0;
  }

  private collectGeminiStreamAsResponse(
    upstreamStream: NodeJS.ReadableStream,
  ): Promise<GeminiResponse> {
    return new Promise((resolve, reject) => {
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedData = false;
      const mergedParts: InternalGeminiPart[] = [];
      let finishReason: string | undefined;
      let usageMetadata: GeminiResponse['usageMetadata'];

      upstreamStream.on('data', (chunk: Buffer) => {
        receivedData = true;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) {
            continue;
          }

          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const candidate = parsed?.candidates?.[0];
            const parts = candidate?.content?.parts;
            if (Array.isArray(parts)) {
              mergedParts.push(
                ...parts.filter((part): part is InternalGeminiPart => this.isGeminiPart(part)),
              );
            }

            if (candidate?.finishReason) {
              finishReason = candidate.finishReason;
            }
            if (parsed?.usageMetadata) {
              usageMetadata = parsed.usageMetadata;
            }
          } catch {
            // Ignore malformed chunks and continue collecting valid parts.
          }
        }
      });

      upstreamStream.on('end', () => {
        if (!receivedData) {
          reject(new Error('Empty response stream'));
          return;
        }

        resolve({
          candidates: [
            {
              content: {
                role: 'model',
                parts: mergedParts,
              },
              finishReason,
            },
          ],
          usageMetadata,
        });
      });

      upstreamStream.on('error', (error: unknown) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  // Handle SSE Stream conversion
  private processStreamResponse(
    upstreamStream: NodeJS.ReadableStream,
    model: string,
  ): Observable<string> {
    return new Observable<string>((subscriber) => {
      const decoder = new TextDecoder();
      let buffer = '';
      let hasEmittedChunk = false;
      let hasSentDone = false;

      const streamId = `chatcmpl-${uuidv4()}`;
      const created = Math.floor(Date.now() / 1000);

      const pushChunk = (payload: Record<string, unknown>): void => {
        hasEmittedChunk = true;
        subscriber.next(`data: ${JSON.stringify(payload)}\n\n`);
      };

      upstreamStream.on('data', (chunk: Buffer) => {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);
            const candidate = json.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            for (const part of parts) {
              if (part.thought && part.text) {
                const reasoningChunk = {
                  id: streamId,
                  object: 'chat.completion.chunk',
                  created: created,
                  model: model,
                  choices: [
                    {
                      index: 0,
                      delta: { reasoning_content: part.text },
                      finish_reason: null,
                    },
                  ],
                };
                pushChunk(reasoningChunk);
                continue;
              }

              if (part.functionCall) {
                const toolCallChunk = {
                  id: streamId,
                  object: 'chat.completion.chunk',
                  created: created,
                  model: model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: part.functionCall.id || `${part.functionCall.name}-${uuidv4()}`,
                            type: 'function',
                            function: {
                              name: part.functionCall.name,
                              arguments: JSON.stringify(part.functionCall.args || {}),
                            },
                          },
                        ],
                      },
                      finish_reason: null,
                    },
                  ],
                };
                pushChunk(toolCallChunk);
                continue;
              }

              if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/jpeg';
                const data = part.inlineData.data || '';
                const imageMarkdown = `\n\n![Generated Image](data:${mimeType};base64,${data})\n\n`;
                const imageChunk = {
                  id: streamId,
                  object: 'chat.completion.chunk',
                  created: created,
                  model: model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: imageMarkdown },
                      finish_reason: null,
                    },
                  ],
                };
                pushChunk(imageChunk);
                continue;
              }

              if (part.text) {
                const contentChunk = {
                  id: streamId,
                  object: 'chat.completion.chunk',
                  created: created,
                  model: model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: part.text },
                      finish_reason: null,
                    },
                  ],
                };
                pushChunk(contentChunk);
              }
            }

            if (candidate?.finishReason) {
              const finishChunk = {
                id: streamId,
                object: 'chat.completion.chunk',
                created: created,
                model: model,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: this.mapGeminiFinishReasonToOpenAIFinishReason(
                      candidate.finishReason,
                    ),
                  },
                ],
              };
              pushChunk(finishChunk);
              subscriber.next('data: [DONE]\n\n');
              hasSentDone = true;
              subscriber.complete();
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      });

      upstreamStream.on('end', () => {
        if (!hasEmittedChunk) {
          pushChunk({
            id: streamId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              {
                index: 0,
                delta: { content: '' },
                finish_reason: null,
              },
            ],
          });
        }
        if (!hasSentDone) {
          subscriber.next('data: [DONE]\n\n');
          hasSentDone = true;
        }
        subscriber.complete();
      });

      upstreamStream.on('error', (err: unknown) => {
        // Convert to clean Error to avoid circular reference issues (socket objects)
        const cleanError = err instanceof Error ? new Error(err.message) : new Error(String(err));
        subscriber.error(cleanError);
      });
    });
  }

  private createSyntheticOpenAIStream(response: OpenAIChatResponse): Observable<string> {
    return new Observable<string>((subscriber) => {
      const streamId = response.id || `chatcmpl-${uuidv4()}`;
      const created = response.created || Math.floor(Date.now() / 1000);
      const model = response.model;
      const choice = response.choices?.[0];
      const finishReason = choice?.finish_reason ?? 'stop';
      const content =
        choice?.message && typeof choice.message.content === 'string' ? choice.message.content : '';
      const chunkSize = 80;

      if (content.length === 0) {
        const finishChunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: finishReason,
            },
          ],
          usage: response.usage,
        };
        subscriber.next(`data: ${JSON.stringify(finishChunk)}\n\n`);
        subscriber.next('data: [DONE]\n\n');
        subscriber.complete();
        return;
      }

      for (let index = 0; index < content.length; index += chunkSize) {
        const piece = content.slice(index, index + chunkSize);
        const isLast = index + chunkSize >= content.length;
        const chunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { content: piece },
              finish_reason: isLast ? finishReason : null,
            },
          ],
          usage: isLast
            ? response.usage
            : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
        subscriber.next(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      subscriber.next('data: [DONE]\n\n');
      subscriber.complete();
    });
  }

  private toClaudeRequest(request: AnthropicChatRequest): ClaudeRequest {
    return {
      model: request.model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      system: request.system,
      tools: request.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
        type: tool.type,
      })),
      stream: request.stream,
      max_tokens: request.max_tokens,
      stop_sequences: request.stop_sequences,
      temperature: request.temperature,
      top_p: request.top_p,
      top_k: request.top_k,
      thinking: request.thinking,
      metadata: request.metadata,
    };
  }

  private toAnthropicChatResponse(response: ClaudeResponse): AnthropicChatResponse {
    return {
      id: response.id,
      type: response.type,
      role: response.role,
      model: response.model,
      content: response.content,
      stop_reason: response.stop_reason,
      stop_sequence: response.stop_sequence,
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        cache_creation_input_tokens: response.usage?.cache_creation_input_tokens,
        cache_read_input_tokens: response.usage?.cache_read_input_tokens,
      },
    };
  }

  private toInternalGeminiRequest(request: GeminiRequest): GeminiInternalRequest['request'] {
    return {
      contents: request.contents,
      generationConfig: request.generationConfig,
      systemInstruction: request.systemInstruction
        ? {
            parts: request.systemInstruction.parts
              .filter((part): part is { text: string } => typeof part.text === 'string')
              .map((part) => ({ text: part.text })),
          }
        : undefined,
    };
  }

  // Convert OpenAI request format to Claude/Anthropic format
  private convertOpenAIToClaude(request: OpenAIChatRequest): ClaudeRequest {
    const messages = request.messages || [];
    const systemPromptParts: string[] = [];
    const anthropicMessages: ClaudeRequest['messages'] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const systemText = this.extractOpenAITextContent(msg.content);
        if (systemText) {
          systemPromptParts.push(systemText);
        }
        continue;
      }

      if (msg.role === 'tool') {
        const toolResultText = this.extractOpenAITextContent(msg.content) || '';
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || msg.name || `tool-result-${uuidv4()}`,
              content: toolResultText,
              is_error: false,
            },
          ],
        });
        continue;
      }

      const contentBlocks = this.convertOpenAIPartsToAnthropicContent(msg.content);

      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: this.parseOpenAIFunctionArguments(toolCall.function.arguments),
          });
        }
      }

      anthropicMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: contentBlocks.length > 0 ? contentBlocks : '',
      });
    }

    const systemPrompt = systemPromptParts.length > 0 ? systemPromptParts.join('\n') : undefined;

    return {
      model: request.model,
      messages: anthropicMessages,
      system: systemPrompt,
      tools: this.convertOpenAIToolsToAnthropicTools(request.tools),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: request.stream,
      metadata: {
        ...(request.extra ?? {}),
        source: 'openai',
      },
    };
  }

  private convertOpenAIPartsToAnthropicContent(
    content: OpenAIChatRequest['messages'][number]['content'],
  ): AnthropicContent[] {
    if (typeof content === 'string') {
      return content.trim() ? [{ type: 'text', text: content }] : [];
    }

    const blocks: AnthropicContent[] = [];
    for (const part of content) {
      if (part.type === 'text' && part.text) {
        blocks.push({ type: 'text', text: part.text });
        continue;
      }

      if (part.type === 'image_url' && part.image_url?.url) {
        const url = part.image_url.url;
        const dataUri = url.match(/^data:(?<mime>[^;]+);base64,(?<data>.+)$/);
        if (dataUri?.groups?.mime && dataUri.groups.data) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: dataUri.groups.mime,
              data: dataUri.groups.data,
            },
          });
        } else {
          blocks.push({ type: 'text', text: `[image_url] ${url}` });
        }
      }
    }
    return blocks;
  }

  private extractOpenAITextContent(
    content: OpenAIChatRequest['messages'][number]['content'],
  ): string {
    if (typeof content === 'string') {
      return content;
    }

    return content
      .filter((part) => part.type === 'text')
      .map((part) => part.text || '')
      .join('\n');
  }

  private parseOpenAIFunctionArguments(argumentsString: string): Record<string, unknown> {
    if (!argumentsString || argumentsString.trim() === '') {
      return {};
    }

    try {
      const parsed = JSON.parse(argumentsString);
      if (this.isRecord(parsed)) {
        return parsed;
      }
      return { value: parsed };
    } catch {
      return { raw: argumentsString };
    }
  }

  private convertOpenAIToolsToAnthropicTools(
    tools: OpenAIChatRequest['tools'],
  ): AnthropicChatRequest['tools'] {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters || { type: 'object', properties: {} },
    }));
  }

  private mapGeminiFinishReasonToOpenAIFinishReason(finishReason?: string): string | null {
    if (!finishReason) {
      return null;
    }

    const normalized = finishReason.toUpperCase();
    if (normalized === 'STOP') {
      return 'stop';
    }
    if (normalized === 'MAX_TOKENS') {
      return 'length';
    }
    if (normalized === 'SAFETY' || normalized === 'RECITATION') {
      return 'content_filter';
    }

    return finishReason.toLowerCase();
  }

  private mapAnthropicStopReasonToOpenAIFinishReason(stopReason?: string | null): string | null {
    if (!stopReason) {
      return null;
    }

    if (stopReason === 'end_turn') {
      return 'stop';
    }
    if (stopReason === 'max_tokens') {
      return 'length';
    }
    if (stopReason === 'tool_use') {
      return 'tool_calls';
    }

    return stopReason;
  }

  private normalizeToolCallArguments(input: unknown): string {
    if (typeof input === 'string') {
      return input;
    }
    if (isNil(input)) {
      return '{}';
    }

    try {
      return JSON.stringify(input);
    } catch {
      return '{}';
    }
  }

  // Convert Claude response to OpenAI format
  private convertClaudeToOpenAIResponse(
    claudeResponse: ClaudeResponse,
    model: string,
  ): OpenAIChatResponse {
    const contentBlocks = Array.isArray(claudeResponse?.content) ? claudeResponse.content : [];

    const textContent = contentBlocks
      .filter(
        (
          block,
        ): block is Extract<ClaudeResponse['content'][number], { type: 'text'; text: string }> =>
          block?.type === 'text',
      )
      .map((block) => block.text || '')
      .join('');

    const reasoningContent = contentBlocks
      .filter(
        (
          block,
        ): block is Extract<
          ClaudeResponse['content'][number],
          { type: 'thinking'; thinking: string }
        > => block?.type === 'thinking',
      )
      .map((block) => block.thinking || '')
      .join('');

    const toolCalls = contentBlocks
      .filter(
        (
          block,
        ): block is Extract<
          ClaudeResponse['content'][number],
          { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        > => block?.type === 'tool_use',
      )
      .map((block, index: number) => ({
        id: block.id || `tool-call-${index}`,
        type: 'function' as const,
        function: {
          name: block.name || 'unknown_tool',
          arguments: this.normalizeToolCallArguments(block.input),
        },
      }));

    return {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            reasoning_content: reasoningContent || undefined,
          },
          finish_reason: this.mapAnthropicStopReasonToOpenAIFinishReason(
            claudeResponse.stop_reason,
          ),
        },
      ],
      usage: {
        prompt_tokens: claudeResponse.usage?.input_tokens || 0,
        completion_tokens: claudeResponse.usage?.output_tokens || 0,
        total_tokens:
          (claudeResponse.usage?.input_tokens || 0) + (claudeResponse.usage?.output_tokens || 0),
      },
    };
  }

  private mapModel(model: string): string {
    const normalizedModel = model.replace(/^models\//i, '').trim();
    const config = getServerConfig();
    const configuredMapping = {
      ...(config?.custom_mapping ?? {}),
      ...(config?.anthropic_mapping ?? {}),
    };

    const customExactMapping: Record<string, string> = {};
    const wildcardMapping: Array<{
      pattern: RegExp;
      target: string;
    }> = [];

    for (const [key, target] of Object.entries(configuredMapping)) {
      if (!key || !target) {
        continue;
      }

      if (key.includes('*')) {
        const escaped = key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        wildcardMapping.push({
          pattern: new RegExp(`^${escaped}$`, 'i'),
          target,
        });
        continue;
      }

      customExactMapping[key] = target;
    }

    for (const wildcardRule of wildcardMapping) {
      if (wildcardRule.pattern.test(normalizedModel)) {
        return wildcardRule.target;
      }
    }

    const routedModel = resolveModelRoute(normalizedModel, customExactMapping, {}, {});

    return routedModel;
  }

  private classifyUpstreamError(errorMessage: string): {
    retry: boolean;
    markAsForbidden: boolean;
    markAsRateLimited: boolean;
  } {
    const msg = errorMessage.toLowerCase();
    const isForbidden =
      msg.includes('401') ||
      msg.includes('unauthorized') ||
      msg.includes('invalid_grant') ||
      msg.includes('403') ||
      msg.includes('permission_denied') ||
      msg.includes('forbidden');

    if (isForbidden) {
      return {
        retry: true,
        markAsForbidden: true,
        markAsRateLimited: false,
      };
    }

    const isRateLimitedSignal =
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate_limit') ||
      msg.includes('rate limit');

    const shouldRetryByStatus =
      msg.includes('408') ||
      msg.includes('429') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504');

    const shouldRetryByKeyword =
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate_limit') ||
      msg.includes('timeout') ||
      msg.includes('socket hang up') ||
      msg.includes('empty response stream') ||
      msg.includes('connection reset');

    if (shouldRetryByStatus || shouldRetryByKeyword) {
      return {
        retry: true,
        markAsForbidden: false,
        markAsRateLimited: isRateLimitedSignal,
      };
    }

    return {
      retry: false,
      markAsForbidden: false,
      markAsRateLimited: false,
    };
  }

  private buildModelSpecificHeaders(model: string | undefined): Record<string, string> {
    if (!model) {
      return {};
    }

    if (model.toLowerCase().includes('claude')) {
      return {
        'anthropic-beta':
          'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14',
      };
    }

    return {};
  }

  private isProjectLicenseError(errorMessage: string): boolean {
    const msg = errorMessage.toLowerCase();
    return (
      msg.includes('#3501') ||
      (msg.includes('google cloud project') && msg.includes('code assist license'))
    );
  }

  private isProjectNotFoundError(errorMessage: string): boolean {
    const msg = errorMessage.toLowerCase();
    return (
      msg.includes('invalid project resource name projects/') ||
      (msg.includes('resource projects/') && msg.includes('could not be found')) ||
      (msg.includes('project') && msg.includes('not found'))
    );
  }

  private isProjectContextError(errorMessage: string): boolean {
    return this.isProjectLicenseError(errorMessage) || this.isProjectNotFoundError(errorMessage);
  }

  private isQuotaExhaustedError(errorMessage: string): boolean {
    const msg = errorMessage.toLowerCase();
    return (
      msg.includes('resource has been exhausted') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota')
    );
  }

  private getSessionKeyFromAnthropic(request: AnthropicChatRequest): string | undefined {
    const metadata = request.metadata;
    const sessionCandidate =
      metadata?.session_id ?? metadata?.sessionId ?? metadata?.user_id ?? metadata?.userId;
    if (typeof sessionCandidate !== 'string' || sessionCandidate.trim() === '') {
      return undefined;
    }
    return `anthropic:${sessionCandidate.trim()}`;
  }

  private getSessionKeyFromOpenAI(request: OpenAIChatRequest): string | undefined {
    const extra = request.extra;
    const sessionCandidate =
      extra?.session_id ?? extra?.sessionId ?? extra?.user_id ?? extra?.userId;
    if (typeof sessionCandidate !== 'string' || sessionCandidate.trim() === '') {
      return undefined;
    }
    return `openai:${sessionCandidate.trim()}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private isGeminiPart(value: unknown): value is InternalGeminiPart {
    return this.isRecord(value);
  }
}
