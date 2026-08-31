import { request } from './client';
import { ApiResponse, SystemStatusResponse } from './types';

export const statusApi = {
  getStatus: async (): Promise<SystemStatusResponse> => {
    return request<SystemStatusResponse>('/status');
  },

  forceRenderApply: async (): Promise<ApiResponse<{ fingerprint?: string }>> => {
    return request<ApiResponse<{ fingerprint?: string }>>('/render/apply', {
      method: 'POST',
    });
  },
};
