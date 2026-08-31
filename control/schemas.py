from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class DeviceColorUpdate(BaseModel):
    match: str = Field(..., min_length=1, description="Device substring match")
    base_color: list[int] = Field(..., min_length=3, max_length=3, description="RGB color [0-255]")


class BrightnessScaleUpdate(BaseModel):
    enabled: bool | None = None
    min_factor: float | None = Field(None, ge=0.0, le=1.0)
    max_factor: float | None = Field(None, ge=0.0, le=1.0)


class EffectUpdate(BaseModel):
    name: str
    config: dict[str, Any]


class ModeUpdate(BaseModel):
    mode: str = Field(..., description="Mode name (e.g. battery, solid, off, ambient)")


class ApiResponse(BaseModel):
    ok: bool = True
    message: str | None = None
    data: dict[str, Any] | None = None


class ThresholdsUpdate(BaseModel):
    critical: int = Field(..., ge=0, le=100, description="Percentage threshold for critical battery")


class SolidModeUpdate(BaseModel):
    color: list[int] | None = Field(None, min_length=3, max_length=3, description="RGB color [0-255]")
    factor: float | None = Field(None, ge=0.0, le=1.0, description="Brightness factor")
    transition_time: int | None = Field(None, ge=0, description="Transition time in tenths of seconds")


class AmbientModeUpdate(BaseModel):
    enabled: bool | None = None
    palette: list[list[int]] | None = Field(None, min_length=2, max_length=6, description="Palette of 2-6 RGB colors")
    min_brightness_factor: float | None = Field(None, ge=0.0, le=1.0)
    max_brightness_factor: float | None = Field(None, ge=0.0, le=1.0)
    transition_time: int | None = Field(None, ge=1)
    phase_offset_per_group: float | None = Field(None, ge=0.0, le=1.0)

    @field_validator("palette", mode="after")
    @classmethod
    def validate_palette(cls, v: list[list[int]] | None) -> list[list[int]] | None:
        if v is None:
            return None
        if not (2 <= len(v) <= 6):
            raise ValueError("Palette must contain between 2 and 6 colors")
        for c in v:
            if len(c) != 3 or any(not (0 <= int(ch) <= 255) for ch in c):
                raise ValueError(f"RGB color {c} must have 3 channels in range 0..255")
        return [[int(ch) for ch in c] for c in v]


class VortexModeUpdate(BaseModel):

    enabled: bool | None = None
    palette: list[list[int]] | None = Field(None, min_length=1, max_length=6, description="Palette of 1-6 RGB colors")
    speed_ms: int | None = Field(None, ge=30, le=1000)
    clockwise: bool | None = None
    trail_length: int | None = Field(None, ge=1, le=5)

    @field_validator("palette", mode="after")
    @classmethod
    def validate_palette(cls, v: list[list[int]] | None) -> list[list[int]] | None:
        if v is None:
            return None
        if not (1 <= len(v) <= 6):
            raise ValueError("Palette must contain between 1 and 6 colors")
        for c in v:
            if len(c) != 3 or any(not (0 <= int(ch) <= 255) for ch in c):
                raise ValueError(f"RGB color {c} must have 3 channels in range 0..255")
        return [[int(ch) for ch in c] for c in v]


class WaveModeUpdate(BaseModel):
    enabled: bool | None = None
    palette: list[list[int]] | None = Field(None, min_length=1, max_length=6, description="Palette of 1-6 RGB colors")
    speed_ms: int | None = Field(None, ge=50, le=2000)
    direction: str | None = None

    @field_validator("palette", mode="after")
    @classmethod
    def validate_palette(cls, v: list[list[int]] | None) -> list[list[int]] | None:
        if v is None:
            return None
        if not (1 <= len(v) <= 6):
            raise ValueError("Palette must contain between 1 and 6 colors")
        for c in v:
            if len(c) != 3 or any(not (0 <= int(ch) <= 255) for ch in c):
                raise ValueError(f"RGB color {c} must have 3 channels in range 0..255")
        return [[int(ch) for ch in c] for c in v]




