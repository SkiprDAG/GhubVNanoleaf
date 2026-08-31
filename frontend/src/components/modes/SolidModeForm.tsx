import React, { useState, useEffect } from 'react';
import { SolidModeConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { Save, RotateCcw, Check } from 'lucide-react';

export interface SolidModeFormProps {
  solidConfig: SolidModeConfig;
  onSave: (payload: { color: RGBColor; factor: number; transition_time: number }) => Promise<unknown>;
  isSaving?: boolean;
}

export const SolidModeForm: React.FC<SolidModeFormProps> = ({
  solidConfig,
  onSave,
  isSaving = false,
}) => {
  const [color, setColor] = useState<RGBColor>(solidConfig.color);
  const [factor, setFactor] = useState(solidConfig.factor);
  const [transitionTime, setTransitionTime] = useState(solidConfig.transition_time);
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  useEffect(() => {
    setColor(solidConfig.color);
    setFactor(solidConfig.factor);
    setTransitionTime(solidConfig.transition_time);
  }, [solidConfig]);

  const isDirty =
    color[0] !== solidConfig.color[0] ||
    color[1] !== solidConfig.color[1] ||
    color[2] !== solidConfig.color[2] ||
    factor !== solidConfig.factor ||
    transitionTime !== solidConfig.transition_time;

  const handleReset = () => {
    setColor(solidConfig.color);
    setFactor(solidConfig.factor);
    setTransitionTime(solidConfig.transition_time);
  };

  const handleSave = async () => {
    await onSave({
      color,
      factor,
      transition_time: transitionTime,
    });
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2500);
  };

  return (
    <Card className="space-y-4">
      <CardHeader>
        <div>
          <CardTitle>Solid Ambient Color & Parameters</CardTitle>
          <CardDescription>
            Configure the ambient illumination color applied to all configured panels
          </CardDescription>
        </div>
      </CardHeader>

      <ColorPickerField
        label="Solid Lighting Color"
        color={color}
        onChange={setColor}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60">
        <Slider
          label="Brightness Multiplier"
          min={0.0}
          max={1.0}
          step={0.01}
          value={factor}
          valueDisplay={`${Math.round(factor * 100)}%`}
          onChange={(e) => setFactor(Number(e.target.value))}
        />

        <Slider
          label="Transition Time (tenths of sec)"
          min={0}
          max={20}
          step={1}
          value={transitionTime}
          valueDisplay={`${transitionTime / 10}s`}
          onChange={(e) => setTransitionTime(Number(e.target.value))}
        />
      </div>

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
