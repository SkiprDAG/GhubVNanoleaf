import React, { useState, useEffect } from 'react';
import { VortexModeConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { Sparkles, Plus, Trash2, Save, RotateCcw, RotateCw, Check } from 'lucide-react';
import { rgbToCss, cn } from '@/lib/utils';

export interface VortexModeFormProps {
  vortexConfig: VortexModeConfig;
  onSave: (payload: {
    palette: RGBColor[];
    speed_ms: number;
    clockwise: boolean;
    trail_length: number;
  }) => Promise<unknown>;
  isSaving?: boolean;
}

const PRESET_PALETTES: { name: string; colors: RGBColor[] }[] = [
  {
    name: 'Cyberpunk Neon',
    colors: [
      [0, 225, 255],
      [213, 0, 255],
      [255, 0, 119],
    ],
  },
  {
    name: 'Ice Plasma',
    colors: [
      [0, 180, 255],
      [0, 255, 220],
      [0, 120, 255],
    ],
  },
  {
    name: 'Solar Flare',
    colors: [
      [255, 100, 0],
      [255, 200, 0],
      [255, 20, 80],
    ],
  },
  {
    name: 'Matrix Emerald',
    colors: [
      [0, 255, 128],
      [0, 220, 60],
      [100, 255, 180],
    ],
  },
];

export const VortexModeForm: React.FC<VortexModeFormProps> = ({
  vortexConfig,
  onSave,
  isSaving = false,
}) => {
  const [palette, setPalette] = useState<RGBColor[]>(vortexConfig.palette || []);
  const [speedMs, setSpeedMs] = useState(vortexConfig.speed_ms ?? 150);
  const [clockwise, setClockwise] = useState(vortexConfig.clockwise ?? true);
  const [trailLength, setTrailLength] = useState(vortexConfig.trail_length ?? 3);
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPalette(vortexConfig.palette || []);
    setSpeedMs(vortexConfig.speed_ms ?? 150);
    setClockwise(vortexConfig.clockwise ?? true);
    setTrailLength(vortexConfig.trail_length ?? 3);
    setActiveColorIndex(0);
  }, [vortexConfig]);

  const isDirty =
    JSON.stringify(palette) !== JSON.stringify(vortexConfig.palette) ||
    speedMs !== vortexConfig.speed_ms ||
    clockwise !== vortexConfig.clockwise ||
    trailLength !== vortexConfig.trail_length;

  const handleReset = () => {
    setPalette(vortexConfig.palette || []);
    setSpeedMs(vortexConfig.speed_ms ?? 150);
    setClockwise(vortexConfig.clockwise ?? true);
    setTrailLength(vortexConfig.trail_length ?? 3);
    setError(null);
  };

  const handleAddColor = () => {
    if (palette.length >= 6) return;
    const newColor: RGBColor = [0, 200, 255];
    setPalette([...palette, newColor]);
    setActiveColorIndex(palette.length);
  };

  const handleRemoveColor = (index: number) => {
    if (palette.length <= 1) {
      setError('Vortex palette must have at least 1 color');
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
    if (palette.length < 1) {
      setError('Palette must contain at least 1 color.');
      return;
    }
    try {
      await onSave({
        palette,
        speed_ms: speedMs,
        clockwise,
        trail_length: trailLength,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Vortex mode');
    }
  };

  return (
    <Card className="glass-card border-border/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Vortex Turbine Mode</CardTitle>
            <CardDescription>
              Synchronized spinning neon light rotation inside each hexagonal cluster
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="p-6 space-y-6 pt-0">
        {/* Preset Palettes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Preset Themes
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_PALETTES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setPalette(preset.colors);
                  setActiveColorIndex(0);
                }}
                className="p-2 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 transition-all flex flex-col items-start gap-1.5 text-left"
              >
                <div className="flex items-center gap-1 w-full">
                  {preset.colors.map((c, i) => (
                    <span
                      key={i}
                      className="h-3 flex-1 rounded-full shadow-sm"
                      style={{ backgroundColor: rgbToCss(c) }}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-foreground">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette List & Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cluster Colors ({palette.length}/6)
            </label>
            {palette.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddColor}
                className="h-7 text-xs gap-1 border-border/70"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Color
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            {palette.map((color, index) => {
              const isSelected = activeColorIndex === index;
              return (
                <div
                  key={index}
                  onClick={() => setActiveColorIndex(index)}
                  className={cn(
                    'relative group cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border transition-all select-none',
                    isSelected
                      ? 'bg-secondary border-cyan-500 ring-2 ring-cyan-500/30'
                      : 'bg-secondary/40 border-border hover:border-border/80'
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                    style={{ backgroundColor: rgbToCss(color) }}
                  />
                  <span className="text-xs font-mono text-foreground font-medium">
                    Hexagon #{index + 1}
                  </span>
                  {palette.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveColor(index);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Color Picker for active color */}
          {palette[activeColorIndex] && (
            <div className="p-4 rounded-xl bg-secondary/20 border border-border/60 mt-2">
              <ColorPickerField
                color={palette[activeColorIndex]}
                onChange={handleColorChange}
                label={`Hexagon #${activeColorIndex + 1} Color`}
              />
            </div>
          )}
        </div>

        {/* Speed Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">
              Rotation Speed
            </span>
            <span className="font-mono text-cyan-400 font-bold">{speedMs} ms / step</span>
          </div>
          <Slider
            min={40}
            max={500}
            step={10}
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>⚡ Ultra Fast (40ms)</span>
            <span>Balanced (150ms)</span>
            <span>Smooth Chill (500ms)</span>
          </div>
        </div>

        {/* Direction & Trail Length */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Rotation Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setClockwise(true)}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  clockwise
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 ring-1 ring-cyan-500/30'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <RotateCw className="w-3.5 h-3.5" />
                Clockwise
              </button>
              <button
                type="button"
                onClick={() => setClockwise(false)}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  !clockwise
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 ring-1 ring-cyan-500/30'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Counter-CW
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Neon Trail Length
              </span>
              <span className="font-mono text-cyan-400 font-bold">{trailLength} panels</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={trailLength}
              onChange={(e) => setTrailLength(Number(e.target.value))}
            />
          </div>
        </div>


        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="text-xs gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Vortex Config
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
