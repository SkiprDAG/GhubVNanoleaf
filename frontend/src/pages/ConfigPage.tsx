import React, { useState, useEffect } from 'react';
import { AppConfig } from '@/api/types';
import { ConfigViewer } from '@/components/config/ConfigViewer';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sliders, Save, RotateCcw, Check } from 'lucide-react';

export interface ConfigPageProps {
  config?: AppConfig;
  isLoading: boolean;
  onReload: () => void;
  onSaveFullConfig: (cfg: AppConfig) => Promise<unknown>;
  isSaving: boolean;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({
  config,
  isLoading,
  onReload,
  onSaveFullConfig,
  isSaving,
}) => {
  const [transitionTime, setTransitionTime] = useState(config?.logic.transition_time || 2);
  const [whiteChannel, setWhiteChannel] = useState(config?.logic.white_channel || 0);
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  const [offlineAction, setOfflineAction] = useState(config?.agent?.pc_offline_action || 'off');
  const [offlineTimeout, setOfflineTimeout] = useState(config?.agent?.pc_offline_timeout_sec || 15);

  useEffect(() => {
    if (config) {
      setTransitionTime(config.logic.transition_time);
      setWhiteChannel(config.logic.white_channel);
      setOfflineAction(config.agent?.pc_offline_action || 'off');
      setOfflineTimeout(config.agent?.pc_offline_timeout_sec || 15);
    }
  }, [config]);

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const isDirty =
    transitionTime !== config.logic.transition_time ||
    whiteChannel !== config.logic.white_channel ||
    offlineAction !== (config.agent?.pc_offline_action || 'off') ||
    offlineTimeout !== (config.agent?.pc_offline_timeout_sec || 15);

  const handleReset = () => {
    setTransitionTime(config.logic.transition_time);
    setWhiteChannel(config.logic.white_channel);
    setOfflineAction(config.agent?.pc_offline_action || 'off');
    setOfflineTimeout(config.agent?.pc_offline_timeout_sec || 15);
  };

  const handleSaveGlobal = async () => {
    const updated: AppConfig = {
      ...config,
      logic: {
        ...config.logic,
        transition_time: transitionTime,
        white_channel: whiteChannel,
      },
      agent: {
        enabled: config.agent?.enabled ?? true,
        pc_offline_action: offlineAction,
        pc_offline_timeout_sec: offlineTimeout,
      },
    };

    await onSaveFullConfig(updated);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-foreground">System Configuration &amp; Snapshot</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          View application configuration, adjust hardware parameters and configure 24/7 PC Agent policies
        </p>
      </div>

      {/* Global Hardware Parameters */}
      <Card className="space-y-4">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-secondary/80 text-primary border border-border">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>Global Hardware Parameters</CardTitle>
              <CardDescription>
                Default transition speeds and RGBW white channel saturation
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60">
          <Slider
            label="Default Transition Time"
            min={0}
            max={20}
            step={1}
            value={transitionTime}
            valueDisplay={`${transitionTime / 10}s`}
            onChange={(e) => setTransitionTime(Number(e.target.value))}
          />

          <Slider
            label="RGBW White Channel Value"
            min={0}
            max={255}
            step={1}
            value={whiteChannel}
            valueDisplay={whiteChannel}
            onChange={(e) => setWhiteChannel(Number(e.target.value))}
          />
        </div>

        {/* 24/7 Autonomy & Agent Policy */}
        <div className="pt-3 border-t border-border/40">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            24/7 Autonomy &amp; PC Shutdown Fallback Action
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                When PC turns off or sleeps:
              </label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={offlineAction}
                onChange={(e) => setOfflineAction(e.target.value)}
              >
                <option value="off">Blackout (Turn off Nanoleaf panels)</option>
                <option value="circadian">Circadian Mode (24h sunlight / nightlight)</option>
                <option value="ambient">Ambient Mode (Smooth color breathing)</option>
                <option value="keep_last">Keep Last Colors (No change)</option>
              </select>
            </div>

            <Slider
              label="PC Offline Timeout"
              min={5}
              max={60}
              step={5}
              value={offlineTimeout}
              valueDisplay={`${offlineTimeout}s`}
              onChange={(e) => setOfflineTimeout(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveGlobal}
            disabled={!isDirty && !isSavedRecently}
            isLoading={isSaving}
            leftIcon={
              isSavedRecently ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )
            }
            className={isSavedRecently ? 'bg-emerald-600 hover:bg-emerald-600' : undefined}
          >
            {isSavedRecently ? 'Applied' : isSaving ? 'Saving...' : 'Save Parameters'}
          </Button>
        </div>
      </Card>

      {/* JSON Viewer */}
      <ConfigViewer config={config} onReload={onReload} isLoading={isLoading} />
    </div>
  );
};
