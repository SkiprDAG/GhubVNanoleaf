from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterable
from typing import Any

from config.manager import ConfigManager
from domain.models import BatteryInfo, RenderPlan
from domain.ports import BatterySourcePort, LightingOutputPort

from .audio_engine import AudioEngine
from .modes.base import RenderContext
from .registry import ModeRegistry

logger = logging.getLogger(__name__)


class LightingService:
    """
    Application Service: orchestrator for lighting render plans, mode strategies, and output ports.
    Application Service: оркестратор визуализации, режимов и вывода на панели.
    """

    def __init__(
        self,
        output: LightingOutputPort,
        source: BatterySourcePort,
        config: ConfigManager,
        modes: ModeRegistry,
    ) -> None:
        self._output = output
        self._source = source
        self.config = config
        self._modes = modes
        self._last_fingerprint: str | None = None
        self._render_lock = asyncio.Lock()
        self.audio_engine = AudioEngine(
            config_manager=self.config,
            output=self._output,
        )

    @property
    def source(self) -> BatterySourcePort:
        """
        Public access to battery data source port.
        Публичный доступ к источнику данных о батареях.
        """
        return self._source

    async def apply_batteries(
        self,
        batteries: Iterable[BatteryInfo] | None = None,
        *,
        force: bool = False,
    ) -> RenderPlan | None:
        """
        Recomputes and applies lighting effects based on current battery states and active mode.
        Пересчитывает и применяет подсветку на основе текущих батарей и активного режима.
        """
        if batteries is None:
            battery_list = self._source.get_batteries()
        else:
            battery_list = list(batteries)

        app_config = self.config.get_config()
        mode_name = app_config.mode.active
        mode = self._modes.get(mode_name)

        # Lifecycle management for real-time AudioEngine
        # Управление жизненным циклом AudioEngine
        try:
            loop = asyncio.get_running_loop()
            if mode_name == "audio" and app_config.mode.audio.enabled:
                self.audio_engine.start(loop)
            else:
                self.audio_engine.stop()
        except RuntimeError:
            pass

        context = RenderContext(
            batteries=tuple(battery_list),
            config=app_config,
        )

        plan = mode.build_plan(context)

        if plan is None:
            logger.debug("Mode %r produced no render plan", mode_name)
            return None

        if not force and plan.fingerprint == self._last_fingerprint:
            logger.debug("Lighting plan unchanged; skipped (fingerprint=%s)", plan.fingerprint)
            return None

        return await self.apply_plan(plan)

    async def apply_plan(self, plan: RenderPlan) -> RenderPlan:
        """
        Thread-safely outputs render plan to physical panels via output port.
        Потокобезопасно отправляет план на устройство через порт вывода.
        """
        async with self._render_lock:
            logger.info(
                "Applying render plan: anim_type=%s fingerprint=%s",
                plan.anim_type,
                plan.fingerprint,
            )

            await asyncio.to_thread(self._output.apply_render_plan, plan)
            self._last_fingerprint = plan.fingerprint
            return plan

    def get_status(self) -> dict[str, Any]:
        """
        Returns aggregated lighting service status.
        Возвращает агрегированный статус службы подсветки.
        """
        app_config = self.config.get_config()
        batteries = self._source.get_batteries()

        return {
            "active_mode": app_config.mode.active,
            "available_modes": list(self._modes.names()),
            "config_revision": app_config.revision,
            "last_fingerprint": self._last_fingerprint,
            "devices": [
                {
                    "device_id": b.device_id,
                    "name": b.name,
                    "percentage": b.percentage,
                    "charging": b.charging,
                    "critical": b.critical,
                    "fully_charged": b.fully_charged,
                    "mileage": b.mileage,
                }
                for b in batteries
            ],
        }
