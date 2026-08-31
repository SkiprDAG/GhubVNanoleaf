/**
 * Strict TypeScript DTO definitions matching the FastAPI backend exactly.
 */

export type RGBColor = [number, number, number];

export interface DeviceStatus {
  device_id: string;
  name: string;
  percentage: number;
  charging: boolean;
  critical: boolean;
  fully_charged: boolean;
  mileage: number;
}

export interface SystemStatusResponse {
  active_mode: string;
  available_modes: string[];
  config_revision: number;
  last_fingerprint: string | null;
  devices: DeviceStatus[];
}

export interface DeviceMappingConfig {
  match: string;
  label: string;
  panel_ids: number[];
  base_color: RGBColor;
}

export interface BrightnessScaleConfig {
  enabled: boolean;
  min_factor: number;
  max_factor: number;
}

export interface ChargingPartialEffectConfig {
  pulse_transition_time: number;
  min_factor: number;
  max_factor: number;
}

export interface ChargingFullEffectConfig {
  pulse_transition_time: number;
  min_factor: number;
  max_factor: number;
}

export interface CriticalEffectConfig {
  pulse_transition_time: number;
  warning_color: RGBColor;
}

export interface EffectsConfig {
  charging_partial: ChargingPartialEffectConfig;
  charging_full: ChargingFullEffectConfig;
  critical: CriticalEffectConfig;
}

export interface LogicThresholdsConfig {
  critical: number;
}

export interface LogicConfig {
  transition_time: number;
  white_channel: number;
  brightness_scale: BrightnessScaleConfig;
  thresholds: LogicThresholdsConfig;
  effects: EffectsConfig;
}

export interface SolidModeConfig {
  color: RGBColor;
  factor: number;
  transition_time: number;
}

export interface BatteryModeConfig {
  show_critical_warning: boolean;
}

export interface AmbientModeConfig {
  enabled: boolean;
  palette: RGBColor[];
  min_brightness_factor: number;
  max_brightness_factor: number;
  transition_time: number;
  phase_offset_per_group: number;
}

export interface VortexModeConfig {
  enabled: boolean;
  palette: RGBColor[];
  speed_ms: number;
  clockwise: boolean;
  trail_length: number;
}

export interface WaveModeConfig {
  enabled: boolean;
  palette: RGBColor[];
  speed_ms: number;
  direction: string;
}

export interface PomodoroModeConfig {
  enabled: boolean;
  work_duration_min: number;
  break_duration_min: number;
  long_break_min: number;
  cycles_before_long_break: number;
  focus_color: RGBColor;
  break_color: RGBColor;
  state: 'idle' | 'work' | 'break' | 'paused';
  elapsed_seconds: number;
  current_cycle: number;
}

export interface CircadianModeConfig {
  enabled: boolean;
  min_temp_k: number;
  max_temp_k: number;
  brightness_factor: number;
  transition_time: number;
}

export interface AudioModeConfig {
  enabled: boolean;
  preset: string;
  sensitivity: number;
  bass_color: RGBColor;
  mid_color: RGBColor;
  high_color: RGBColor;
  decay_speed: number;
  min_brightness: number;
}

export interface ModeConfig {
  active: string;
  battery: BatteryModeConfig;
  solid: SolidModeConfig;
  ambient: AmbientModeConfig;
  vortex: VortexModeConfig;
  wave: WaveModeConfig;
  pomodoro: PomodoroModeConfig;
  circadian: CircadianModeConfig;
  audio: AudioModeConfig;
}

export interface MappingConfig {
  devices: DeviceMappingConfig[];
}

export interface AgentServerConfig {
  enabled: boolean;
  pc_offline_action: string;
  pc_offline_timeout_sec: number;
}

export interface AppConfig {
  revision: number;
  mode: ModeConfig;
  logic: LogicConfig;
  mapping: MappingConfig;
  agent?: AgentServerConfig;
}

export interface ApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  message?: string;
  data?: T;
}

// Request Payload Types
export interface ModeUpdatePayload {
  mode: string;
}

export interface DeviceColorUpdatePayload {
  match: string;
  base_color: RGBColor;
}

export interface BrightnessScaleUpdatePayload {
  enabled?: boolean;
  min_factor?: number;
  max_factor?: number;
}

export interface EffectUpdatePayload {
  name: 'charging_partial' | 'charging_full' | 'critical';
  config: Record<string, unknown>;
}

