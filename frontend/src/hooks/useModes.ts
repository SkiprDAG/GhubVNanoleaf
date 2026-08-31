import { useMutation, useQueryClient } from '@tanstack/react-query';
import { modesApi } from '@/api/modes';
import {
  ModeUpdatePayload,
  SolidModeUpdatePayload,
  AmbientModeUpdatePayload,
  VortexModeUpdatePayload,
  WaveModeUpdatePayload,
  PomodoroModeUpdatePayload,
  CircadianModeUpdatePayload,
  AudioModeUpdatePayload,
  SystemStatusResponse,
  AppConfig,
} from '@/api/types';
import { useToast } from './useToast';

export function useModes() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const setModeMutation = useMutation({
    mutationFn: (payload: ModeUpdatePayload) => modesApi.setMode(payload),
    onMutate: async (newMode) => {
      await queryClient.cancelQueries({ queryKey: ['status'] });
      await queryClient.cancelQueries({ queryKey: ['config'] });

      const previousStatus = queryClient.getQueryData<SystemStatusResponse>(['status']);
      const previousConfig = queryClient.getQueryData<AppConfig>(['config']);

      if (previousStatus) {
        queryClient.setQueryData<SystemStatusResponse>(['status'], {
          ...previousStatus,
          active_mode: newMode.mode,
        });
      }

      if (previousConfig) {
        queryClient.setQueryData<AppConfig>(['config'], {
          ...previousConfig,
          mode: {
            ...previousConfig.mode,
            active: newMode.mode,
          },
        });
      }

      return { previousStatus, previousConfig };
    },
    onError: (err: Error, _, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(['status'], context.previousStatus);
      }
      if (context?.previousConfig) {
        queryClient.setQueryData(['config'], context.previousConfig);
      }
      toast.error('Mode Switch Failed', err.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success('Mode Activated', `Switched lighting to ${variables.mode.toUpperCase()}`);
    },
  });

  const solidModeMutation = useMutation({
    mutationFn: (payload: SolidModeUpdatePayload) => modesApi.updateSolidMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Solid Mode Updated', 'New color and transition parameters saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Solid Mode', err.message);
    },
  });

  const ambientModeMutation = useMutation({
    mutationFn: (payload: AmbientModeUpdatePayload) => modesApi.updateAmbientMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Ambient Mode Updated', 'New palette and wave parameters saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Ambient Mode', err.message);
    },
  });

  const vortexModeMutation = useMutation({
    mutationFn: (payload: VortexModeUpdatePayload) => modesApi.updateVortexMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Vortex Mode Updated', 'Turbine rotation and palette saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Vortex Mode', err.message);
    },
  });

  const waveModeMutation = useMutation({
    mutationFn: (payload: WaveModeUpdatePayload) => modesApi.updateWaveMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Wave Mode Updated', 'Horizontal wave speed and sweep saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Wave Mode', err.message);
    },
  });

  const pomodoroModeMutation = useMutation({
    mutationFn: (payload: PomodoroModeUpdatePayload) => modesApi.updatePomodoroMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Pomodoro Updated', 'Focus timer parameters saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Pomodoro', err.message);
    },
  });

  const circadianModeMutation = useMutation({
    mutationFn: (payload: CircadianModeUpdatePayload) => modesApi.updateCircadianMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Circadian Rhythm Updated', 'Sunlight temperature curve saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Circadian Mode', err.message);
    },
  });

  const audioModeMutation = useMutation({
    mutationFn: (payload: AudioModeUpdatePayload) => modesApi.updateAudioMode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Audio Reactive Updated', 'Spectrum equalizer and colors saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Audio Mode', err.message);
    },
  });

  return {
    setMode: setModeMutation.mutateAsync,
    isSettingMode: setModeMutation.isPending,
    updateSolidMode: solidModeMutation.mutateAsync,
    isUpdatingSolidMode: solidModeMutation.isPending,
    updateAmbientMode: ambientModeMutation.mutateAsync,
    isUpdatingAmbientMode: ambientModeMutation.isPending,
    updateVortexMode: vortexModeMutation.mutateAsync,
    isUpdatingVortexMode: vortexModeMutation.isPending,
    updateWaveMode: waveModeMutation.mutateAsync,
    isUpdatingWaveMode: waveModeMutation.isPending,
    updatePomodoroMode: pomodoroModeMutation.mutateAsync,
    isUpdatingPomodoroMode: pomodoroModeMutation.isPending,
    updateCircadianMode: circadianModeMutation.mutateAsync,
    isUpdatingCircadianMode: circadianModeMutation.isPending,
    updateAudioMode: audioModeMutation.mutateAsync,
    isUpdatingAudioMode: audioModeMutation.isPending,
  };
}




