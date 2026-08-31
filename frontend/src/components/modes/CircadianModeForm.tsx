import React, { useState, useEffect } from 'react';
import { CircadianModeConfig } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { Sun, Moon, Sunrise, Sunset, Save, Check } from 'lucide-react';
import { rgbToCss } from '@/lib/utils';

export interface CircadianModeFormProps {
  circadianConfig: CircadianModeConfig;
  onSave: (payload: {
    min_temp_k?: number;
    max_temp_k?: number;
    brightness_factor?: number;
    transition_time?: number;
  }) => Promise<unknown>;
  isSaving?: boolean;
}

export function kelvinToRgbClient(tempK: number): [number, number, number] {
  const temp = Math.max(1000, Math.min(12000, tempK)) / 100.0;
  let red = 255;
  let green = 255;
  let blue = 255;

  // Red
  if (temp <= 66) {
    red = 255;
  } else {
    red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    red = Math.max(0, Math.min(255, red));
  }

  // Green
  if (temp <= 66) {
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
    green = Math.max(0, Math.min(255, green));
  } else {
    green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    green = Math.max(0, Math.min(255, green));
  }

  // Blue
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    blue = Math.max(0, Math.min(255, blue));
  }

  return [Math.round(red), Math.round(green), Math.round(blue)];
}

export function getCircadianKelvinAtHour(hour: number, minK = 1800, maxK = 6500): number {
  const h = (hour + 24) % 24;
  if (h >= 0 && h < 6) return minK;
  if (h >= 6 && h < 9) return minK + ((4500 - minK) * (h - 6)) / 3;
  if (h >= 9 && h < 14) return 4500 + (maxK - 4500) * Math.sin(((h - 9) / 5) * Math.PI * 0.5);
  if (h >= 14 && h < 18) return maxK - ((maxK - 4800) * (h - 14)) / 4;
  if (h >= 18 && h < 21) return 4800 - ((4800 - 2400) * (h - 18)) / 3;
  return 2400 - ((2400 - minK) * (h - 21)) / 3;
}

export const CircadianModeForm: React.FC<CircadianModeFormProps> = ({
  circadianConfig,
  onSave,
  isSaving = false,
}) => {
  const [minTemp, setMinTemp] = useState(circadianConfig.min_temp_k ?? 1800);
  const [maxTemp, setMaxTemp] = useState(circadianConfig.max_temp_k ?? 6500);
  const [brightness, setBrightness] = useState(circadianConfig.brightness_factor ?? 0.7);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinTemp(circadianConfig.min_temp_k ?? 1800);
    setMaxTemp(circadianConfig.max_temp_k ?? 6500);
    setBrightness(circadianConfig.brightness_factor ?? 0.7);
  }, [circadianConfig]);

  const now = new Date();
  const currentHourFloat = now.getHours() + now.getMinutes() / 60.0;
  const currentKelvin = Math.round(getCircadianKelvinAtHour(currentHourFloat, minTemp, maxTemp));
  const currentRgb = kelvinToRgbClient(currentKelvin);

  const handleSave = async () => {
    setError(null);
    try {
      await onSave({
        min_temp_k: minTemp,
        max_temp_k: maxTemp,
        brightness_factor: brightness,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Circadian config');
    }
  };

  return (
    <Card className="glass-card border-border/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Circadian Sunlight Rhythm</CardTitle>
            <CardDescription>
              Wall colors dynamically follow natural 24h sunlight: energizing 6500K daylight at noon, soft 1800K amber at sunset
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="p-6 space-y-6 pt-0">
        {/* Live Spectrum & Current Status */}
        <div className="p-5 rounded-2xl bg-secondary/30 border border-border space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-xl border border-border shadow-md shrink-0 transition-colors"
                style={{ backgroundColor: rgbToCss(currentRgb) }}
              />
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Solar Output
                </div>
                <div className="text-base font-bold font-mono text-foreground">
                  {currentKelvin} K{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({currentHourFloat < 6 ? 'Night Wind-down' : currentHourFloat < 11 ? 'Morning Rise' : currentHourFloat < 17 ? 'Peak Daylight' : 'Sunset Amber'})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold">
                Time: {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* 24-Hour Solar Gradient Timeline */}
          <div className="space-y-1.5 pt-2">
            <div className="relative h-6 rounded-xl overflow-hidden border border-border/80 shadow-inner bg-black flex">
              {Array.from({ length: 24 }).map((_, h) => {
                const k = getCircadianKelvinAtHour(h, minTemp, maxTemp);
                const rgb = kelvinToRgbClient(k);
                return (
                  <div
                    key={h}
                    className="flex-1 h-full"
                    style={{ backgroundColor: rgbToCss(rgb) }}
                    title={`${h}:00 - ${Math.round(k)}K`}
                  />
                );
              })}

              {/* Current Time Pin Marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] -translate-x-1/2"
                style={{ left: `${(currentHourFloat / 24.0) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
              <span className="flex items-center gap-0.5"><Moon className="w-3 h-3 text-slate-400" /> 00:00 (Night)</span>
              <span className="flex items-center gap-0.5"><Sunrise className="w-3 h-3 text-amber-400" /> 07:00 (Sunrise)</span>
              <span className="flex items-center gap-0.5"><Sun className="w-3 h-3 text-sky-400" /> 13:00 (Noon)</span>
              <span className="flex items-center gap-0.5"><Sunset className="w-3 h-3 text-orange-400" /> 19:00 (Sunset)</span>
              <span className="flex items-center gap-0.5"><Moon className="w-3 h-3 text-slate-400" /> 23:59</span>
            </div>
          </div>
        </div>

        {/* Sliders: Min Kelvin, Max Kelvin, Max Brightness */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Night Min Temp
              </span>
              <span className="font-mono text-orange-400 font-bold">{minTemp} K</span>
            </div>
            <Slider
              min={1200}
              max={3000}
              step={100}
              value={minTemp}
              onChange={(e) => setMinTemp(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Daylight Max Temp
              </span>
              <span className="font-mono text-sky-400 font-bold">{maxTemp} K</span>
            </div>
            <Slider
              min={4500}
              max={8000}
              step={100}
              value={maxTemp}
              onChange={(e) => setMaxTemp(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Max Brightness
              </span>
              <span className="font-mono text-amber-400 font-bold">{Math.round(brightness * 100)}%</span>
            </div>
            <Slider
              min={0.1}
              max={1.0}
              step={0.05}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs gap-1.5 shadow-lg shadow-orange-500/20"
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Circadian Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
