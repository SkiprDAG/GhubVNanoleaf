import React from 'react';
import { AppConfig, RGBColor } from '@/api/types';
import { ModeSelector } from '@/components/modes/ModeSelector';
import { BatteryModeForm } from '@/components/modes/BatteryModeForm';
import { AmbientModeForm } from '@/components/modes/AmbientModeForm';
import { VortexModeForm } from '@/components/modes/VortexModeForm';
import { WaveModeForm } from '@/components/modes/WaveModeForm';
import { PomodoroModeForm } from '@/components/modes/PomodoroModeForm';
import { CircadianModeForm } from '@/components/modes/CircadianModeForm';
import { AudioModeForm } from '@/components/modes/AudioModeForm';
import { SolidModeForm } from '@/components/modes/SolidModeForm';
import { OffModeControl } from '@/components/modes/OffModeControl';
import { Skeleton } from '@/components/ui/Skeleton';

export interface ModesPageProps {
  config?: AppConfig;
  activeMode?: string;
  isLoading: boolean;
  onSetMode: (mode: string) => Promise<unknown>;
  onSaveFullConfig: (cfg: AppConfig) => Promise<unknown>;
  onUpdateSolidMode: (payload: { color: [number, number, number]; factor: number; transition_time: number }) => Promise<unknown>;
  onUpdateAmbientMode: (payload: {
    palette: RGBColor[];
    min_brightness_factor: number;
    max_brightness_factor: number;
    transition_time: number;
    phase_offset_per_group: number;
  }) => Promise<unknown>;
  onUpdateVortexMode: (payload: {
    palette: RGBColor[];
    speed_ms: number;
    clockwise: boolean;
    trail_length: number;
  }) => Promise<unknown>;
  onUpdateWaveMode: (payload: {
    palette: RGBColor[];
    speed_ms: number;
    direction: string;
  }) => Promise<unknown>;
  onUpdatePomodoroMode: (payload: {
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
  onUpdateCircadianMode: (payload: {
    min_temp_k?: number;
    max_temp_k?: number;
    brightness_factor?: number;
    transition_time?: number;
  }) => Promise<unknown>;
  onUpdateAudioMode: (payload: {
    preset?: string;
    sensitivity?: number;
    bass_color?: RGBColor;
    mid_color?: RGBColor;
    high_color?: RGBColor;
    decay_speed?: number;
    min_brightness?: number;
  }) => Promise<unknown>;
  isSettingMode: boolean;
  isSavingConfig: boolean;
}

export const ModesPage: React.FC<ModesPageProps> = ({
  config,
  activeMode = 'battery',
  isLoading,
  onSetMode,
  onSaveFullConfig,
  onUpdateSolidMode,
  onUpdateAmbientMode,
  onUpdateVortexMode,
  onUpdateWaveMode,
  onUpdatePomodoroMode,
  onUpdateCircadianMode,
  onUpdateAudioMode,
  isSettingMode,
  isSavingConfig,
}) => {
  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const currentMode = (activeMode || config.mode.active || 'battery').toLowerCase();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-foreground">Lighting Modes &amp; Effects</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select the active Nanoleaf illumination engine and customize mode-specific behaviors
        </p>
      </div>

      {/* Mode Selector Cards */}
      <ModeSelector
        activeMode={currentMode}
        onSelectMode={async (m) => {
          await onSetMode(m);
        }}
        isLoading={isSettingMode}
      />

      {/* Mode Specific Settings */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Mode Customization
        </h3>

        {/* Audio Reactive Visualizer Form */}
        <AudioModeForm
          audioConfig={config.mode.audio}
          onSave={onUpdateAudioMode}
          isSaving={isSavingConfig}
        />

        {/* Pomodoro Focus Timer Form */}
        <PomodoroModeForm
          pomodoroConfig={config.mode.pomodoro}
          onSave={onUpdatePomodoroMode}
          isSaving={isSavingConfig}
        />


        {/* Circadian Sunlight Rhythm Form */}
        <CircadianModeForm
          circadianConfig={config.mode.circadian}
          onSave={onUpdateCircadianMode}
          isSaving={isSavingConfig}
        />

        {/* Vortex Turbine Mode Form */}
        <VortexModeForm
          vortexConfig={config.mode.vortex}
          onSave={onUpdateVortexMode}
          isSaving={isSavingConfig}
        />

        {/* Wave Mode Form */}
        <WaveModeForm
          waveConfig={config.mode.wave}
          onSave={onUpdateWaveMode}
          isSaving={isSavingConfig}
        />

        {/* Battery Mode Form */}
        <BatteryModeForm
          config={config}
          onSaveFullConfig={onSaveFullConfig}
          isSaving={isSavingConfig}
        />

        {/* Ambient Mode Form */}
        <AmbientModeForm
          ambientConfig={config.mode.ambient}
          onSave={onUpdateAmbientMode}
          isSaving={isSavingConfig}
        />

        {/* Solid Mode Form */}
        <SolidModeForm
          solidConfig={config.mode.solid}
          onSave={async (payload) => {
            await onUpdateSolidMode(payload);
          }}
          isSaving={isSavingConfig}
        />

        {/* Off Mode Control */}
        <OffModeControl
          isActive={currentMode === 'off'}
          onTurnOff={async () => {
            await onSetMode('off');
          }}
          isLoading={isSettingMode}
        />
      </div>
    </div>
  );
};


