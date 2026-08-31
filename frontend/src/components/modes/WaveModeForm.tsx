import React, { useState, useEffect } from 'react';
import { WaveModeConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { Activity, Plus, Trash2, Save, RotateCcw, ArrowRight, ArrowLeft, ArrowLeftRight, Check } from 'lucide-react';
import { rgbToCss, cn } from '@/lib/utils';

export interface WaveModeFormProps {
  waveConfig: WaveModeConfig;
  onSave: (payload: {
    palette: RGBColor[];
    speed_ms: number;
    direction: string;
  }) => Promise<unknown>;
  isSaving?: boolean;
}

const PRESET_WAVES: { name: string; colors: RGBColor[] }[] = [
  {
    name: 'Electric Miami',
    colors: [
      [0, 240, 255],
      [160, 32, 240],
      [255, 20, 147],
    ],
  },
  {
    name: 'Deep Pacific',
    colors: [
      [0, 100, 255],
      [0, 220, 255],
      [0, 255, 170],
    ],
  },
  {
    name: 'Crimson Ember',
    colors: [
      [255, 50, 0],
      [255, 0, 90],
      [255, 180, 0],
    ],
  },
  {
    name: 'Cyber Gold',
    colors: [
      [255, 215, 0],
      [255, 140, 0],
      [0, 230, 255],
    ],
  },
];

export const WaveModeForm: React.FC<WaveModeFormProps> = ({
  waveConfig,
  onSave,
  isSaving = false,
}) => {
  const [palette, setPalette] = useState<RGBColor[]>(waveConfig.palette || []);
  const [speedMs, setSpeedMs] = useState(waveConfig.speed_ms ?? 200);
  const [direction, setDirection] = useState(waveConfig.direction || 'left_to_right');
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPalette(waveConfig.palette || []);
    setSpeedMs(waveConfig.speed_ms ?? 200);
    setDirection(waveConfig.direction || 'left_to_right');
    setActiveColorIndex(0);
  }, [waveConfig]);

  const isDirty =
    JSON.stringify(palette) !== JSON.stringify(waveConfig.palette) ||
    speedMs !== waveConfig.speed_ms ||
    direction !== waveConfig.direction;

  const handleReset = () => {
    setPalette(waveConfig.palette || []);
    setSpeedMs(waveConfig.speed_ms ?? 200);
    setDirection(waveConfig.direction || 'left_to_right');
    setError(null);
  };

  const handleAddColor = () => {
    if (palette.length >= 6) return;
    const newColor: RGBColor = [255, 50, 150];
    setPalette([...palette, newColor]);
    setActiveColorIndex(palette.length);
  };

  const handleRemoveColor = (index: number) => {
    if (palette.length <= 1) {
      setError('Wave palette must have at least 1 color');
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
        direction,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Wave mode');
    }
  };

  return (
    <Card className="glass-card border-border/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Horizontal Neon Wave</CardTitle>
            <CardDescription>
              Sweeping neon pulse wave surging across your wall from Left to Right
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="p-6 space-y-6 pt-0">
        {/* Preset Palettes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Wave Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_WAVES.map((preset) => (
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
              Wave Gradient Colors ({palette.length}/6)
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
                      ? 'bg-secondary border-pink-500 ring-2 ring-pink-500/30'
                      : 'bg-secondary/40 border-border hover:border-border/80'
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                    style={{ backgroundColor: rgbToCss(color) }}
                  />
                  <span className="text-xs font-mono text-foreground font-medium">
                    Stop #{index + 1}
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
                label={`Gradient Stop #${activeColorIndex + 1} Color`}
              />
            </div>
          )}
        </div>

        {/* Speed Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">
              Wave Propagation Speed
            </span>
            <span className="font-mono text-pink-400 font-bold">{speedMs} ms / cluster</span>
          </div>
          <Slider
            min={60}
            max={800}
            step={20}
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
          />

          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>⚡ Fast Surge (60ms)</span>
            <span>Balanced Pulse (200ms)</span>
            <span>Slow Drift (800ms)</span>
          </div>
        </div>

        {/* Direction Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sweep Direction
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDirection('left_to_right')}
              className={cn(
                'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                direction === 'left_to_right'
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/40 ring-1 ring-pink-500/30'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Left → Right
            </button>

            <button
              type="button"
              onClick={() => setDirection('right_to_left')}
              className={cn(
                'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                direction === 'right_to_left'
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/40 ring-1 ring-pink-500/30'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Right → Left
            </button>

            <button
              type="button"
              onClick={() => setDirection('bounce')}
              className={cn(
                'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                direction === 'bounce'
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/40 ring-1 ring-pink-500/30'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Ping-Pong
            </button>
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
            className="text-xs gap-1.5 shadow-lg shadow-pink-500/20"
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Wave Config
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
