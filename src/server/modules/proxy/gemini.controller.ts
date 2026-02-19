import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { isEmpty } from 'lodash-es';
import { Observable } from 'rxjs';

import { ProxyGuard } from './proxy.guard';
import { ProxyService } from './proxy.service';
import { GeminiRequest, GeminiResponse } from './interfaces/request-interfaces';
import { getServerConfig } from '../../server-config';
import { getAllDynamicModels } from '../../../lib/antigravity/ModelMapping';

type GeminiModelMetadata = {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature: number;
  topK: number;
  topP: number;
  version: string;
};

@Controller('v1beta')
@UseGuards(ProxyGuard)
export class GeminiController {
  constructor(@Inject(ProxyService) private readonly proxyService: ProxyService) {}

  @Get('models')
  listModels(@Res() res: FastifyReply) {
    const models = this.buildGeminiModelList();
    res.status(HttpStatus.OK).send({
      models,
    });
  }

  @Get('models/:model')
  getModel(@Param('model') model: string, @Res() res: FastifyReply) {
    const targetName = model.startsWith('models/') ? model : `models/${model}`;
    const matched = this.buildGeminiModelList().find((item) => item.name === targetName);

    if (matched) {
      res.status(HttpStatus.OK).send({
        name: matched.name,
        displayName: matched.displayName,
      });
      return;
    }

    res.status(HttpStatus.OK).send({
      name: targetName,
      displayName: targetName.replace(/^models\//, ''),
    });
  }

  @Post('models/:modelAction')
  async modelAction(
    @Param('modelAction') modelAction: string,
    @Body() body: GeminiRequest,
    @Res() res: FastifyReply,
  ) {
    const parsed = this.parseCombinedModelAction(modelAction);
    if (!parsed) {
      res.status(HttpStatus.BAD_REQUEST).send({
        error: {
          code: HttpStatus.BAD_REQUEST,
          message: 'Model action format is invalid',
          status: 'INVALID_ARGUMENT',
        },
      });
      return;
    }

    await this.dispatchAction(parsed.model, parsed.action, body, res);
  }

  @Post('models/:model/countTokens')
  async countTokens(
    @Param('model') model: string,
    @Body() body: GeminiRequest,
    @Res() res: FastifyReply,
  ) {
    await this.dispatchAction(`models/${model}`, 'countTokens', body, res);
  }

  private async dispatchAction(
    model: string,
    action: string,
    body: GeminiRequest,
    res: FastifyReply,
  ): Promise<void> {
    if (action === 'countTokens') {
      res.status(HttpStatus.OK).send({
        totalTokens: 0,
      });
      return;
    }

    try {
      if (action === 'streamGenerateContent') {
        const stream = await this.proxyService.handleGeminiStreamGenerateContent(model, body);
        if (stream instanceof Observable) {
          this.sendObservableSse(res, stream);
          return;
        }
      }

      if (action === 'generateContent') {
        const result = await this.proxyService.handleGeminiGenerateContent(model, body);
        res.status(HttpStatus.OK).send(this.normalizeGeminiGenerateResponse(result));
        return;
      }

      res.status(HttpStatus.BAD_REQUEST).send({
        error: {
          code: HttpStatus.BAD_REQUEST,
          message: `Unsupported model action: ${action}`,
          status: 'INVALID_ARGUMENT',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message,
          status: 'INTERNAL',
        },
      });
    }
  }

  private parseCombinedModelAction(modelAction: string): {
    model: string;
    action: string;
  } | null {
    const colonIndex = modelAction.lastIndexOf(':');
    if (colonIndex <= 0) {
      return null;
    }

    const model = modelAction.slice(0, colonIndex).trim();
    const action = modelAction.slice(colonIndex + 1).trim();
    if (!model || !action) {
      return null;
    }

    const prefixedModel = model.startsWith('models/') ? model : `models/${model}`;
    return {
      model: prefixedModel,
      action,
    };
  }

  private buildGeminiModelList(): GeminiModelMetadata[] {
    const config = getServerConfig();
    const dynamicModelIds = getAllDynamicModels(config?.custom_mapping ?? {});

    return dynamicModelIds.map((id) => this.toGeminiModelMetadata(`models/${id}`));
  }

  private toGeminiModelMetadata(modelName: string): GeminiModelMetadata {
    const displayName = modelName.replace(/^models\//, '');
    return {
      name: modelName,
      displayName,
      description: '',
      inputTokenLimit: 128000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      temperature: 1,
      topK: 64,
      topP: 0.95,
      version: '001',
    };
  }

  private normalizeGeminiGenerateResponse(response: GeminiResponse): GeminiResponse {
    const candidates = (response.candidates ?? []).map((candidate, index) => ({
      content: candidate.content,
      finishReason: candidate.finishReason,
      index: typeof candidate.index === 'number' ? candidate.index : index,
    }));

    const normalized: GeminiResponse = {
      candidates,
    };

    if (response.usageMetadata) {
      const usageMetadata = this.normalizeGeminiUsageMetadata(response.usageMetadata);
      if (!isEmpty(usageMetadata)) {
        normalized.usageMetadata = usageMetadata;
      }
    }

    return normalized;
  }

  private normalizeGeminiUsageMetadata(
    usageMetadata: GeminiResponse['usageMetadata'],
  ): NonNullable<GeminiResponse['usageMetadata']> {
    const normalized: NonNullable<GeminiResponse['usageMetadata']> = {};
    if (usageMetadata?.promptTokenCount !== undefined) {
      normalized.promptTokenCount = usageMetadata.promptTokenCount;
    }
    if (usageMetadata?.candidatesTokenCount !== undefined) {
      normalized.candidatesTokenCount = usageMetadata.candidatesTokenCount;
    }
    if (usageMetadata?.totalTokenCount !== undefined) {
      normalized.totalTokenCount = usageMetadata.totalTokenCount;
    }
    if (usageMetadata?.thoughtsTokenCount !== undefined) {
      normalized.thoughtsTokenCount = usageMetadata.thoughtsTokenCount;
    }
    if (usageMetadata?.promptTokensDetails !== undefined) {
      normalized.promptTokensDetails = usageMetadata.promptTokensDetails;
    }
    if (usageMetadata?.candidatesTokensDetails !== undefined) {
      normalized.candidatesTokensDetails = usageMetadata.candidatesTokensDetails;
    }
    if (usageMetadata?.trafficType !== undefined) {
      normalized.trafficType = usageMetadata.trafficType;
    }
    return normalized;
  }

  private sendObservableSse(res: FastifyReply, stream: Observable<unknown>): void {
    if (
      !res.raw ||
      typeof res.raw.writeHead !== 'function' ||
      typeof res.raw.write !== 'function'
    ) {
      res.header('Content-Type', 'text/event-stream');
      res.header('Cache-Control', 'no-cache');
      res.header('Connection', 'keep-alive');
      res.send(stream);
      return;
    }

    if (this.hasHijack(res)) {
      res.hijack();
    }

    res.raw.writeHead(HttpStatus.OK, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const subscription = stream.subscribe({
      next: (chunk) => {
        if (res.raw.writableEnded) {
          return;
        }
        const payload = typeof chunk === 'string' ? chunk : String(chunk ?? '');
        res.raw.write(payload);
      },
      error: (error) => {
        if (res.raw.writableEnded) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        res.raw.write(
          `data: ${JSON.stringify({
            error: {
              message,
              type: 'server_error',
            },
          })}\n\n`,
        );
        res.raw.end();
      },
      complete: () => {
        if (!res.raw.writableEnded) {
          res.raw.end();
        }
      },
    });

    res.raw.on('close', () => {
      subscription.unsubscribe();
    });
  }

  private hasHijack(reply: FastifyReply): reply is FastifyReply & { hijack: () => void } {
    return typeof (reply as { hijack?: unknown }).hijack === 'function';
  }
}
