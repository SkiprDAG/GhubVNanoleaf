from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config.manager import ConfigManager
from config.models import AppConfig
from lighting.service import LightingService

from .schemas import (
    AmbientModeUpdate,
    ApiResponse,
    AudioModeUpdate,
    BrightnessScaleUpdate,
    CircadianModeUpdate,
    DeviceColorUpdate,
    DeviceMappingCreate,
    DiscoveredDevicesResponse,
    DiscoveredPanelsResponse,
    EffectUpdate,
    IdentifyCycleRequest,
    IdentifyPanelRequest,
    ModeUpdate,
    PomodoroModeUpdate,
    PreviewGroupRequest,
    SetupSaveMappingRequest,
    SetupSessionStateResponse,
    SolidModeUpdate,
    SystemStatusResponse,
    ThresholdsUpdate,
    VortexModeUpdate,
    WaveModeUpdate,
)
from .service import ApiService

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GhubVNanoleaf Control API",
    description="HTTP & WebSocket API for Nanoleaf lighting control based on Logitech G HUB status / API для управления подсветкой Nanoleaf на основе статуса Logitech G HUB",
    version="1.0.0",
)

cors_env = os.getenv("CORS_ORIGINS", "").strip()
if cors_env == "*":
    cors_origins = ["*"]
elif cors_env:
    cors_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://nanoleaf.local:8000",
        "http://nanoleaf.local",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_api_service: ApiService | None = None


def init_api_service(
    config: ConfigManager,
    lighting: LightingService,
    source: Any | None = None,
    output: Any | None = None,
    setup_coordinator: Any | None = None,
    agent_manager: Any | None = None,
) -> ApiService:
    global _api_service
    _api_service = ApiService(
        config=config,
        lighting=lighting,
        source=source,
        output=output,
        setup=setup_coordinator,
        agent_manager=agent_manager,
    )
    app.state.api_service = _api_service
    return _api_service


def get_api_service() -> ApiService:
    if _api_service is None:
        raise RuntimeError("ApiService not initialized. Call init_api_service first.")
    return _api_service


@app.get("/status", response_model=SystemStatusResponse)
def get_status(service: ApiService = Depends(get_api_service)) -> dict[str, Any]:
    """
    Returns latest system status, battery snapshot, and active mode.
    Возвращает актуальный статус системы, список батарей и активный режим.
    """
    return service.lighting.get_status()


@app.get("/config")
def get_config(service: ApiService = Depends(get_api_service)) -> dict[str, Any]:
    """
    Returns current application configuration.
    Возвращает текущую конфигурацию приложения.
    """
    return service.config.raw()


