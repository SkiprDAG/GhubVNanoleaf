import { request } from './client';
import {
  ApiResponse,
  ModeUpdatePayload,
  SolidModeUpdatePayload,
  AmbientModeUpdatePayload,
  VortexModeUpdatePayload,
  WaveModeUpdatePayload,
  PomodoroModeUpdatePayload,
  CircadianModeUpdatePayload,
  AudioModeUpdatePayload,
} from './types';


export const modesApi = {
  setMode: async (payload: ModeUpdatePayload): Promise<ApiResponse<{ active_mode: string; revision: number }>> => {
    return request<ApiResponse<{ active_mode: string; revision: number }>>('/mode', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSolidMode: async (payload: SolidModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/solid', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAmbientMode: async (payload: AmbientModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/ambient', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateVortexMode: async (payload: VortexModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/vortex', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateWaveMode: async (payload: WaveModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/wave', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePomodoroMode: async (payload: PomodoroModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/pomodoro', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCircadianMode: async (payload: CircadianModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/circadian', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAudioMode: async (payload: AudioModeUpdatePayload): Promise<ApiResponse> => {
    return request<ApiResponse>('/config/audio', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};




