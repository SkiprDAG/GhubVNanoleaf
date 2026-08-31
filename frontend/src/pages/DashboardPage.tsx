import React from 'react';
import { DeviceGrid } from '@/components/dashboard/DeviceGrid';
import { RenderStatusCard } from '@/components/dashboard/RenderStatusCard';
import { NanoleafWallVisualizer } from '@/components/visualizer/NanoleafWallVisualizer';
import { useSetupWizard } from '@/hooks/useSetupWizard';
import { useModes } from '@/hooks/useModes';
import { SystemStatusResponse, AppConfig, RenderAppliedEvent, RGBColor } from '@/api/types';
import {
  Laptop,
  Layers,
  Activity,
  Sparkles,
  BatteryCharging,
  Waves,
  Sun,
  Power,
  Timer,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { kelvinToRgbClient, getCircadianKelvinAtHour } from '@/components/modes/CircadianModeForm';

export interface DashboardPageProps {
  status?: SystemStatusResponse;
  config?: AppConfig;
  isLoading: boolean;
  lastRenderEvent: RenderAppliedEvent['data'] | null;
  lastEventTime: number | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  status,
  config,
  isLoading,
  lastRenderEvent,
  lastEventTime,
}) => {
  const { panels, identifyPanel, identifyingPanelId } = useSetupWizard();
  const { setMode, isSettingMode } = useModes();
  const devices = status?.devices || [];
  const mappings = config?.mapping?.devices || [];
  const activeMode = status?.active_mode || config?.mode?.active || 'battery';


  const chargingCount = devices.filter((d) => d.charging).length;
  const criticalCount = devices.filter((d) => d.critical).length;

  // Animation ticker for dynamic modes (ambient, vortex, wave, audio)
  const [animTick, setAnimTick] = React.useState(0);

  React.useEffect(() => {
    if (
      activeMode !== 'ambient' &&
      activeMode !== 'vortex' &&
      activeMode !== 'wave' &&
      activeMode !== 'pomodoro' &&
      activeMode !== 'audio'
    )
      return;

    let intervalMs = 40;
    let step = 0.05;

    if (activeMode === 'vortex') {
      const speedMs = config?.mode?.vortex?.speed_ms ?? 150;
      intervalMs = Math.max(20, Math.min(speedMs / 4, 50));
      step = intervalMs / speedMs;
    } else if (activeMode === 'wave') {
      const speedMs = config?.mode?.wave?.speed_ms ?? 200;
      intervalMs = Math.max(20, Math.min(speedMs / 4, 50));
      step = intervalMs / speedMs;
    } else if (activeMode === 'audio') {
      intervalMs = 30;
      step = 0.20;
    } else if (activeMode === 'ambient') {
      const transitionSeconds = Math.max(0.5, (config?.mode?.ambient?.transition_time ?? 10) * 0.1);
      intervalMs = 40;
      step = (intervalMs / 1000.0) / transitionSeconds;
    } else if (activeMode === 'pomodoro') {
      intervalMs = 1000;
      step = 1;
    }

    const interval = setInterval(() => {
      setAnimTick((t) => (t + step) % 1000);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [
    activeMode,
    config?.mode?.ambient?.transition_time,
    config?.mode?.ambient?.palette,
    config?.mode?.vortex?.speed_ms,
    config?.mode?.wave?.speed_ms,
  ]);

  // Build live panel colors map reflecting actual lighting mode and battery sectioning
  const panelColorsMap: Record<number, RGBColor> = React.useMemo(() => {
    const map: Record<number, RGBColor> = {};

    if (activeMode === 'off') {
      for (const p of panels) {
        map[p.panel_id] = [0, 0, 0];
      }
      return map;
    }

    if (activeMode === 'solid') {
      const solidColor = config?.mode?.solid?.color || [125, 42, 207];
      const factor = config?.mode?.solid?.factor ?? 0.5;
      const r = Math.round(solidColor[0] * factor);
      const g = Math.round(solidColor[1] * factor);
      const b = Math.round(solidColor[2] * factor);
      for (const p of panels) {
        map[p.panel_id] = [r, g, b];
      }
      return map;
    }

    if (activeMode === 'audio') {
      const audioCfg = config?.mode?.audio;
      const bassColor = audioCfg?.bass_color || [255, 0, 80];
      const midColor = audioCfg?.mid_color || [0, 220, 255];
      const highColor = audioCfg?.high_color || [255, 230, 0];
      const minB = audioCfg?.min_brightness ?? 0.08;

      const clusterColors = [bassColor, midColor, highColor];

      mappings.forEach((m, gIdx) => {
        const clusterColor = clusterColors[gIdx % clusterColors.length];

        m.panel_ids.forEach((pid, pIdx) => {

          // Dynamic rhythm energy wave per cluster
          const harmonicBeat = 0.5 + 0.5 * Math.sin(animTick * 2.5 + gIdx * 1.8 + pIdx * 0.8);
          const energy = minB + (0.95 - minB) * Math.pow(harmonicBeat, 2);

          map[pid] = [
            Math.round(clusterColor[0] * energy),
            Math.round(clusterColor[1] * energy),
            Math.round(clusterColor[2] * energy),
          ];
        });
      });
      return map;
    }


    if (activeMode === 'vortex') {
      const palette = config?.mode?.vortex?.palette || [
        [0, 225, 255],
        [213, 0, 255],
        [255, 0, 119],
      ];
      const clockwise = config?.mode?.vortex?.clockwise ?? true;
      const trailLength = config?.mode?.vortex?.trail_length ?? 3;
      const trailWeights = [1.0, 0.55, 0.25, 0.10, 0.04].slice(0, trailLength);

      mappings.forEach((m, gIdx) => {
        const clusterColor = palette[gIdx % palette.length];
        const numPanels = m.panel_ids.length;
        if (numPanels === 0) return;

        const orderedIds = clockwise ? m.panel_ids : [...m.panel_ids].reverse();
        const currentHead = Math.floor(animTick) % numPanels;

        orderedIds.forEach((pid, pIdx) => {
          const dist = (currentHead - pIdx + numPanels) % numPanels;
          const weight = dist < trailWeights.length ? trailWeights[dist] : 0.04;
          map[pid] = [
            Math.round(clusterColor[0] * weight),
            Math.round(clusterColor[1] * weight),
            Math.round(clusterColor[2] * weight),
          ];
        });
      });
      return map;
    }

    if (activeMode === 'wave') {
      const palette = config?.mode?.wave?.palette || [
        [0, 240, 255],
        [160, 32, 240],
        [255, 20, 147],
      ];
      const direction = config?.mode?.wave?.direction || 'left_to_right';
      const numGroups = mappings.length;
      const trailWeights = [1.0, 0.45, 0.15, 0.04];

      let stepsOrder = Array.from({ length: numGroups }, (_, i) => i);
      if (direction === 'right_to_left') {
        stepsOrder = stepsOrder.reverse();
      } else if (direction === 'bounce' && numGroups > 2) {
        stepsOrder = [...stepsOrder, ...stepsOrder.slice(1, -1).reverse()];
      }

      const totalSteps = stepsOrder.length;
      const currentStep = Math.floor(animTick) % (totalSteps || 1);
      const activeGroup = stepsOrder[currentStep];

      mappings.forEach((m, gIdx) => {
        const groupColor = palette[gIdx % palette.length];
        const dist = Math.abs(activeGroup - gIdx);
        const weight = dist < trailWeights.length ? trailWeights[dist] : 0.04;

        const r = Math.round(groupColor[0] * weight);
        const g = Math.round(groupColor[1] * weight);
        const b = Math.round(groupColor[2] * weight);

        for (const pid of m.panel_ids) {
          map[pid] = [r, g, b];
        }
      });
      return map;
    }

    if (activeMode === 'pomodoro') {
      const pomo = config?.mode?.pomodoro;
      const state = pomo?.state || 'idle';
      const focusColor = pomo?.focus_color || [255, 140, 0];
      const breakColor = pomo?.break_color || [0, 200, 255];
      const activeColor = state === 'break' ? breakColor : focusColor;

      const totalDurationSec = (state === 'break' ? (pomo?.break_duration_min ?? 5) : (pomo?.work_duration_min ?? 25)) * 60;
      const elapsedSec = pomo?.elapsed_seconds ?? 0;
      const progress = totalDurationSec > 0 ? Math.min(1.0, elapsedSec / totalDurationSec) : 0.0;

      // Ordered list of all panels
      const allOrderedPanelIds: number[] = [];
      mappings.forEach((m) => {
        m.panel_ids.forEach((pid) => {
          if (!allOrderedPanelIds.includes(pid)) allOrderedPanelIds.push(pid);
        });
      });

      const numPanels = allOrderedPanelIds.length || 18;
      const litThreshold = progress * numPanels;

      allOrderedPanelIds.forEach((pid, idx) => {
        if (state === 'idle') {
          map[pid] = [
            Math.round(focusColor[0] * 0.15),
            Math.round(focusColor[1] * 0.15),
            Math.round(focusColor[2] * 0.15),
          ];
        } else if (idx < Math.floor(litThreshold)) {
          map[pid] = [
            Math.round(activeColor[0] * 0.75),
            Math.round(activeColor[1] * 0.75),
            Math.round(activeColor[2] * 0.75),
          ];
        } else if (idx === Math.floor(litThreshold)) {
          const rem = litThreshold - Math.floor(litThreshold);
          const weight = 0.15 + 0.60 * rem;
          map[pid] = [
            Math.round(activeColor[0] * weight),
            Math.round(activeColor[1] * weight),
            Math.round(activeColor[2] * weight),
          ];
        } else {
          map[pid] = [
            Math.round(activeColor[0] * 0.05),
            Math.round(activeColor[1] * 0.05),
            Math.round(activeColor[2] * 0.05),
          ];
        }
      });
      return map;
    }

    if (activeMode === 'circadian') {
      const circ = config?.mode?.circadian;
      const minK = circ?.min_temp_k ?? 1800;
      const maxK = circ?.max_temp_k ?? 6500;
      const factor = circ?.brightness_factor ?? 0.7;

      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60.0;
      const targetKelvin = getCircadianKelvinAtHour(currentHour, minK, maxK);
      const baseRgb = kelvinToRgbClient(targetKelvin);

      const r = Math.round(baseRgb[0] * factor);
      const g = Math.round(baseRgb[1] * factor);
      const b = Math.round(baseRgb[2] * factor);

      for (const p of panels) {
        map[p.panel_id] = [r, g, b];
      }
      return map;
    }

    if (activeMode === 'ambient') {
      const palette = config?.mode?.ambient?.palette || [
        [20, 152, 179],
        [169, 35, 179],
        [182, 47, 101],
      ];
      const numColors = palette.length;
      const minB = config?.mode?.ambient?.min_brightness_factor ?? 0.18;
      const maxB = config?.mode?.ambient?.max_brightness_factor ?? 0.6;
      const phaseOffset = config?.mode?.ambient?.phase_offset_per_group ?? 0.5;

      mappings.forEach((m, gIdx) => {
        // Continuous position along the cyclic palette
        const continuousPos = ((animTick + gIdx * (phaseOffset || 0.5)) % numColors + numColors) % numColors;
        const colorIdx1 = Math.floor(continuousPos) % numColors;
        const colorIdx2 = (colorIdx1 + 1) % numColors;
        const progress = continuousPos - Math.floor(continuousPos); // 0.0 -> 1.0

        const c1 = palette[colorIdx1];
        const c2 = palette[colorIdx2];

        // Smooth cosine brightness modulation matching AmbientMode backend
        const cosineVal = 0.5 + 0.5 * Math.cos(2.0 * Math.PI * progress);
        const brightness = minB + (maxB - minB) * cosineVal;

        // Smooth RGB interpolation between c1 and c2
        const r = Math.round((c1[0] + (c2[0] - c1[0]) * progress) * brightness);
        const g = Math.round((c1[1] + (c2[1] - c1[1]) * progress) * brightness);
        const b = Math.round((c1[2] + (c2[2] - c1[2]) * progress) * brightness);

        for (const pid of m.panel_ids) {
          map[pid] = [r, g, b];
        }
      });

      // Default color for unmapped panels in ambient mode
      for (const p of panels) {
        if (!map[p.panel_id]) {
          const pal = palette[0];
          map[p.panel_id] = [Math.round(pal[0] * minB), Math.round(pal[1] * minB), Math.round(pal[2] * minB)];
        }
      }
      return map;
    }



    // Battery Mode: calculate exact panel sectioning
    const logic = config?.logic;
    const minFactor = logic?.brightness_scale?.min_factor ?? 0.08;
    const maxFactor = logic?.brightness_scale?.max_factor ?? 0.6;
    const isScaleEnabled = logic?.brightness_scale?.enabled ?? true;

    for (const m of mappings) {
      const dev = devices.find((d) => d.name.toLowerCase().includes(m.match.toLowerCase()));
      // If device not discovered yet, default to 100
      const percentage = dev?.percentage !== undefined ? Math.max(0, Math.min(dev.percentage, 100)) : 100;
      const baseCol = m.base_color;
      const count = m.panel_ids.length;

      if (count === 0) continue;

      const sectionSize = 100.0 / count;

      for (let i = 0; i < count; i++) {
        const pid = m.panel_ids[i];
        const sectionStart = i * sectionSize;
        const sectionCharge = Math.max(0, Math.min(percentage - sectionStart, sectionSize));
        const chargeFactor = Math.max(0, Math.min(sectionCharge / sectionSize, 1.0));

        if (chargeFactor <= 0.0001) {
          // Panel is completely off
          map[pid] = [0, 0, 0];
        } else {
          // Scaled brightness
          const brightness = isScaleEnabled
            ? minFactor + (maxFactor - minFactor) * chargeFactor
            : chargeFactor;

          const r = Math.round(baseCol[0] * brightness);
          const g = Math.round(baseCol[1] * brightness);
          const b = Math.round(baseCol[2] * brightness);
          map[pid] = [r, g, b];
        }
      }
    }

    return map;
  }, [devices, mappings, panels, activeMode, config, animTick]);



  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="glass-card rounded-2xl p-4 border border-border/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Logitech Devices</div>
            <div className="text-xl font-bold font-mono text-foreground">{devices.length}</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
            <BatteryCharging className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Charging</div>
            <div className="text-xl font-bold font-mono text-sky-400">{chargingCount}</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Critical Alerts</div>
            <div className="text-xl font-bold font-mono text-rose-400">{criticalCount}</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-border/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Mapped Groups</div>
            <div className="text-xl font-bold font-mono text-emerald-400">{mappings.length}</div>
          </div>
        </div>
      </div>

      {/* Quick Lighting Mode Selector */}
      <div className="glass-card rounded-2xl p-4 border border-border/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Active Lighting Mode
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Switch physical wall lighting profile in 1 click
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-mono">Active:</span>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase tracking-wide border',
                activeMode === 'battery' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                activeMode === 'ambient' && 'bg-purple-500/15 text-purple-400 border-purple-500/30 animate-pulse',
                activeMode === 'vortex' && 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 animate-pulse',
                activeMode === 'wave' && 'bg-pink-500/15 text-pink-400 border-pink-500/30 animate-pulse',
                activeMode === 'audio' && 'bg-purple-500/15 text-purple-400 border-purple-500/30 animate-pulse',
                activeMode === 'pomodoro' && 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse',
                activeMode === 'circadian' && 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                activeMode === 'solid' && 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                activeMode === 'off' && 'bg-slate-500/15 text-slate-400 border-slate-500/30'
              )}
            >
              {activeMode}
            </span>
          </div>
        </div>

        {/* 9 Interactive Mode Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {/* Battery Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'battery' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'battery'
                ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <BatteryCharging className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'battery' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Battery</div>
              <div className="text-[9px] text-muted-foreground">Charge level</div>
            </div>
          </button>

          {/* Ambient Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'ambient' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'ambient'
                ? 'bg-purple-500/15 border-purple-500 ring-2 ring-purple-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <Waves className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'ambient' && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Ambient</div>
              <div className="text-[9px] text-muted-foreground">Cyclic wave</div>
            </div>
          </button>

          {/* Vortex Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'vortex' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'vortex'
                ? 'bg-cyan-500/15 border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'vortex' && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Vortex</div>
              <div className="text-[9px] text-muted-foreground">3 turbines</div>
            </div>
          </button>

          {/* Wave Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'wave' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'wave'
                ? 'bg-pink-500/15 border-pink-500 ring-2 ring-pink-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'wave' && (
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_6px_#f43f5e]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Neon Wave</div>
              <div className="text-[9px] text-muted-foreground">Sweep pulse</div>
            </div>
          </button>

          {/* Audio Reactive Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'audio' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'audio'
                ? 'bg-purple-500/15 border-purple-500 ring-2 ring-purple-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <Volume2 className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'audio' && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Audio</div>
              <div className="text-[9px] text-muted-foreground">Spectrograph</div>
            </div>
          </button>

          {/* Pomodoro Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'pomodoro' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'pomodoro'
                ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Timer className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'pomodoro' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Pomodoro</div>
              <div className="text-[9px] text-muted-foreground">Focus timer</div>
            </div>
          </button>

          {/* Circadian Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'circadian' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'circadian'
                ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
                <Sun className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'circadian' && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#fb923c]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Circadian</div>
              <div className="text-[9px] text-muted-foreground">Solar curve</div>
            </div>
          </button>

          {/* Solid Color Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'solid' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'solid'
                ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Sun className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'solid' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Solid</div>
              <div className="text-[9px] text-muted-foreground">Single hue</div>
            </div>
          </button>

          {/* Off Mode */}
          <button
            type="button"
            disabled={isSettingMode}
            onClick={() => setMode({ mode: 'off' })}
            className={cn(
              'p-2.5 rounded-xl border flex flex-col items-start gap-1 transition-all text-left group cursor-pointer select-none',
              activeMode === 'off'
                ? 'bg-slate-500/20 border-slate-400 ring-2 ring-slate-400/30 shadow-lg'
                : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 rounded-lg bg-slate-500/20 text-slate-400">
                <Power className="w-3.5 h-3.5" />
              </div>
              {activeMode === 'off' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shadow-[0_0_6px_#94a3b8]" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Turn Off</div>
              <div className="text-[9px] text-muted-foreground">Blackout</div>
            </div>
          </button>
        </div>
      </div>



      {/* Live Physical Wall Visualizer */}
      {panels.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Physical Nanoleaf Wall Layout
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              Live Topology ({panels.length} Panels)
            </span>
          </div>

          <NanoleafWallVisualizer
            panels={panels}
            mappings={mappings}

            panelColorsMap={panelColorsMap}
            identifyingPanelId={identifyingPanelId}
            onIdentifyPanel={(pid) => identifyPanel({ panelId: pid })}
            mode="live"
          />
        </div>
      )}


      {/* Device Cards Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Connected Devices &amp; Battery Status
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {devices.length} Active {devices.length === 1 ? 'Device' : 'Devices'}
          </span>
        </div>

        <DeviceGrid devices={devices} mappings={mappings} isLoading={isLoading} />
      </div>

      {/* Render Status & Hardware Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Nanoleaf Live Pipeline
        </h2>

        <RenderStatusCard
          activeMode={activeMode}
          fingerprint={status?.last_fingerprint}
          configRevision={status?.config_revision || config?.revision}
          lastRenderEvent={lastRenderEvent}
          lastEventTime={lastEventTime}
        />
      </div>
    </div>
  );
};

