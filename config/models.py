from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


def _validate_rgb(value: list[int] | tuple[int, ...]) -> list[int]:
    if len(value) != 3:
        raise ValueError("RGB color must have exactly 3 elements [r, g, b]")
    for channel in value:
        if not (0 <= int(channel) <= 255):
            raise ValueError(f"RGB channel value {channel} is outside 0..255")
    return [int(c) for c in value]



class DeviceMappingConfig(BaseModel):
    match: str = Field(..., min_length=1, description="Device name substring match")
    label: str = Field(..., description="Human-readable label for device group")
    panel_ids: list[int] = Field(default_factory=list, description="Panel IDs assigned to device")
    base_color: list[int] = Field(default_factory=lambda: [255, 255, 255], description="Base RGB color")

    @field_validator("base_color", mode="after")
    @classmethod
    def validate_base_color(cls, v: list[int]) -> list[int]:
        return _validate_rgb(v)


class BrightnessScaleConfig(BaseModel):
    enabled: bool = Field(True, description="Enable non-linear brightness scaling")
    min_factor: float = Field(0.08, ge=0.0, le=1.0, description="Minimum brightness scale factor")
    max_factor: float = Field(0.8, ge=0.0, le=1.0, description="Maximum brightness scale factor")


class ChargingPartialEffectConfig(BaseModel):
    pulse_transition_time: int = Field(25, ge=1, description="Transition time for partial charging pulse")
    min_factor: float = Field(0.15, ge=0.0, le=1.0, description="Min brightness factor for charging blink")
    max_factor: float = Field(1.0, ge=0.0, le=1.0, description="Max brightness factor for charging blink")


class ChargingFullEffectConfig(BaseModel):
    pulse_transition_time: int = Field(25, ge=1, description="Transition time for full charging pulse")
    min_factor: float = Field(0.25, ge=0.0, le=1.0, description="Min brightness factor for full charging pulse")
    max_factor: float = Field(0.8, ge=0.0, le=1.0, description="Max brightness factor for full charging pulse")


class CriticalEffectConfig(BaseModel):
    pulse_transition_time: int = Field(15, ge=1, description="Transition time for critical battery warning pulse")
    warning_color: list[int] = Field(default_factory=lambda: [255, 0, 0], description="Warning pulse RGB color")

    @field_validator("warning_color", mode="after")
    @classmethod
    def validate_warning_color(cls, v: list[int]) -> list[int]:
        return _validate_rgb(v)


class EffectsConfig(BaseModel):
    charging_partial: ChargingPartialEffectConfig = Field(default_factory=ChargingPartialEffectConfig)
    charging_full: ChargingFullEffectConfig = Field(default_factory=ChargingFullEffectConfig)
    critical: CriticalEffectConfig = Field(default_factory=CriticalEffectConfig)


class LogicThresholdsConfig(BaseModel):
    critical: int = Field(10, ge=0, le=100, description="Percentage threshold for critical battery")


class LogicConfig(BaseModel):
    transition_time: int = Field(2, ge=0, description="Default transition time in tenths of seconds")
    white_channel: int = Field(0, ge=0, le=255, description="White channel value for RGBW panels")
    brightness_scale: BrightnessScaleConfig = Field(default_factory=BrightnessScaleConfig)
    thresholds: LogicThresholdsConfig = Field(default_factory=LogicThresholdsConfig)
    effects: EffectsConfig = Field(default_factory=EffectsConfig)


class SolidModeConfig(BaseModel):
    color: list[int] = Field(default_factory=lambda: [20, 80, 255], description="Solid color RGB")
    factor: float = Field(1.0, ge=0.0, le=1.0, description="Brightness multiplier")
    transition_time: int = Field(2, ge=0, description="Transition time for solid mode")

    @field_validator("color", mode="after")
    @classmethod
    def validate_color(cls, v: list[int]) -> list[int]:
        return _validate_rgb(v)


class BatteryModeConfig(BaseModel):
    show_critical_warning: bool = Field(True, description="Show pulsing critical warning")


