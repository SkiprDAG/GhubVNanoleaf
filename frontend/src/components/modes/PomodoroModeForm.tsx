import React, { useState, useEffect } from 'react';
import { PomodoroModeConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { Timer, Play, Pause, RotateCcw, FastForward, Save, Check } from 'lucide-react';
import { rgbToCss, cn } from '@/lib/utils';

export interface PomodoroModeFormProps {
  pomodoroConfig: PomodoroModeConfig;
  onSave: (payload: {
    work_duration_min?: number;
    break_duration_min?: number;
    long_break_min?: number;
    cycles_before_long_break?: number;
    focus_color?: RGBColor;
    break_color?: RGBColor;
    state?: string;
    elapsed_seconds?: number;
    current_cycle?: number;
  }) => Promise<unknown>;
  isSaving?: boolean;
}

export const PomodoroModeForm: React.FC<PomodoroModeFormProps> = ({
  pomodoroConfig,
  onSave,
  isSaving = false,
}) => {
  const [workMin, setWorkMin] = useState(pomodoroConfig.work_duration_min ?? 25);
  const [breakMin, setBreakMin] = useState(pomodoroConfig.break_duration_min ?? 5);
  const [longBreakMin, setLongBreakMin] = useState(pomodoroConfig.long_break_min ?? 15);
  const [focusColor, setFocusColor] = useState<RGBColor>(pomodoroConfig.focus_color || [255, 140, 0]);
  const [breakColor, setBreakColor] = useState<RGBColor>(pomodoroConfig.break_color || [0, 200, 255]);
  const [state, setState] = useState(pomodoroConfig.state || 'idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(pomodoroConfig.elapsed_seconds ?? 0);
  const [cycle, setCycle] = useState(pomodoroConfig.current_cycle ?? 1);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWorkMin(pomodoroConfig.work_duration_min ?? 25);
    setBreakMin(pomodoroConfig.break_duration_min ?? 5);
    setLongBreakMin(pomodoroConfig.long_break_min ?? 15);
    setFocusColor(pomodoroConfig.focus_color || [255, 140, 0]);
    setBreakColor(pomodoroConfig.break_color || [0, 200, 255]);
    setState(pomodoroConfig.state || 'idle');
    setElapsedSeconds(pomodoroConfig.elapsed_seconds ?? 0);
    setCycle(pomodoroConfig.current_cycle ?? 1);
  }, [pomodoroConfig]);

  // Client-side 1-second countdown ticker when state is active for fluid UI display
  useEffect(() => {
    if (state !== 'work' && state !== 'break') return;

    const totalSeconds = (state === 'work' ? workMin : breakMin) * 60;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= totalSeconds) {
          return totalSeconds;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state, workMin, breakMin]);

  const totalCurrentDurationSec = (state === 'work' ? workMin : breakMin) * 60;
  const remainingSec = Math.max(0, totalCurrentDurationSec - elapsedSeconds);
  const minutesDisplay = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const secondsDisplay = String(remainingSec % 60).padStart(2, '0');
  const progressPercent = totalCurrentDurationSec > 0 ? (elapsedSeconds / totalCurrentDurationSec) * 100 : 0;

  const handleStartWork = async () => {
    setState('work');
    setElapsedSeconds(0);
    await onSave({ state: 'work', elapsed_seconds: 0 });
  };

  const handlePause = async () => {
    setState('paused');
    await onSave({ state: 'paused', elapsed_seconds: elapsedSeconds });
  };

  const handleResume = async () => {
    setState('work');
    await onSave({ state: 'work', elapsed_seconds: elapsedSeconds });
  };

  const handleReset = async () => {
    setState('idle');
    setElapsedSeconds(0);
    await onSave({ state: 'idle', elapsed_seconds: 0 });
  };

  const handleSkipToBreak = async () => {
    setState('break');
    setElapsedSeconds(0);
    await onSave({ state: 'break', elapsed_seconds: 0 });
  };

  const handleSaveConfig = async () => {
    setError(null);
    try {
      await onSave({
        work_duration_min: workMin,
        break_duration_min: breakMin,
        long_break_min: longBreakMin,
        focus_color: focusColor,
        break_color: breakColor,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Pomodoro config');
    }
  };

  return (
    <Card className="glass-card border-border/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Pomodoro Focus Timer &amp; Break Visualizer</CardTitle>
            <CardDescription>
              Wall panels fill up one by one in warm amber as your focus sprint progresses, transitioning to relaxing azure on break
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="p-6 space-y-6 pt-0">
        {/* Interactive Timer Banner */}
        <div className="p-6 rounded-2xl bg-secondary/30 border border-border flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-lg shrink-0 transition-colors"
              style={{
                borderColor: rgbToCss(state === 'break' ? breakColor : focusColor),
                boxShadow: `0 0 20px ${rgbToCss(state === 'break' ? breakColor : focusColor)}40`,
              }}
            >
              <div className="text-center">
                <span className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {minutesDisplay}:{secondsDisplay}
                </span>
                <span className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                  {state.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold font-mono uppercase tracking-wide border',
                    state === 'work' && 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    state === 'break' && 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                    state === 'idle' && 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                    state === 'paused' && 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  )}
                >
                  {state === 'work' ? '🔥 Focus Sprint' : state === 'break' ? '☕ Resting Break' : state.toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground font-mono">Cycle #{cycle}</span>
              </div>

              <div className="w-48 sm:w-64 h-2 rounded-full bg-secondary mt-3 overflow-hidden border border-border/50">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: rgbToCss(state === 'break' ? breakColor : focusColor),
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {Math.round(progressPercent)}% elapsed across 18 wall panels
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {state === 'idle' || state === 'paused' ? (
              <Button
                variant="primary"
                onClick={state === 'idle' ? handleStartWork : handleResume}
                className="gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                {state === 'idle' ? 'Start Focus (25m)' : 'Resume'}
              </Button>
            ) : (
              <Button variant="outline" onClick={handlePause} className="gap-1.5 border-border/80">
                <Pause className="w-4 h-4" />
                Pause
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleSkipToBreak}
              className="gap-1 text-xs border-border/60"
            >
              <FastForward className="w-3.5 h-3.5" />
              Skip
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Sprint Durations Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Work Sprint
              </span>
              <span className="font-mono text-amber-400 font-bold">{workMin} min</span>
            </div>
            <Slider
              min={5}
              max={90}
              step={5}
              value={workMin}
              onChange={(e) => setWorkMin(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Short Break
              </span>
              <span className="font-mono text-sky-400 font-bold">{breakMin} min</span>
            </div>
            <Slider
              min={1}
              max={30}
              step={1}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Long Break
              </span>
              <span className="font-mono text-sky-400 font-bold">{longBreakMin} min</span>
            </div>
            <Slider
              min={5}
              max={45}
              step={5}
              value={longBreakMin}
              onChange={(e) => setLongBreakMin(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Focus & Break Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/60">
            <ColorPickerField
              color={focusColor}
              onChange={setFocusColor}
              label="Focus Sprint Color (Active Work)"
            />
          </div>

          <div className="p-4 rounded-xl bg-secondary/20 border border-border/60">
            <ColorPickerField
              color={breakColor}
              onChange={setBreakColor}
              label="Break Rest Color (Relaxation)"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Save Settings */}
        <div className="flex justify-end pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="text-xs gap-1.5 shadow-lg shadow-amber-500/20"
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Pomodoro Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