export interface ThresholdsUpdatePayload {
  critical: number;
}

export interface SolidModeUpdatePayload {
  color?: RGBColor;
  factor?: number;
  transition_time?: number;
}

export interface AmbientModeUpdatePayload {
  enabled?: boolean;
  palette?: RGBColor[];
  min_brightness_factor?: number;
  max_brightness_factor?: number;
  transition_time?: number;
  phase_offset_per_group?: number;
}

export interface VortexModeUpdatePayload {
  enabled?: boolean;
  palette?: RGBColor[];
  speed_ms?: number;
  clockwise?: boolean;
  trail_length?: number;
}

export interface WaveModeUpdatePayload {
  enabled?: boolean;
  palette?: RGBColor[];
  speed_ms?: number;
  direction?: string;
}

export interface PomodoroModeUpdatePayload {
  enabled?: boolean;
  work_duration_min?: number;
  break_duration_min?: number;
  long_break_min?: number;
  cycles_before_long_break?: number;
  focus_color?: RGBColor;
  break_color?: RGBColor;
  state?: string;
  elapsed_seconds?: number;
  current_cycle?: number;
}

export interface CircadianModeUpdatePayload {
  enabled?: boolean;
  min_temp_k?: number;
  max_temp_k?: number;
  brightness_factor?: number;
  transition_time?: number;
}

export interface AudioModeUpdatePayload {
  enabled?: boolean;
  preset?: string;
  sensitivity?: number;
  bass_color?: RGBColor;
  mid_color?: RGBColor;
  high_color?: RGBColor;
  decay_speed?: number;
  min_brightness?: number;
}



export interface DeviceMappingCreatePayload {
  match: string;
  label: string;
  panel_ids: number[];
  base_color: RGBColor;
}

// WebSocket Event Types
export interface InitialSnapshotEvent {
  event: 'initial_snapshot';
  timestamp: number;
  data: {
    status: SystemStatusResponse;
    config: AppConfig;
  };
}

export interface BatteryUpdatedEvent {
  event: 'battery_updated';
  timestamp: number;
  data: {
    device_id: string;
    name: string;
    percentage: number;
    charging: boolean;
    critical: boolean;
  };
}

export interface ConfigUpdatedEvent {
  event: 'config_updated';
  timestamp: number;
  data: {
    revision: number;
    active_mode: string;
  };
}

export interface RenderAppliedEvent {
  event: 'render_applied';
  timestamp: number;
  data: {
    fingerprint: string;
    anim_type: 'static' | 'custom';
    metadata: Record<string, unknown>;
  };
}

export type LightingWebSocketEvent =
  | InitialSnapshotEvent
  | BatteryUpdatedEvent
  | ConfigUpdatedEvent
  | RenderAppliedEvent;

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'error';

// Setup & Mapping Wizard Types
export interface DiscoveredDeviceItem {
  device_id: string;
  name: string;
  device_type: string;
  has_battery: boolean;
  battery?: {
    percentage: number;
    charging: boolean;
    critical: boolean;
    fully_charged: boolean;
  } | null;
  is_mapped: boolean;
  mapped_match?: string | null;
  mapped_label?: string | null;
  mapped_base_color?: RGBColor | null;
  mapped_panel_ids: number[];
}

export interface DiscoveredDevicesResponse {
  devices: DiscoveredDeviceItem[];
}

export interface DiscoveredPanelItem {
  panel_id: number;
  is_assigned: boolean;
  assigned_group_match?: string | null;
  assigned_group_label?: string | null;
  has_conflict: boolean;
  conflict_group_labels: string[];
  x?: number;
  y?: number;
  orientation?: number;
  shape_type?: number;
  side_length?: number;
}


export interface DiscoveredPanelsResponse {
  panels: DiscoveredPanelItem[];
}

export interface IdentifyPanelPayload {
  color?: RGBColor;
  duration_ms?: number;
}

export interface IdentifyCyclePayload {
  panel_ids: number[];
  color?: RGBColor;
  step_duration_ms?: number;
  repeat?: boolean;
}

export interface PreviewGroupPayload {
  panel_ids: number[];
  color: RGBColor;
  transition_time?: number;
}

export interface SetupSessionState {
  active: boolean;
  preview_active: boolean;
  identifying_panel_id: number | null;
  cycle_running: boolean;
  generation: number;
}

export interface SetupSaveMappingPayload {
  match: string;
  label: string;
  panel_ids: number[];
  base_color: RGBColor;
}

