import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import {
  AppConfig,
  DeviceColorUpdatePayload,
  BrightnessScaleUpdatePayload,
  EffectUpdatePayload,
  ThresholdsUpdatePayload,
  DeviceMappingCreatePayload,
} from '@/api/types';
import { useToast } from './useToast';

export function useAppConfig() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const configQuery = useQuery<AppConfig>({
    queryKey: ['config'],
    queryFn: configApi.getConfig,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  const fullConfigMutation = useMutation({
    mutationFn: (cfg: AppConfig) => configApi.updateFullConfig(cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Configuration Saved', 'All settings applied and saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Save Config', err.message);
    },
  });

  const deviceColorMutation = useMutation({
    mutationFn: (payload: DeviceColorUpdatePayload) => configApi.updateDeviceColor(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Device Color Updated', `Color updated for ${variables.match}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Color', err.message);
    },
  });

  const brightnessScaleMutation = useMutation({
    mutationFn: (payload: BrightnessScaleUpdatePayload) => configApi.updateBrightnessScale(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Brightness Scaling Updated');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Brightness', err.message);
    },
  });

  const effectMutation = useMutation({
    mutationFn: (payload: EffectUpdatePayload) => configApi.updateEffect(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success(`Effect Updated`, `Updated settings for ${variables.name}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Effect', err.message);
    },
  });

  const thresholdsMutation = useMutation({
    mutationFn: (payload: ThresholdsUpdatePayload) => configApi.updateThresholds(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Threshold Updated', 'Critical battery threshold saved');
    },
    onError: (err: Error) => {
      toast.error('Failed to Update Threshold', err.message);
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: (payload: DeviceMappingCreatePayload) => configApi.saveDeviceMapping(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Device Group Saved', `Group ${variables.label} updated`);
    },
    onError: (err: Error) => {
      toast.error('Failed to Save Group', err.message);
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (match: string) => configApi.deleteDeviceMapping(match),
    onSuccess: (_, match) => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Device Group Deleted', `Removed ${match}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to Delete Group', err.message);
    },
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    isError: configQuery.isError,
    error: configQuery.error,
    refetch: configQuery.refetch,
    saveFullConfig: fullConfigMutation.mutateAsync,
    isSavingFullConfig: fullConfigMutation.isPending,
    updateDeviceColor: deviceColorMutation.mutateAsync,
    isUpdatingColor: deviceColorMutation.isPending,
    updateBrightnessScale: brightnessScaleMutation.mutateAsync,
    isUpdatingBrightness: brightnessScaleMutation.isPending,
    updateEffect: effectMutation.mutateAsync,
    isUpdatingEffect: effectMutation.isPending,
    updateThresholds: thresholdsMutation.mutateAsync,
    isUpdatingThresholds: thresholdsMutation.isPending,
    saveMapping: saveMappingMutation.mutateAsync,
    isSavingMapping: saveMappingMutation.isPending,
    deleteMapping: deleteMappingMutation.mutateAsync,
    isDeletingMapping: deleteMappingMutation.isPending,
  };
}
