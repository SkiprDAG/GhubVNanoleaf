from __future__ import annotations

import asyncio
import logging
import os
from contextlib import suppress
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

from config import ConfigManager
from control import ApiService, app, init_api_service
from domain.models import BatteryInfo
from ghub import GHubBatterySource, GHubManager
from lighting import (
    AmbientMode,
    AudioMode,
    BatteryMode,
    CircadianMode,
    LightingService,
    ModeRegistry,
    OffMode,
    PomodoroMode,
    SolidMode,
    VortexMode,
    WaveMode,
)
from logging_config import setup_logging
from nanoleaf import NanoleafClient, NanoleafLightingAdapter

logger = logging.getLogger(__name__)


async def render_consumer(
    queue: asyncio.Queue[BatteryInfo],
    lighting_service: LightingService,
    api_service: ApiService,
) -> None:
    """
    Reads battery events from queue, renders panel updates, and broadcasts WebSocket events.
    Вычитывает батарейные события из очереди, обновляет подсветку и рассылает события в WebSocket.
    """
    while True:
        battery = await queue.get()

        try:
            await api_service.notify_battery_change(battery)
            plan = await lighting_service.apply_batteries()

            if plan is not None:
                await api_service.notify_render_change(plan)

        except Exception:
            logger.exception(
                "Failed to render battery event for device=%s",
                battery.device_id,
            )

        finally:
            queue.task_done()


async def periodic_timer_loop(
    lighting_service: LightingService,
    api_service: ApiService,
) -> None:
    """
    Periodic timer for autonomous time-based modes (Circadian, Pomodoro).
    Периодический таймер для автономных режимов времени (Circadian, Pomodoro).
    """
    circadian_counter = 0
    while True:
        try:
            await asyncio.sleep(1.0)
            app_cfg = lighting_service.config.get_config()
            active_mode = app_cfg.mode.active

            # 1. Autonomous Pomodoro ticking / 1. Автономное тиканье Помодоро
            if active_mode == "pomodoro" and app_cfg.mode.pomodoro.enabled:
                pomo = app_cfg.mode.pomodoro
                phase_switched = PomodoroMode.tick_second(pomo)
                # Update Nanoleaf physical panels every 5 seconds or immediately on phase switch
                # Обновление физических панелей каждые 5 секунд или мгновенно при смене фазы
                if phase_switched or (pomo.elapsed_seconds % 5 == 0):
                    plan = await lighting_service.apply_batteries(force=False)
                    if plan is not None:
                        await api_service.notify_render_change(plan)

            # 2. Periodic Circadian light re-evaluation every 30 seconds
            # 2. Периодический пересчет циркадного света каждые 30 секунд
            circadian_counter += 1
            if circadian_counter >= 30:
                circadian_counter = 0
                if active_mode == "circadian" and app_cfg.mode.circadian.enabled:
                    plan = await lighting_service.apply_batteries(force=False)
                    if plan is not None:
                        await api_service.notify_render_change(plan)

        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Error in periodic timer loop")


async def main() -> None:
    load_dotenv()
    setup_logging()
    logger.info("Starting GhubVNanoleaf Bridge...")

    nanoleaf_ip = os.getenv("NANOLEAF_IP", "192.168.100.100")
    nanoleaf_token = os.getenv("NANOLEAF_TOKEN", "")
    nanoleaf_port = int(os.getenv("NANOLEAF_PORT", "16021"))
    nanoleaf_timeout = float(os.getenv("NANOLEAF_TIMEOUT", "5.0"))

    ghub_ws_url = os.getenv("GHUB_WS_URL", "ws://localhost:9010")
    ghub_timeout = float(os.getenv("GHUB_TIMEOUT", "5.0"))

    config_path = Path(os.getenv("CONFIG_PATH", "config/config.json"))
    http_host = os.getenv("HTTP_HOST", "127.0.0.1")
    http_port = int(os.getenv("HTTP_PORT", "8000"))

    battery_queue: asyncio.Queue[BatteryInfo] = asyncio.Queue(maxsize=100)

    nanoleaf_client = NanoleafClient(
        ip=nanoleaf_ip,
        token=nanoleaf_token,
        port=nanoleaf_port,
        request_timeout=nanoleaf_timeout,
    )

    ghub_manager = GHubManager(
        event_queue=battery_queue,
        server_url=ghub_ws_url,
        timeout=ghub_timeout,
        max_queue=16,
    )

    config_manager = ConfigManager(config_path)

    modes = ModeRegistry([
        BatteryMode(),
        SolidMode(),
        OffMode(),
        AmbientMode(),
        VortexMode(),
        WaveMode(),
        PomodoroMode(),
        CircadianMode(),
        AudioMode(),
    ])

    output = NanoleafLightingAdapter(nanoleaf_client)
    source = GHubBatterySource(ghub_manager)

    lighting_service = LightingService(
        output=output,
        source=source,
        config=config_manager,
        modes=modes,
    )

    api_service = init_api_service(
        config=config_manager,
        lighting=lighting_service,
        source=source,
        output=output,
    )

    ghub_task = asyncio.create_task(
        ghub_manager.run(),
        name="ghub-manager",
    )

    render_task = asyncio.create_task(
        render_consumer(
            battery_queue,
            lighting_service,
            api_service,
        ),
        name="nanoleaf-render-consumer",
    )

    uvicorn_task = asyncio.create_task(
        _run_uvicorn(host=http_host, port=http_port),
        name="uvicorn-server",
    )

    timer_task = asyncio.create_task(
        periodic_timer_loop(
            lighting_service,
            api_service,
        ),
        name="periodic-timer-loop",
    )

    logger.info("All tasks initialized successfully. Running...")

    try:
        await asyncio.gather(
            ghub_task,
            render_task,
            uvicorn_task,
            timer_task,
        )

    except asyncio.CancelledError:
        logger.info("Application shutdown requested")
        raise

    finally:
        for task in (ghub_task, render_task, uvicorn_task, timer_task):
            task.cancel()

        for task in (ghub_task, render_task, uvicorn_task, timer_task):
            with suppress(asyncio.CancelledError):
                await task

        nanoleaf_client.close()
        logger.info("Application stopped gracefully")


async def _run_uvicorn(host: str = "0.0.0.0", port: int = 8000) -> None:
    config = uvicorn.Config(
        app=app,
        host=host,
        port=port,
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