class PomodoroModeUpdate(BaseModel):
    enabled: bool | None = None
    work_duration_min: int | None = Field(None, ge=1, le=120)
    break_duration_min: int | None = Field(None, ge=1, le=60)
    long_break_min: int | None = Field(None, ge=1, le=60)
    cycles_before_long_break: int | None = Field(None, ge=1, le=10)
    focus_color: list[int] | None = Field(None, min_length=3, max_length=3)
    break_color: list[int] | None = Field(None, min_length=3, max_length=3)
    state: str | None = None
    elapsed_seconds: int | None = Field(None, ge=0)
    current_cycle: int | None = Field(None, ge=1)

    @field_validator("focus_color", "break_color", mode="after")
    @classmethod
    def validate_color(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        if len(v) != 3 or any(not (0 <= int(ch) <= 255) for ch in v):
            raise ValueError("RGB color must have 3 channels in range 0..255")
        return [int(ch) for ch in v]


class CircadianModeUpdate(BaseModel):
    enabled: bool | None = None
    min_temp_k: int | None = Field(None, ge=1000, le=4000)
    max_temp_k: int | None = Field(None, ge=4000, le=10000)
    brightness_factor: float | None = Field(None, ge=0.0, le=1.0)
    transition_time: int | None = Field(None, ge=1)


class AudioModeUpdate(BaseModel):
    enabled: bool | None = None
    preset: str | None = None
    sensitivity: float | None = Field(None, ge=0.1, le=5.0)
    bass_color: list[int] | None = Field(None, min_length=3, max_length=3)
    mid_color: list[int] | None = Field(None, min_length=3, max_length=3)
    high_color: list[int] | None = Field(None, min_length=3, max_length=3)
    decay_speed: float | None = Field(None, ge=0.1, le=0.99)
    min_brightness: float | None = Field(None, ge=0.0, le=0.5)

    @field_validator("bass_color", "mid_color", "high_color", mode="after")
    @classmethod
    def validate_color(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        if len(v) != 3 or any(not (0 <= int(ch) <= 255) for ch in v):
            raise ValueError("RGB color must have 3 channels in range 0..255")
        return [int(ch) for ch in v]


class DeviceMappingCreate(BaseModel):

    match: str = Field(..., min_length=1, description="Device substring match")

    label: str = Field(..., min_length=1, description="Human-readable label")
    panel_ids: list[int] = Field(default_factory=list, description="Panel IDs assigned to device")
    base_color: list[int] = Field(..., min_length=3, max_length=3, description="RGB color [0-255]")


class SystemStatusResponse(BaseModel):
    active_mode: str
    available_modes: list[str]
    config_revision: int
    last_fingerprint: str | None = None
    devices: list[dict[str, Any]]


# --- Setup & Mapping Wizard DTOs ---

class DiscoveredDeviceItem(BaseModel):
    device_id: str
    name: str
    device_type: str
    has_battery: bool
    battery: dict[str, Any] | None = None
    is_mapped: bool = False
    mapped_match: str | None = None
    mapped_label: str | None = None
    mapped_base_color: list[int] | None = None
    mapped_panel_ids: list[int] = Field(default_factory=list)


class DiscoveredDevicesResponse(BaseModel):
    devices: list[DiscoveredDeviceItem]


class DiscoveredPanelItem(BaseModel):
    panel_id: int
    is_assigned: bool
    assigned_group_match: str | None = None
    assigned_group_label: str | None = None
    has_conflict: bool = False
    conflict_group_labels: list[str] = Field(default_factory=list)
    x: float = 0.0
    y: float = 0.0
    orientation: float = 0.0
    shape_type: int = 0
    side_length: int = 100



class DiscoveredPanelsResponse(BaseModel):
    panels: list[DiscoveredPanelItem]


class IdentifyPanelRequest(BaseModel):
    color: list[int] = Field(default_factory=lambda: [255, 255, 255])
    duration_ms: int = Field(1500, ge=100, le=10000)

    @field_validator("color", mode="after")
    @classmethod
    def validate_color(cls, v: list[int]) -> list[int]:
        if len(v) != 3 or any(not (0 <= int(c) <= 255) for c in v):
            raise ValueError("RGB color must have 3 channels in range 0..255")
        return [int(c) for c in v]


class IdentifyCycleRequest(BaseModel):
    panel_ids: list[int] = Field(..., min_length=1)
    color: list[int] = Field(default_factory=lambda: [255, 255, 255])
    step_duration_ms: int = Field(1000, ge=200, le=10000)
    repeat: bool = True

    @field_validator("color", mode="after")
    @classmethod
    def validate_color(cls, v: list[int]) -> list[int]:
        if len(v) != 3 or any(not (0 <= int(c) <= 255) for c in v):
            raise ValueError("RGB color must have 3 channels in range 0..255")
        return [int(c) for c in v]


class PreviewGroupRequest(BaseModel):
    panel_ids: list[int] = Field(..., min_length=1)
    color: list[int] = Field(..., min_length=3, max_length=3)
    transition_time: int = Field(2, ge=0, le=100)

    @field_validator("color", mode="after")
    @classmethod
    def validate_color(cls, v: list[int]) -> list[int]:
        if len(v) != 3 or any(not (0 <= int(c) <= 255) for c in v):
            raise ValueError("RGB color must have 3 channels in range 0..255")
        return [int(c) for c in v]


class SetupSessionStateResponse(BaseModel):
    active: bool
    preview_active: bool
    identifying_panel_id: int | None = None
    cycle_running: bool
    generation: int


class SetupSaveMappingRequest(BaseModel):
    match: str = Field(..., min_length=1, description="Substring match for device")
    label: str = Field(..., min_length=1, description="Human readable group label")
    panel_ids: list[int] = Field(..., min_length=1, description="Assigned panel IDs in physical order")
    base_color: list[int] = Field(..., min_length=3, max_length=3, description="Base RGB color [0..255]")

    @field_validator("base_color", mode="after")
    @classmethod
    def validate_base_color(cls, v: list[int]) -> list[int]:
        if len(v) != 3 or any(not (0 <= int(c) <= 255) for c in v):
            raise ValueError("RGB color must have 3 channels in range 0..255")
        return [int(c) for c in v]


