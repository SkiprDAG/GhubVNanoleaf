import React, { useState, useEffect } from 'react';
import { AmbientModeConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { Waves, Plus, Trash2, Save, RotateCcw, Check } from 'lucide-react';
import { rgbToCss, rgbToHex } from '@/lib/utils';

export interface AmbientModeFormProps {
  ambientConfig: AmbientModeConfig;
  onSave: (payload: {
    palette: RGBColor[];
    min_brightness_factor: number;
    max_brightness_factor: number;
    transition_time: number;
    phase_offset_per_group: number;
  }) => Promise<unknown>;
  isSaving?: boolean;
}

export const AmbientModeForm: React.FC<AmbientModeFormProps> = ({
  ambientConfig,
  onSave,
  isSaving = false,
}) => {
  const [palette, setPalette] = useState<RGBColor[]>(ambientConfig.palette || []);
  const [minFactor, setMinFactor] = useState(ambientConfig.min_brightness_factor ?? 0.18);
  const [maxFactor, setMaxFactor] = useState(ambientConfig.max_brightness_factor ?? 0.75);
  const [transitionTime, setTransitionTime] = useState(ambientConfig.transition_time ?? 80);
  const [phaseOffset, setPhaseOffset] = useState(ambientConfig.phase_offset_per_group ?? 0.15);
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPalette(ambientConfig.palette || []);
    setMinFactor(ambientConfig.min_brightness_factor ?? 0.18);
    setMaxFactor(ambientConfig.max_brightness_factor ?? 0.75);
    setTransitionTime(ambientConfig.transition_time ?? 80);
    setPhaseOffset(ambientConfig.phase_offset_per_group ?? 0.15);
    setActiveColorIndex(0);
  }, [ambientConfig]);

  const isDirty =
    JSON.stringify(palette) !== JSON.stringify(ambientConfig.palette) ||
    minFactor !== ambientConfig.min_brightness_factor ||
    maxFactor !== ambientConfig.max_brightness_factor ||
    transitionTime !== ambientConfig.transition_time ||
    phaseOffset !== ambientConfig.phase_offset_per_group;

  const handleReset = () => {
    setPalette(ambientConfig.palette || []);
    setMinFactor(ambientConfig.min_brightness_factor ?? 0.18);
    setMaxFactor(ambientConfig.max_brightness_factor ?? 0.75);
    setTransitionTime(ambientConfig.transition_time ?? 80);
    setPhaseOffset(ambientConfig.phase_offset_per_group ?? 0.15);
    setError(null);
  };

  const handleAddColor = () => {
    if (palette.length >= 6) return;
    const newColor: RGBColor = [50, 150, 220];
    setPalette([...palette, newColor]);
    setActiveColorIndex(palette.length);
  };

  const handleRemoveColor = (index: number) => {
    if (palette.length <= 2) {
      setError('Ambient palette must have at least 2 colors');
      return;
    }
    const next = palette.filter((_, i) => i !== index);
    setPalette(next);
    if (activeColorIndex >= next.length) {
      setActiveColorIndex(next.length - 1);
    }
  };

  const handleColorChange = (newColor: RGBColor) => {
    const next = [...palette];
    next[activeColorIndex] = newColor;
    setPalette(next);
  };

  const handleSave = async () => {
    setError(null);
    if (palette.length < 2) {
      setError('Palette must contain at least 2 colors.');
      return;
    }
    if (palette.length > 6) {
      setError('Palette cannot contain more than 6 colors.');
      return;
    }
    if (minFactor > maxFactor) {
      setError('Min brightness factor cannot exceed max brightness factor.');
      return;
    }

    try {
      await onSave({
        palette,
        min_brightness_factor: minFactor,
        max_brightness_factor: maxFactor,
        transition_time: transitionTime,
        phase_offset_per_group: phaseOffset,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save ambient configuration');
    }
  };

  return (
    <Card className="space-y-5">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Ambient Wave Mode Settings</CardTitle>
            <CardDescription>
              Atmospheric multi-color gradient waves with group phase shifts across all Nanoleaf panels
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Palette Selector Bar */}
      <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/60">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Palette Colors ({palette.length}/6)
          </div>

          {palette.length < 6 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddColor}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs h-7 px-2.5"
            >
              Add Color
            </Button>
          )}
        </div>

        {/* Swatch List */}
        <div className="flex flex-wrap items-center gap-2.5">
          {palette.map((c, index) => {
            const isSelected = index === activeColorIndex;
            return (
              <div
                key={index}
                className={`relative flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-primary/20 border-primary ring-2 ring-primary/30 shadow-md'
                    : 'bg-secondary/60 border-border/70 hover:border-border'
                }`}
                onClick={() => setActiveColorIndex(index)}
              >
                <span
                  className="w-6 h-6 rounded-lg border border-white/20 shadow-sm"
                  style={{ backgroundColor: rgbToCss(c) }}
                />
                <span className="font-mono text-xs font-semibold uppercase">{rgbToHex(c)}</span>

                {palette.length > 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveColor(index);
                    }}
                    className="p-1 text-muted-foreground hover:text-rose-400 rounded transition-colors"
                    title="Remove color"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Active Color Picker */}
        {palette[activeColorIndex] && (
          <div className="pt-2">
            <ColorPickerField
              label={`Edit Color #${activeColorIndex + 1}`}
              color={palette[activeColorIndex]}
              onChange={handleColorChange}
            />
          </div>
        )}
      </div>

      {/* Wave & Speed Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20 border border-border/60">
        <Slider
          label="Min Brightness Wave (trough)"
          min={0.0}
          max={1.0}
          step={0.01}
          value={minFactor}
          valueDisplay={`${Math.round(minFactor * 100)}%`}
          onChange={(e) => setMinFactor(Number(e.target.value))}
        />

        <Slider
          label="Max Brightness Wave (peak)"
          min={0.0}
          max={1.0}
          step={0.01}
          value={maxFactor}
          valueDisplay={`${Math.round(maxFactor * 100)}%`}
          onChange={(e) => setMaxFactor(Number(e.target.value))}
        />

        <Slider
          label="Transition Time per Color Step"
          min={10}
          max={300}
          step={5}
          value={transitionTime}
          valueDisplay={`${transitionTime / 10}s`}
          onChange={(e) => setTransitionTime(Number(e.target.value))}
        />

        <Slider
          label="Phase Offset per Device Group"
          min={0.0}
          max={0.5}
          step={0.01}
          value={phaseOffset}
          valueDisplay={`${Math.round(phaseOffset * 100)}%`}
          onChange={(e) => setPhaseOffset(Number(e.target.value))}
        />
      </div>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

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
          {isSavedRecently ? 'Applied' : isSaving ? 'Saving & Applying...' : 'Save Ambient Settings'}
        </Button>
      </div>
    </Card>
  );
};
