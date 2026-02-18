import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useCloudAccounts } from '@/hooks/useCloudAccounts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Search, RotateCcw, Save } from 'lucide-react';

interface ModelVisibilitySettingsProps {}

export const ModelVisibilitySettings: React.FC<ModelVisibilitySettingsProps> = () => {
  const { t } = useTranslation();
  const { config, saveConfig } = useAppConfig();
  const { data: accounts, isLoading: accountsLoading } = useCloudAccounts();

  const [searchTerm, setSearchTerm] = useState('');
  const [modelVisibility, setModelVisibility] = useState<Record<string, boolean>>({});
  const [providerGroupingsEnabled, setProviderGroupingsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize model visibility and provider groupings from config
  React.useEffect(() => {
    if (config?.model_visibility) {
      setModelVisibility(config.model_visibility);
    }
    if (config?.provider_groupings_enabled !== undefined) {
      setProviderGroupingsEnabled(config.provider_groupings_enabled);
    }
  }, [config?.model_visibility, config?.provider_groupings_enabled]);

  // Get all unique models from all accounts
  const allModels = useMemo(() => {
    if (!accounts) return [];

    const modelSet = new Set<string>();
    accounts.forEach((account) => {
      if (account.quota?.models) {
        Object.keys(account.quota.models).forEach((model) => {
          modelSet.add(model);
        });
      }
    });

    return Array.from(modelSet).sort();
  }, [accounts]);

  // Filter models based on search term
  const filteredModels = useMemo(() => {
    return allModels.filter((model) => model.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allModels, searchTerm]);

  // Handle model visibility toggle
  const handleModelToggle = (modelName: string, checked: boolean) => {
    setModelVisibility((prev) => ({
      ...prev,
      [modelName]: checked,
    }));
  };

  // Reset to defaults (all models visible)
  const handleReset = () => {
    setModelVisibility({});
  };

  // Save configuration
  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      await saveConfig({
        ...config,
        model_visibility: modelVisibility,
        provider_groupings_enabled: providerGroupingsEnabled,
      });
    } catch (error) {
      console.error('Failed to save model visibility settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (accountsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">{t('common.loading')}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{t('settings.modelVisibility.title')}</span>
          <Badge variant="secondary">{filteredModels.length} models</Badge>
        </CardTitle>
        <CardDescription>{t('settings.modelVisibility.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder={t('settings.modelVisibility.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Provider Groupings Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="provider-groupings" className="text-sm font-medium">
              {t('settings.providerGroupings.enabled')}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t('settings.providerGroupings.description')}
            </p>
          </div>
          <Switch
            id="provider-groupings"
            checked={providerGroupingsEnabled}
            onCheckedChange={setProviderGroupingsEnabled}
          />
        </div>

        {/* Model List */}
        <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border p-4">
          {filteredModels.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              {searchTerm
                ? t('settings.modelVisibility.noModelsFound')
                : t('settings.modelVisibility.noModels')}
            </div>
          ) : (
            filteredModels.map((modelName) => {
              const isVisible = modelVisibility[modelName] !== false; // Default to true
              return (
                <div
                  key={modelName}
                  className="hover:bg-muted/50 flex items-center space-x-3 rounded p-2"
                >
                  <Checkbox
                    id={`model-${modelName}`}
                    checked={isVisible}
                    onCheckedChange={(checked) => handleModelToggle(modelName, checked as boolean)}
                  />
                  <label
                    htmlFor={`model-${modelName}`}
                    className="flex-1 cursor-pointer text-sm font-medium"
                  >
                    {modelName}
                  </label>
                  {!isVisible && (
                    <Badge variant="secondary" className="text-xs">
                      {t('settings.modelVisibility.hidden')}
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={Object.keys(modelVisibility).length === 0}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t('settings.modelVisibility.reset')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? t('settings.modelVisibility.saving') : t('settings.modelVisibility.save')}
          </Button>
        </div>

        {/* Statistics */}
        <div className="text-muted-foreground border-t pt-2 text-sm">
          <div className="flex justify-between">
            <span>
              {t('settings.modelVisibility.totalModels')}: {allModels.length}
            </span>
            <span>
              {t('settings.modelVisibility.visibleModels')}:{' '}
              {allModels.length - Object.values(modelVisibility).filter((v) => !v).length}
            </span>
            <span>
              {t('settings.modelVisibility.hiddenModels')}:{' '}
              {Object.values(modelVisibility).filter((v) => !v).length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