@app.post("/mode")
async def set_mode(
    payload: ModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Switches active lighting mode.
    Переключает активный режим подсветки.
    """
    target_mode = payload.mode.strip().lower()
    available_modes = service.lighting._modes.names()
    if target_mode not in available_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown lighting mode: {payload.mode!r}. Available modes: {', '.join(sorted(available_modes))}",
        )

    try:
        service.config.set_active_mode(target_mode)
        service.config.save()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(
        ok=True,
        message=f"Mode switched to {payload.mode}",
        data={"active_mode": payload.mode, "revision": service.config.get_config().revision},
    )


@app.post("/config/device-color")
async def update_device_color(
    payload: DeviceColorUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates base color for device group and re-renders panels immediately.
    Обновляет базовый цвет группы устройств и мгновенно перерисовывает подсветку.
    """
    updated = service.config.update_device_mapping(
        match=payload.match,
        base_color=payload.base_color,
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Device mapping with match {payload.match!r} not found")

    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(
        ok=True,
        message="Device color updated",
        data={"match": payload.match, "base_color": payload.base_color, "revision": service.config.get_config().revision},
    )


@app.post("/config/brightness-scale")
async def update_brightness_scale(
    payload: BrightnessScaleUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates non-linear brightness scale settings.
    Обновляет параметры масштабирования яркости.
    """
    cfg = service.config

    if payload.enabled is not None:
        cfg.set_brightness_scale_enabled(payload.enabled)
    if payload.min_factor is not None:
        cfg.set_brightness_min_factor(payload.min_factor)
    if payload.max_factor is not None:
        cfg.set_brightness_max_factor(payload.max_factor)

    cfg.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Brightness scale updated")


@app.post("/config/effect")
async def update_effect(
    payload: EffectUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates animation effect parameters.
    Обновляет конфигурацию анимационного эффекта.
    """
    try:
        service.config.set_effect(payload.name, payload.config)
        service.config.save()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message=f"Effect {payload.name} updated")


@app.put("/config")
async def update_full_config(
    payload: AppConfig,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Completely replaces application configuration, saves to disk and renders updates.
    Полностью обновляет конфигурацию приложения, сохраняет на диск и применяет подсветку.
    """
    service.config.set_config(payload)
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(
        ok=True,
        message="Config updated successfully",
        data={"revision": service.config.get_config().revision},
    )


@app.post("/config/thresholds")
async def update_thresholds(
    payload: ThresholdsUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates battery threshold settings (critical battery percentage).
    Обновляет пороговые значения (critical battery percentage).
    """
    service.config.set_critical_threshold(payload.critical)
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Thresholds updated")


@app.post("/config/solid")
async def update_solid_mode(
    payload: SolidModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Solid mode settings (color, factor, transition_time).
    Обновляет параметры режима Solid (color, factor, transition_time).
    """
    cfg = service.config.get_config()
    if payload.color is not None:
        cfg.mode.solid.color = [int(c) for c in payload.color]
    if payload.factor is not None:
        cfg.mode.solid.factor = float(payload.factor)
    if payload.transition_time is not None:
        cfg.mode.solid.transition_time = int(payload.transition_time)

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Solid mode config updated")


@app.post("/config/ambient")
async def update_ambient_mode(
    payload: AmbientModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Ambient mode settings (palette, min/max factors, transition_time, phase_offset).
    Обновляет параметры режима Ambient (palette, min/max factors, transition_time, phase_offset).
    """
    cfg = service.config.get_config()
    amb = cfg.mode.ambient

    if payload.enabled is not None:
        amb.enabled = payload.enabled
    if payload.palette is not None:
        amb.palette = [[int(ch) for ch in c] for c in payload.palette]
    if payload.min_brightness_factor is not None:
        amb.min_brightness_factor = payload.min_brightness_factor
    if payload.max_brightness_factor is not None:
        amb.max_brightness_factor = payload.max_brightness_factor
    if payload.transition_time is not None:
        amb.transition_time = payload.transition_time
    if payload.phase_offset_per_group is not None:
        amb.phase_offset_per_group = payload.phase_offset_per_group

    if amb.min_brightness_factor > amb.max_brightness_factor:
        raise HTTPException(
            status_code=400,
            detail="min_brightness_factor cannot be greater than max_brightness_factor",
        )

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Ambient mode config updated")


@app.post("/config/vortex")
async def update_vortex_mode(
    payload: VortexModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Vortex mode settings (palette, speed_ms, clockwise, trail_length).
    Обновляет параметры режима Vortex (palette, speed_ms, clockwise, trail_length).
    """
    cfg = service.config.get_config()
    vort = cfg.mode.vortex

    if payload.enabled is not None:
        vort.enabled = payload.enabled
    if payload.palette is not None:
        vort.palette = [[int(ch) for ch in c] for c in payload.palette]
    if payload.speed_ms is not None:
        vort.speed_ms = payload.speed_ms
    if payload.clockwise is not None:
        vort.clockwise = payload.clockwise
    if payload.trail_length is not None:
        vort.trail_length = payload.trail_length

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Vortex mode config updated")


@app.post("/config/wave")
async def update_wave_mode(
    payload: WaveModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Wave mode settings (palette, speed_ms, direction).
    Обновляет параметры режима Wave (palette, speed_ms, direction).
    """
    cfg = service.config.get_config()
    wv = cfg.mode.wave

    if payload.enabled is not None:
        wv.enabled = payload.enabled
    if payload.palette is not None:
        wv.palette = [[int(ch) for ch in c] for c in payload.palette]
    if payload.speed_ms is not None:
        wv.speed_ms = payload.speed_ms
    if payload.direction is not None:
        wv.direction = payload.direction

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Wave mode config updated")


@app.post("/config/pomodoro")
async def update_pomodoro_mode(
    payload: PomodoroModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Pomodoro Focus Timer mode settings.
    Обновляет параметры режима Pomodoro Focus Timer.
    """
    cfg = service.config.get_config()
    pomo = cfg.mode.pomodoro

    if payload.enabled is not None:
        pomo.enabled = payload.enabled
    if payload.work_duration_min is not None:
        pomo.work_duration_min = payload.work_duration_min
    if payload.break_duration_min is not None:
        pomo.break_duration_min = payload.break_duration_min
    if payload.long_break_min is not None:
        pomo.long_break_min = payload.long_break_min
    if payload.cycles_before_long_break is not None:
        pomo.cycles_before_long_break = payload.cycles_before_long_break
    if payload.focus_color is not None:
        pomo.focus_color = [int(c) for c in payload.focus_color]
    if payload.break_color is not None:
        pomo.break_color = [int(c) for c in payload.break_color]
    if payload.state is not None:
        pomo.state = payload.state
    if payload.elapsed_seconds is not None:
        pomo.elapsed_seconds = payload.elapsed_seconds
    if payload.current_cycle is not None:
        pomo.current_cycle = payload.current_cycle

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Pomodoro mode config updated")


@app.post("/config/circadian")
async def update_circadian_mode(
    payload: CircadianModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Circadian mode settings (24h biodynamic solar rhythm).
    Обновляет параметры режима Circadian Light (солнечный биоритм).
    """
    cfg = service.config.get_config()
    circ = cfg.mode.circadian

    if payload.enabled is not None:
        circ.enabled = payload.enabled
    if payload.min_temp_k is not None:
        circ.min_temp_k = payload.min_temp_k
    if payload.max_temp_k is not None:
        circ.max_temp_k = payload.max_temp_k
    if payload.brightness_factor is not None:
        circ.brightness_factor = payload.brightness_factor
    if payload.transition_time is not None:
        circ.transition_time = payload.transition_time

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Circadian mode config updated")


@app.post("/config/audio")
async def update_audio_mode(
    payload: AudioModeUpdate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Audio Reactive Music Visualizer mode settings.
    Обновляет параметры режима Audio Reactive Music Visualizer.
    """
    cfg = service.config.get_config()
    aud = cfg.mode.audio

    if payload.enabled is not None:
        aud.enabled = payload.enabled
    if payload.preset is not None:
        aud.preset = payload.preset
    if payload.sensitivity is not None:
        aud.sensitivity = payload.sensitivity
    if payload.bass_color is not None:
        aud.bass_color = [int(c) for c in payload.bass_color]
    if payload.mid_color is not None:
        aud.mid_color = [int(c) for c in payload.mid_color]
    if payload.high_color is not None:
        aud.high_color = [int(c) for c in payload.high_color]
    if payload.decay_speed is not None:
        aud.decay_speed = payload.decay_speed
    if payload.min_brightness is not None:
        aud.min_brightness = payload.min_brightness

    service.config.bump_revision()
    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(ok=True, message="Audio reactive mode config updated")


@app.post("/config/mapping/device")
async def add_or_update_device_mapping(
    payload: DeviceMappingCreate,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Adds or updates device group mapping configuration.
    Добавляет или обновляет группу устройств в маппинге панелей.
    """
    existing = service.config.get_device_mapping_exact(payload.match)
    if existing:
        service.config.update_device_mapping(
            match=payload.match,
            label=payload.label,
            panel_ids=payload.panel_ids,
            base_color=payload.base_color,
        )
    else:
        service.config.add_device_mapping(
            match=payload.match,
            label=payload.label,
            panel_ids=payload.panel_ids,
            base_color=payload.base_color,
        )

    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(
        ok=True,
        message=f"Device mapping for {payload.match!r} saved",
        data={"revision": service.config.get_config().revision},
    )


@app.delete("/config/mapping/device/{match}")
async def delete_device_mapping(
    match: str,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Deletes device group mapping configuration.
    Удаляет группу устройств из маппинга панелей.
    """
    removed = service.config.remove_device_mapping(match)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Device mapping with match {match!r} not found")

    service.config.save()
    await service.notify_config_change()

    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(
        ok=True,
        message=f"Device mapping for {match!r} deleted",
        data={"revision": service.config.get_config().revision},
    )


@app.post("/render/apply")
async def force_render_apply(
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Forces recalculation and output of lighting render plan to panels.
    Принудительно пересчитывает и отправляет текущий световой план на панели.
    """
    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)
        return ApiResponse(ok=True, message="Render applied", data={"fingerprint": plan.fingerprint})

    return ApiResponse(ok=True, message="Render evaluated (no changes)")


# --- Setup & Mapping Wizard Endpoints ---

@app.get("/setup/devices", response_model=DiscoveredDevicesResponse)
async def get_setup_devices(service: ApiService = Depends(get_api_service)) -> dict[str, Any]:
    """
    Returns discovered G HUB devices with mapping assignment statuses.
    Возвращает обнаруженные G HUB устройства со статусом маппинга.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    return {"devices": service.setup.get_discovered_devices()}


@app.get("/setup/panels", response_model=DiscoveredPanelsResponse)
async def get_setup_panels(service: ApiService = Depends(get_api_service)) -> dict[str, Any]:
    """
    Returns discovered Nanoleaf physical panel IDs with group assignment statuses.
    Возвращает обнаруженные физические ID панелей Nanoleaf со статусом назначения.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    return {"panels": await service.setup.get_discovered_panels()}


@app.get("/setup/session", response_model=SetupSessionStateResponse)
async def get_setup_session(service: ApiService = Depends(get_api_service)) -> dict[str, Any]:
    """
    Returns current runtime state of Setup Wizard session.
    Возвращает текущее runtime состояние мастера настройки.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    return service.setup.get_session_state()


@app.post("/setup/session/start", response_model=SetupSessionStateResponse)
async def start_setup_session(service: ApiService = Depends(get_api_service)) -> dict[str, Any]:
    """
    Initializes Setup Wizard runtime session.
    Инициализирует runtime-сессию мастера настройки.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    return await service.setup.start_session()


@app.post("/setup/session/stop")
async def stop_setup_session(service: ApiService = Depends(get_api_service)) -> ApiResponse:
    """
    Stops Setup Wizard session and restores normal lighting render.
    Завершает runtime-сессию мастера настройки и восстанавливает рабочий рендер.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    await service.setup.stop_session()
    return ApiResponse(ok=True, message="Setup session stopped and normal lighting restored")


@app.post("/setup/panels/{panel_id}/identify")
async def identify_single_panel(
    panel_id: int,
    payload: IdentifyPanelRequest,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Visually identifies selected panel by flashing color.
    Точечно подсвечивает выбранную панель на заданное время.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    if panel_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid panel_id")
    await service.setup.identify_panel(panel_id, payload.color, payload.duration_ms)
    return ApiResponse(ok=True, message=f"Panel {panel_id} identification triggered")


@app.post("/setup/panels/identify-cycle/start")
async def start_panel_identify_cycle(
    payload: IdentifyCycleRequest,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Starts sequential circular walk illuminating panels one by one.
    Запускает автоматический циклический обход и подсветку панелей из списка.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    await service.setup.start_identify_cycle(
        panel_ids=payload.panel_ids,
        color=payload.color,
        step_duration_ms=payload.step_duration_ms,
        repeat=payload.repeat,
    )
    return ApiResponse(ok=True, message="Panel identification cycle started")


@app.post("/setup/panels/identify-cycle/stop")
async def stop_panel_identify_cycle(
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Stops circular panel walk and restores previous lighting.
    Останавливает циклический обход панелей и восстанавливает обычный рендер.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    await service.setup.stop_identify_cycle()
    return ApiResponse(ok=True, message="Panel identification cycle stopped")


@app.post("/setup/preview")
async def preview_group_panels(
    payload: PreviewGroupRequest,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Temporarily previews group panel colors without saving to disk config.
    Временно подсвечивает группу панелей без сохранения в конфиг.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    await service.setup.preview_group(
        panel_ids=payload.panel_ids,
        color=payload.color,
        transition_time=payload.transition_time,
    )
    return ApiResponse(ok=True, message="Group preview applied")


@app.post("/setup/preview/clear")
async def clear_group_preview(
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Clears temporary group preview mode and restores active lighting.
    Очищает режим предварительного просмотра и восстанавливает рабочий рендер.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    await service.setup.clear_preview()
    return ApiResponse(ok=True, message="Preview cleared")


@app.put("/config/layout/groups/{group_match}")
async def save_layout_group(
    group_match: str,
    payload: SetupSaveMappingRequest,
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Validates, saves device group mapping atomically, and updates lighting.
    Валидирует, атомарно сохраняет группу маппинга и обновляет подсветку.
    """
    if not service.setup:
        raise HTTPException(status_code=503, detail="Setup coordinator not available")
    match_key = group_match.strip() or payload.match.strip()
    try:
        await service.setup.save_mapping(
            label=payload.label,
            match=match_key,
            panel_ids=payload.panel_ids,
            base_color=payload.base_color,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await service.notify_config_change()
    plan = await service.lighting.apply_batteries(force=True)
    if plan is not None:
        await service.notify_render_change(plan)

    return ApiResponse(
        ok=True,
        message=f"Layout group {payload.label!r} ({match_key}) saved and applied",
        data={"revision": service.config.get_config().revision},
    )


@app.get("/api/agent/status")
async def get_agent_status(service: ApiService = Depends(get_api_service)) -> ApiResponse:
    """
    Returns connection and heartbeat status of remote Windows Desktop Agents.
    Возвращает статус подключения удаленных Windows-агентов.
    """
    status = service.agent_manager.get_status()
    return ApiResponse(ok=True, data=status)


@app.post("/api/agent/config")
async def update_agent_config(
    payload: dict[str, Any],
    service: ApiService = Depends(get_api_service),
) -> ApiResponse:
    """
    Updates Agent Gateway configuration (enabled, pc_offline_action, pc_offline_timeout_sec).
    Обновляет конфигурацию агента (enabled, pc_offline_action, pc_offline_timeout_sec).
    """
    cfg = service.config.set_agent_config(
        enabled=payload.get("enabled"),
        pc_offline_action=payload.get("pc_offline_action"),
        pc_offline_timeout_sec=payload.get("pc_offline_timeout_sec"),
    )
    service.config.save()
    await service.notify_config_change()
    return ApiResponse(ok=True, message="Agent config updated", data=cfg.model_dump(mode="json"))


@app.websocket("/api/agent/ws")
async def agent_websocket_endpoint(ws: WebSocket) -> None:
    """
    WebSocket endpoint for connecting Windows Desktop Agents.
    Accepts battery updates, PC power state events, and heartbeats.

    WebSocket endpoint для подключения Windows Desktop Agent.
    Принимает батарейные обновления, статус ПК и heartbeat.
    """
    await ws.accept()
    service = get_api_service()
    await service.agent_manager.register_agent(ws)
    await ws.send_text(json.dumps({"event": "connected", "status": service.agent_manager.get_status()}))

    try:
        while True:
            text = await ws.receive_text()
            await service.agent_manager.handle_agent_message(ws, text)
            await ws.send_text(json.dumps({"event": "ack"}))
    except WebSocketDisconnect:
        logger.info("Agent disconnected normally / Агент отключился штатно")
    except Exception:
        logger.exception("Agent WebSocket connection error / Ошибка WebSocket соединения агента")
    finally:
        await service.agent_manager.unregister_agent(ws)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """
    WebSocket endpoint for real-time state streaming and notifications to Web UI.
    WebSocket endpoint для живого стриминга состояния и мгновенных уведомлений.
    """
    await ws.accept()
    service = get_api_service()
    service.register_ws(ws)

    # Send initial state snapshot upon connection / При подключении сразу отправляем полный initial snapshot
    await service.send_initial_snapshot(ws)

    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally / Клиент WebSocket отключился штатно")
    except Exception:
        logger.exception("WebSocket connection error / Ошибка WebSocket соединения")
    finally:
        service.unregister_ws(ws)


# --- SPA Static Files Mount (Frontend integration) / Раздача статики SPA ---
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    if (frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_frontend(full_path: str) -> FileResponse:
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
