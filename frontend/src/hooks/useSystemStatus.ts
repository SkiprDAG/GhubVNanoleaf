import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { statusApi } from '@/api/status';
import { SystemStatusResponse } from '@/api/types';
import { useToast } from './useToast';

export function useSystemStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const statusQuery = useQuery<SystemStatusResponse>({
    queryKey: ['status'],
    queryFn: statusApi.getStatus,
    staleTime: 60000, // Relies on WebSocket for real-time updates
    refetchOnWindowFocus: true,
  });

  const reapplyMutation = useMutation({
    mutationFn: statusApi.forceRenderApply,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      toast.success('Render Applied', res.message || 'Nanoleaf plan updated');
    },
    onError: (err: Error) => {
      toast.error('Render Failed', err.message);
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    error: statusQuery.error,
    refetch: statusQuery.refetch,
    reapply: reapplyMutation.mutate,
    isReapplying: reapplyMutation.isPending,
  };
}
