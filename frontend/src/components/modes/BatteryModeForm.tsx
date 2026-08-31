import React, { useState, useEffect } from 'react';
import { AppConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { Tabs } from '@/components/ui/Tabs';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { SunMedium, AlertTriangle, BatteryCharging, Save, RotateCcw, Check } from 'lucide-react';

export interface BatteryModeFormProps {
  config: AppConfig;
  onSaveFullConfig: (cfg: AppConfig) => Promise<unknown>;
  isSaving?: boolean;
}

export const BatteryModeForm: React.FC<BatteryModeFormProps> = ({
  config,
  onSaveFullConfig,
  isSaving = false,
}) => {
  const [activeSection, setActiveSection] = useState<'brightness' | 'charging' | 'critical'>('brightness');

  // Local form state
  const [scaleEnabled, setScaleEnabled] = useState(config.logic.brightness_scale.enabled);
  const [minFactor, setMinFactor] = useState(config.logic.brightness_scale.min_factor);
  const [maxFactor, setMaxFactor] = useState(config.logic.brightness_scale.max_factor);

  const [criticalThreshold, setCriticalThreshold] = useState(config.logic.thresholds.critical);
  const [criticalTransition, setCriticalTransition] = useState(config.logic.effects.critical.pulse_transition_time);
  const [warningColor, setWarningColor] = useState<RGBColor>(config.logic.effects.critical.warning_color);

  const [partialTransition, setPartialTransition] = useState(config.logic.effects.charging_partial.pulse_transition_time);
  const [partialMin, setPartialMin] = useState(config.logic.effects.charging_partial.min_factor);
  const [partialMax, setPartialMax] = useState(config.logic.effects.charging_partial.max_factor);

  const [fullTransition, setFullTransition] = useState(config.logic.effects.charging_full.pulse_transition_time);
  const [fullMin, setFullMin] = useState(config.logic.effects.charging_full.min_factor);
  const [fullMax, setFullMax] = useState(config.logic.effects.charging_full.max_factor);

  const [isSavedRecently, setIsSavedRecently] = useState(false);

  useEffect(() => {
    setScaleEnabled(config.logic.brightness_scale.enabled);
    setMinFactor(config.logic.brightness_scale.min_factor);
    setMaxFactor(config.logic.brightness_scale.max_factor);

    setCriticalThreshold(config.logic.thresholds.critical);
    setCriticalTransition(config.logic.effects.critical.pulse_transition_time);
    setWarningColor(config.logic.effects.critical.warning_color);

    setPartialTransition(config.logic.effects.charging_partial.pulse_transition_time);
    setPartialMin(config.logic.effects.charging_partial.min_factor);
    setPartialMax(config.logic.effects.charging_partial.max_factor);

    setFullTransition(config.logic.effects.charging_full.pulse_transition_time);
    setFullMin(config.logic.effects.charging_full.min_factor);
    setFullMax(config.logic.effects.charging_full.max_factor);
  }, [config]);

  const isDirty =
    scaleEnabled !== config.logic.brightness_scale.enabled ||
    minFactor !== config.logic.brightness_scale.min_factor ||
    maxFactor !== config.logic.brightness_scale.max_factor ||
    criticalThreshold !== config.logic.thresholds.critical ||
    criticalTransition !== config.logic.effects.critical.pulse_transition_time ||
    warningColor[0] !== config.logic.effects.critical.warning_color[0] ||
    warningColor[1] !== config.logic.effects.critical.warning_color[1] ||
    warningColor[2] !== config.logic.effects.critical.warning_color[2] ||
    partialTransition !== config.logic.effects.charging_partial.pulse_transition_time ||
    partialMin !== config.logic.effects.charging_partial.min_factor ||
    partialMax !== config.logic.effects.charging_partial.max_factor ||
    fullTransition !== config.logic.effects.charging_full.pulse_transition_time ||
    fullMin !== config.logic.effects.charging_full.min_factor ||
    fullMax !== config.logic.effects.charging_full.max_factor;

  const handleReset = () => {
    setScaleEnabled(config.logic.brightness_scale.enabled);
    setMinFactor(config.logic.brightness_scale.min_factor);
    setMaxFactor(config.logic.brightness_scale.max_factor);

    setCriticalThreshold(config.logic.thresholds.critical);
    setCriticalTransition(config.logic.effects.critical.pulse_transition_time);
    setWarningColor(config.logic.effects.critical.warning_color);

    setPartialTransition(config.logic.effects.charging_partial.pulse_transition_time);
    setPartialMin(config.logic.effects.charging_partial.min_factor);
    setPartialMax(config.logic.effects.charging_partial.max_factor);

    setFullTransition(config.logic.effects.charging_full.pulse_transition_time);
    setFullMin(config.logic.effects.charging_full.min_factor);
    setFullMax(config.logic.effects.charging_full.max_factor);
  };

  const handleSave = async () => {
    const updated: AppConfig = {
      ...config,
      logic: {
        ...config.logic,
        brightness_scale: {
          enabled: scaleEnabled,
          min_factor: minFactor,
          max_factor: maxFactor,
        },
        thresholds: {
          critical: criticalThreshold,
        },
        effects: {
          ...config.logic.effects,
          critical: {
            pulse_transition_time: criticalTransition,
            warning_color: warningColor,
          },
          charging_partial: {
            pulse_transition_time: partialTransition,
            min_factor: partialMin,
            max_factor: partialMax,
          },
          charging_full: {
            pulse_transition_time: fullTransition,
            min_factor: fullMin,
            max_factor: fullMax,
          },
        },
      },
    };

    await onSaveFullConfig(updated);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2500);
  };

  const tabs = [
    { id: 'brightness', label: 'Brightness Scaling', icon: <SunMedium className="w-3.5 h-3.5" /> },
    { id: 'charging', label: 'Charging Effects', icon: <BatteryCharging className="w-3.5 h-3.5" /> },
    { id: 'critical', label: 'Critical Alert', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];

  return (
    <Card className="space-y-5">
      <CardHeader>
        <div>
          <CardTitle>Battery Mode Parameters</CardTitle>
          <CardDescription>
            Fine-tune brightness curves, charging animations, and battery thresholds
          </CardDescription>
        </div>
      </CardHeader>

      <Tabs
        tabs={tabs}
        activeTab={activeSection}
        onTabChange={(id) => setActiveSection(id as 'brightness' | 'charging' | 'critical')}
      />

      {/* Section 1: Brightness Scaling */}
      {activeSection === 'brightness' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60">
            <Switch
              checked={scaleEnabled}
              onCheckedChange={setScaleEnabled}
              label="Enable Non-linear Brightness Scaling"
              description="Automatically scales Nanoleaf brightness based on current Logitech device battery %"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60">
            <Slider
              label="Minimum Brightness Factor (0% battery)"
              min={0.0}
              max={1.0}
              step={0.01}
              value={minFactor}
              valueDisplay={`${Math.round(minFactor * 100)}%`}
              onChange={(e) => setMinFactor(Number(e.target.value))}
              disabled={!scaleEnabled}
            />

            <Slider
              label="Maximum Brightness Factor (100% battery)"
              min={0.0}
              max={1.0}
              step={0.01}
              value={maxFactor}
              valueDisplay={`${Math.round(maxFactor * 100)}%`}
              onChange={(e) => setMaxFactor(Number(e.target.value))}
              disabled={!scaleEnabled}
            />
          </div>
        </div>
      )}

      {/* Section 2: Charging Effects */}
      {activeSection === 'charging' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Partial Charging */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <h5 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Partial Charging Pulse (&lt; 100%)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Slider
                label="Pulse Speed (tenths of sec)"
                min={5}
                max={60}
                step={1}
                value={partialTransition}
                valueDisplay={`${partialTransition / 10}s`}
                onChange={(e) => setPartialTransition(Number(e.target.value))}
              />
              <Slider
                label="Min Factor"
                min={0.0}
                max={1.0}
                step={0.05}
                value={partialMin}
                valueDisplay={`${Math.round(partialMin * 100)}%`}
                onChange={(e) => setPartialMin(Number(e.target.value))}
              />
              <Slider
                label="Max Factor"
                min={0.0}
                max={1.0}
                step={0.05}
                value={partialMax}
                valueDisplay={`${Math.round(partialMax * 100)}%`}
                onChange={(e) => setPartialMax(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Full Charging */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Fully Charged Pulse (100%)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Slider
                label="Pulse Speed (tenths of sec)"
                min={5}
                max={60}
                step={1}
                value={fullTransition}
                valueDisplay={`${fullTransition / 10}s`}
                onChange={(e) => setFullTransition(Number(e.target.value))}
              />
              <Slider
                label="Min Factor"
                min={0.0}
                max={1.0}
                step={0.05}
                value={fullMin}
                valueDisplay={`${Math.round(fullMin * 100)}%`}
                onChange={(e) => setFullMin(Number(e.target.value))}
              />
              <Slider
                label="Max Factor"
                min={0.0}
                max={1.0}
                step={0.05}
                value={fullMax}
                valueDisplay={`${Math.round(fullMax * 100)}%`}
                onChange={(e) => setFullMax(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Critical Battery */}
      {activeSection === 'critical' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
            <Slider
              label="Critical Battery Warning Threshold"
              min={1}
              max={30}
              step={1}
              value={criticalThreshold}
              valueDisplay={`${criticalThreshold}%`}
              onChange={(e) => setCriticalThreshold(Number(e.target.value))}
            />
            <Slider
              label="Warning Pulse Speed (tenths of sec)"
              min={2}
              max={40}
              step={1}
              value={criticalTransition}
              valueDisplay={`${criticalTransition / 10}s`}
              onChange={(e) => setCriticalTransition(Number(e.target.value))}
            />
          </div>

          <ColorPickerField
            label="Warning Pulse Color"
            color={warningColor}
            onChange={setWarningColor}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
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
          onClick={handleSave}
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
          {isSavedRecently ? 'Applied' : isSaving ? 'Saving & Applying...' : 'Save & Apply'}
        </Button>
      </div>
    </Card>
  );
};