class AmbientModeConfig(BaseModel):
    enabled: bool = Field(True, description="Enable ambient mode")
    palette: list[list[int]] = Field(
        default_factory=lambda: [
            [20, 70, 180],
            [35, 80, 180],
            [20, 160, 180],
        ],
        description="Palette of 2-6 RGB colors",
    )
    min_brightness_factor: float = Field(0.18, ge=0.0, le=1.0, description="Minimum brightness scale factor")
    max_brightness_factor: float = Field(0.75, ge=0.0, le=1.0, description="Maximum brightness scale factor")
    transition_time: int = Field(80, ge=1, description="Transition time for ambient frames in tenths of seconds")
    phase_offset_per_group: float = Field(0.15, ge=0.0, le=1.0, description="Phase shift offset factor per device group")

    @field_validator("palette", mode="after")
    @classmethod
    def validate_palette(cls, v: list[list[int]]) -> list[list[int]]:
        if not (2 <= len(v) <= 6):
            raise ValueError("Palette must contain between 2 and 6 colors")
        return [_validate_rgb(color) for color in v]

    @model_validator(mode="after")
    def validate_factors(self) -> AmbientModeConfig:
        if self.min_brightness_factor > self.max_brightness_factor:
            raise ValueError("min_brightness_factor cannot be greater than max_brightness_factor")
        return self


class VortexModeConfig(BaseModel):
    enabled: bool = Field(True, description="Enable vortex spinning turbine mode")
    palette: list[list[int]] = Field(
        default_factory=lambda: [
            [0, 225, 255],   # Cyan
            [213, 0, 255],   # Purple
            [255, 0, 119],   # Pink
        ],
        description="Palette of 1-6 RGB colors for the vortex turbines",
    )
    speed_ms: int = Field(150, ge=30, le=1000, description="Step duration in milliseconds")
    clockwise: bool = Field(True, description="Spin clockwise or counter-clockwise")
    trail_length: int = Field(3, ge=1, le=5, description="Number of trailing dimmed panels")

    @field_validator("palette", mode="after")
    @classmethod
    def validate_palette(cls, v: list[list[int]]) -> list[list[int]]:
        if not (1 <= len(v) <= 6):
            raise ValueError("Palette must contain between 1 and 6 colors")
        return [_validate_rgb(color) for color in v]


class WaveModeConfig(BaseModel):
    enabled: bool = Field(True, description="Enable horizontal wave sweep mode")
    palette: list[list[int]] = Field(
        default_factory=lambda: [
            [0, 240, 255],   # Electric Cyan
            [160, 32, 240],  # Purple
            [255, 20, 147],  # Neon Pink
        ],
        description="Palette of 1-6 RGB colors for the wave",
    )
    speed_ms: int = Field(200, ge=50, le=2000, description="Wave step duration in milliseconds")
    direction: str = Field("left_to_right", description="Wave direction (left_to_right, right_to_left, bounce)")

    @field_validator("palette", mode="after")
    @classmethod
    def validate_palette(cls, v: list[list[int]]) -> list[list[int]]:
        if not (1 <= len(v) <= 6):
            raise ValueError("Palette must contain between 1 and 6 colors")
        return [_validate_rgb(color) for color in v]


class PomodoroModeConfig(BaseModel):
    enabled: bool = Field(True, description="Enable pomodoro focus timer mode")
    work_duration_min: int = Field(25, ge=1, le=120, description="Work sprint duration in minutes")
    break_duration_min: int = Field(5, ge=1, le=60, description="Short break duration in minutes")
    long_break_min: int = Field(15, ge=1, le=60, description="Long break duration in minutes")
    cycles_before_long_break: int = Field(4, ge=1, le=10, description="Cycles before a long break")
    focus_color: list[int] = Field(default_factory=lambda: [255, 140, 0], description="Warm Amber Focus RGB")
    break_color: list[int] = Field(default_factory=lambda: [0, 200, 255], description="Cool Azure Break RGB")
    state: str = Field("idle", description="Current timer state: idle, work, break, paused")
    elapsed_seconds: int = Field(0, ge=0, description="Elapsed seconds in current interval")
    current_cycle: int = Field(1, ge=1, description="Current pomodoro cycle")

    @field_validator("focus_color", "break_color", mode="after")
    @classmethod
    def validate_rgb_colors(cls, v: list[int]) -> list[int]:
        return _validate_rgb(v)


