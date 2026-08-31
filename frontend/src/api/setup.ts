import { request } from './client';
import {
  ApiResponse,
  DiscoveredDevicesResponse,
  DiscoveredPanelsResponse,
  IdentifyPanelPayload,
  IdentifyCyclePayload,
  PreviewGroupPayload,
  SetupSessionState,
  SetupSaveMappingPayload,
} from './types';

export const setupApi = {
  getDiscoveredDevices: async (): Promise<DiscoveredDevicesResponse> => {
    return request<DiscoveredDevicesResponse>('/setup/devices');
  },

  getDiscoveredPanels: async (): Promise<DiscoveredPanelsResponse> => {
    return request<DiscoveredPanelsResponse>('/setup/panels');
  },

  getSessionState: async (): Promise<SetupSessionState> => {
    return request<SetupSessionState>('/setup/session');
  },

  startSession: async (): Promise<SetupSessionState> => {
    return request<SetupSessionState>('/setup/session/start', {
      method: 'POST',
    });
  },

  stopSession: async (): Promise<ApiResponse> => {
    return request<ApiResponse>('/setup/session/stop', {
      method: 'POST',
    });
  },

  identifyPanel: async (panelId: number, payload: IdentifyPanelPayload = {}): Promise<ApiResponse> => {
    return request<ApiResponse>(`/setup/panels/${panelId}/identify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  startIdentifyCycle: async (payload: IdentifyCyclePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/setup/panels/identify-cycle/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  stopIdentifyCycle: async (): Promise<ApiResponse> => {
    return request<ApiResponse>('/setup/panels/identify-cycle/stop', {
      method: 'POST',
    });
  },

  previewGroup: async (payload: PreviewGroupPayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/setup/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  clearPreview: async (): Promise<ApiResponse> => {
    return request<ApiResponse>('/setup/preview/clear', {
      method: 'POST',
    });
  },

  saveLayoutGroup: async (groupMatch: string, payload: SetupSaveMappingPayload): Promise<ApiResponse> => {
    return request<ApiResponse>(`/config/layout/groups/${encodeURIComponent(groupMatch)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
