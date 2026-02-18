/**
 * Provider grouping utilities for categorizing AI models by provider
 * and calculating aggregated statistics.
 */

export interface ProviderInfo {
  name: string;
  company: string;
  color: string;
}

export const PROVIDER_REGISTRY: Record<string, ProviderInfo> = {
  'claude-': {
    name: 'Claude',
    company: 'Anthropic',
    color: '#D97757',
  },
  'gemini-': {
    name: 'Gemini',
    company: 'Google',
    color: '#4285F4',
  },
  others: {
    name: 'Other',
    company: 'Various',
    color: '#6B7280',
  },
};

export type ProviderKey = keyof typeof PROVIDER_REGISTRY;

/**
 * Detect the provider key for a given model name based on prefix matching.
 */
export function detectProvider(modelName: string): ProviderKey {
  for (const prefix of Object.keys(PROVIDER_REGISTRY)) {
    if (prefix !== 'others' && modelName.startsWith(prefix)) {
      return prefix;
    }
  }
  return 'others';
}

/**
 * Get the provider display info for a given model name.
 */
export function getProviderInfo(modelName: string): ProviderInfo {
  const key = detectProvider(modelName);
  return PROVIDER_REGISTRY[key];
}

export interface ModelQuota {
  id: string;
  percentage: number;
  resetTime: string;
}

export interface ProviderStats {
  providerKey: ProviderKey;
  providerInfo: ProviderInfo;
  models: ModelQuota[];
  visibleModels: ModelQuota[];
  avgPercentage: number;
  earliestReset: string | null;
}

/**
 * Calculate aggregated stats for a group of models belonging to one provider.
 */
export function calculateProviderStats(
  providerKey: ProviderKey,
  models: ModelQuota[],
  visibilitySettings: Record<string, boolean>,
): ProviderStats {
  const visibleModels = models.filter((m) => visibilitySettings[m.id] !== false);

  if (visibleModels.length === 0) {
    return {
      providerKey,
      providerInfo: PROVIDER_REGISTRY[providerKey],
      models,
      visibleModels: [],
      avgPercentage: 0,
      earliestReset: null,
    };
  }

  const avgPercentage =
    visibleModels.reduce((sum, m) => sum + m.percentage, 0) / visibleModels.length;

  const resetTimes = visibleModels
    .map((m) => m.resetTime)
    .filter(Boolean)
    .map((time) => new Date(time).getTime())
    .filter((t) => !Number.isNaN(t));

  const earliestReset =
    resetTimes.length > 0 ? new Date(Math.min(...resetTimes)).toISOString() : null;

  return {
    providerKey,
    providerInfo: PROVIDER_REGISTRY[providerKey],
    models,
    visibleModels,
    avgPercentage: Math.round(avgPercentage * 10) / 10,
    earliestReset,
  };
}

export interface AccountStats {
  providers: ProviderStats[];
  totalModels: number;
  visibleModels: number;
  overallPercentage: number;
  healthStatus: 'healthy' | 'degraded' | 'limited' | 'critical';
}

/**
 * Group models by provider and calculate per-provider and overall account stats.
 */
export function groupModelsByProvider(
  models: Record<string, { percentage: number; resetTime: string }>,
  visibilitySettings: Record<string, boolean>,
): AccountStats {
  const grouped: Record<ProviderKey, ModelQuota[]> = {};

  for (const [modelName, info] of Object.entries(models)) {
    const key = detectProvider(modelName);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push({
      id: modelName,
      percentage: info.percentage,
      resetTime: info.resetTime,
    });
  }

  const providers: ProviderStats[] = [];
  for (const [key, groupModels] of Object.entries(grouped)) {
    providers.push(calculateProviderStats(key, groupModels, visibilitySettings));
  }

  // Sort: known providers first (claude-, gemini-), then others
  const providerOrder = Object.keys(PROVIDER_REGISTRY);
  providers.sort(
    (a, b) => providerOrder.indexOf(a.providerKey) - providerOrder.indexOf(b.providerKey),
  );

  const allVisibleModels = providers.flatMap((p) => p.visibleModels);
  const totalModels = providers.reduce((sum, p) => sum + p.models.length, 0);

  const overallPercentage =
    allVisibleModels.length > 0
      ? allVisibleModels.reduce((sum, m) => sum + m.percentage, 0) / allVisibleModels.length
      : 0;

  let healthStatus: AccountStats['healthStatus'] = 'healthy';
  if (overallPercentage < 10) {
    healthStatus = 'critical';
  } else if (overallPercentage < 25) {
    healthStatus = 'limited';
  } else if (overallPercentage < 50) {
    healthStatus = 'degraded';
  }

  return {
    providers,
    totalModels,
    visibleModels: allVisibleModels.length,
    overallPercentage: Math.round(overallPercentage * 10) / 10,
    healthStatus,
  };
}
