import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '@/api/setup';
import {
  DiscoveredDeviceItem,
  DiscoveredPanelItem,
  SetupSessionState,
  RGBColor,
  SetupSaveMappingPayload,
} from '@/api/types';
import { useToast } from './useToast';

export function useSetupWizard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [flashingPanelId, setFlashingPanelId] = useState<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const devicesQuery = useQuery<{ devices: DiscoveredDeviceItem[] }>({
    queryKey: ['setup_devices'],
    queryFn: setupApi.getDiscoveredDevices,
    staleTime: 5000,
  });

  const panelsQuery = useQuery<{ panels: DiscoveredPanelItem[] }>({
    queryKey: ['setup_panels'],
    queryFn: setupApi.getDiscoveredPanels,
    staleTime: 5000,
  });

  const sessionQuery = useQuery<SetupSessionState>({
    queryKey: ['setup_session'],
    queryFn: setupApi.getSessionState,
    staleTime: 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.cycle_running) return 600;
      if (data?.identifying_panel_id || flashingPanelId !== null) return 400;
      return false;
    },
  });

  const identifyPanelMutation = useMutation({
    mutationFn: ({ panelId, color, duration_ms }: { panelId: number; color?: RGBColor; duration_ms?: number }) =>
      setupApi.identifyPanel(panelId, { color, duration_ms }),
    onMutate: (variables) => {
      setFlashingPanelId(variables.panelId);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      const dur = variables.duration_ms || 1500;
      flashTimerRef.current = setTimeout(() => {
        setFlashingPanelId(null);
        queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      }, dur + 80);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      toast.info('Panel Flashing', `Panel #${variables.panelId} is now illuminated`);
    },
    onError: (err: Error) => {
      setFlashingPanelId(null);
      toast.error('Identification Failed', err.message);
    },
  });


  const startCycleMutation = useMutation({
    mutationFn: ({
      panelIds,
      color,
      step_duration_ms,
      repeat,
    }: {
      panelIds: number[];
      color?: RGBColor;
      step_duration_ms?: number;
      repeat?: boolean;
    }) => setupApi.startIdentifyCycle({ panel_ids: panelIds, color, step_duration_ms, repeat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      toast.info('Auto-Walk Active', 'Sequentially flashing panels in cycle');
    },
    onError: (err: Error) => {
      toast.error('Cycle Failed', err.message);
    },
  });

  const stopCycleMutation = useMutation({
    mutationFn: setupApi.stopIdentifyCycle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      toast.info('Cycle Stopped', 'Normal lighting restored');
    },
    onError: (err: Error) => {
      toast.error('Stop Failed', err.message);
    },
  });

  const previewGroupMutation = useMutation({
    mutationFn: ({ panelIds, color, transition_time }: { panelIds: number[]; color: RGBColor; transition_time?: number }) =>
      setupApi.previewGroup({ panel_ids: panelIds, color, transition_time }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      toast.info('Preview Active', 'Temporary group color applied to panels');
    },
    onError: (err: Error) => {
      toast.error('Preview Failed', err.message);
    },
  });

  const clearPreviewMutation = useMutation({
    mutationFn: setupApi.clearPreview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      toast.info('Preview Cleared', 'Normal lighting restored');
    },
    onError: (err: Error) => {
      toast.error('Clear Preview Failed', err.message);
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: (payload: SetupSaveMappingPayload) => setupApi.saveLayoutGroup(payload.match, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['setup_devices'] });
      queryClient.invalidateQueries({ queryKey: ['setup_panels'] });
      queryClient.invalidateQueries({ queryKey: ['setup_session'] });
      toast.success('Mapping Saved & Applied', `Device group '${variables.label}' configured!`);
    },
    onError: (err: Error) => {
      toast.error('Save Mapping Failed', err.message);
    },
  });

  return {
    devices: devicesQuery.data?.devices || [],
    isLoadingDevices: devicesQuery.isLoading,
    refetchDevices: devicesQuery.refetch,

    panels: panelsQuery.data?.panels || [],
    isLoadingPanels: panelsQuery.isLoading,
    refetchPanels: panelsQuery.refetch,

    session: sessionQuery.data,
    refetchSession: sessionQuery.refetch,
    identifyingPanelId: flashingPanelId ?? sessionQuery.data?.identifying_panel_id ?? null,

    identifyPanel: identifyPanelMutation.mutateAsync,
    isIdentifying: identifyPanelMutation.isPending || flashingPanelId !== null,


    startCycle: startCycleMutation.mutateAsync,
    isStartingCycle: startCycleMutation.isPending,

    stopCycle: stopCycleMutation.mutateAsync,
    isStoppingCycle: stopCycleMutation.isPending,

    previewGroup: previewGroupMutation.mutateAsync,
    isPreviewing: previewGroupMutation.isPending,

    clearPreview: clearPreviewMutation.mutateAsync,
    isClearingPreview: clearPreviewMutation.isPending,

    saveMapping: saveMappingMutation.mutateAsync,
    isSavingMapping: saveMappingMutation.isPending,
  };
}