class CircadianModeConfig(BaseModel):
    enabled: bool = Field(True, description="Enable 24h circadian sunlight lighting")
    min_temp_k: int = Field(1800, ge=1000, le=4000, description="Warmest night temperature in Kelvin")
    max_temp_k: int = Field(6500, ge=4000, le=10000, description="Coolest daylight temperature in Kelvin")
    brightness_factor: float = Field(0.7, ge=0.0, le=1.0, description="Max brightness multiplier")
    transition_time: int = Field(50, ge=1, description="Transition time in tenths of seconds")


class AudioModeConfig(BaseModel):
    enabled: bool = Field(True, description="Enable audio reactive music visualizer")
    preset: str = Field("3band_eq", description="Audio mode preset: 3band_eq, vu_meter, freq_wave")
    sensitivity: float = Field(1.0, ge=0.1, le=5.0, description="Audio reactivity multiplier")
    bass_color: list[int] = Field(default_factory=lambda: [255, 0, 80], description="Bass beat RGB")
    mid_color: list[int] = Field(default_factory=lambda: [0, 220, 255], description="Mid vocal RGB")
    high_color: list[int] = Field(default_factory=lambda: [255, 230, 0], description="High treble RGB")
    decay_speed: float = Field(0.85, ge=0.1, le=0.99, description="Signal decay multiplier")
    min_brightness: float = Field(0.08, ge=0.0, le=0.5, description="Idle baseline brightness")

    @field_validator("bass_color", "mid_color", "high_color", mode="after")
    @classmethod
    def validate_rgb_colors(cls, v: list[int]) -> list[int]:
        return _validate_rgb(v)


class ModeConfig(BaseModel):
    active: str = Field("battery", description="Active lighting mode (battery, solid, off, ambient, vortex, wave, pomodoro, circadian, audio)")
    battery: BatteryModeConfig = Field(default_factory=BatteryModeConfig)
    solid: SolidModeConfig = Field(default_factory=SolidModeConfig)
    ambient: AmbientModeConfig = Field(default_factory=AmbientModeConfig)
    vortex: VortexModeConfig = Field(default_factory=VortexModeConfig)
    wave: WaveModeConfig = Field(default_factory=WaveModeConfig)
    pomodoro: PomodoroModeConfig = Field(default_factory=PomodoroModeConfig)
    circadian: CircadianModeConfig = Field(default_factory=CircadianModeConfig)
    audio: AudioModeConfig = Field(default_factory=AudioModeConfig)






class AgentServerConfig(BaseModel):
    enabled: bool = Field(True, description="Allow remote PC agents to connect and stream battery/audio")
    pc_offline_action: str = Field("off", description="Fallback mode when PC goes offline: off, circadian, keep_last, ambient")
    pc_offline_timeout_sec: float = Field(15.0, ge=3.0, le=300.0, description="Seconds without heartbeat before marking PC offline")


class MappingConfig(BaseModel):
    devices: list[DeviceMappingConfig] = Field(default_factory=list)


class AppConfig(BaseModel):
    revision: int = Field(1, ge=1, description="Config revision counter for cache invalidation")
    mode: ModeConfig = Field(default_factory=ModeConfig)
    logic: LogicConfig = Field(default_factory=LogicConfig)
    mapping: MappingConfig = Field(default_factory=MappingConfig)
    agent: AgentServerConfig = Field(default_factory=AgentServerConfig)

    def model_dump_json_dict(self) -> dict[str, Any]:
        """
        Serializes model into clean JSON-serializable dict.
        Сериализует модель в чистый dict для JSON без лишних объектов.
        """
        return self.model_dump(mode="json")
