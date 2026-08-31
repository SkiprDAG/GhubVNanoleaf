import { request } from './client';
import {
  AppConfig,
  ApiResponse,
  BrightnessScaleUpdatePayload,
  DeviceColorUpdatePayload,
  DeviceMappingCreatePayload,
  EffectUpdatePayload,
  ThresholdsUpdatePayload,
} from './types';

export const configApi = {
  getConfig: async (): Promise<AppConfig> => {
    return request<AppConfig>('/config');
  },

  updateFullConfig: async (config: AppConfig): Promise<ApiResponse<{ revision: number }>> => {
    return request<ApiResponse<{ revision: number }>>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  updateDeviceColor: async (
    payload: DeviceColorUpdatePayload
  ): Promise<ApiResponse<{ match: string; base_color: [number, number, number]; revision: number }>> => {
    return request<ApiResponse<{ match: string; base_color: [number, number, number]; revision: number }>>(
      '/config/device-color',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  updateBrightnessScale: async (payload: BrightnessScaleUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/brightness-scale', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateEffect: async (payload: EffectUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/effect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateThresholds: async (payload: ThresholdsUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/thresholds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  saveDeviceMapping: async (
    payload: DeviceMappingCreatePayload
  ): Promise<ApiResponse<{ revision: number }>> => {
    return request<ApiResponse<{ revision: number }>>('/config/mapping/device', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteDeviceMapping: async (match: string): Promise<ApiResponse<{ revision: number }>> => {
    return request<ApiResponse<{ revision: number }>>(`/config/mapping/device/${encodeURIComponent(match)}`, {
      method: 'DELETE',
    });
  },
};
