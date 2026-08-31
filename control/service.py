from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket

from config.manager import ConfigManager
from domain.models import BatteryInfo, RenderPlan
from domain.ports import BatterySourcePort, LightingOutputPort
from lighting.service import LightingService

from .agent_service import AgentManager
from .setup_coordinator import MappingSetupCoordinator

logger = logging.getLogger(__name__)


class ApiService:
    """
    Manages WebSocket clients, setup coordinator, agent manager, and broadcast event dispatching.
    Управляет WebSocket-клиентами, координатором настройки, агентами и рассылкой событий.
    """

    def __init__(
        self,
        config: ConfigManager,
        lighting: LightingService,
        source: BatterySourcePort | None = None,
        output: LightingOutputPort | None = None,
        setup: MappingSetupCoordinator | None = None,
        agent_manager: AgentManager | None = None,
    ) -> None:
        self.config = config
        self.lighting = lighting
        self.source = source or getattr(lighting, "_source", None)
        self.output = output or getattr(lighting, "_output", None)

        if setup is not None:
            self.setup = setup
        elif self.source is not None and self.output is not None:
            self.setup = MappingSetupCoordinator(
                config=self.config,
                lighting=self.lighting,
                source=self.source,
                output=self.output,
            )
        else:
            self.setup = None  # type: ignore[assignment]

        self.agent_manager = agent_manager or AgentManager(
            config=self.config,
            lighting=self.lighting,
        )

        self._ws_clients: list[WebSocket] = []
        self._last_fingerprint: str | None = None

    def register_ws(self, ws: WebSocket) -> None:
        self._ws_clients.append(ws)
        logger.info("WebSocket client connected (total=%d)", len(self._ws_clients))

    def unregister_ws(self, ws: WebSocket) -> None:
        if ws in self._ws_clients:
            self._ws_clients.remove(ws)
            logger.info("WebSocket client disconnected (total=%d)", len(self._ws_clients))

    async def broadcast_event(self, event_type: str, data: dict[str, Any]) -> None:
        if not self._ws_clients:
            return

        message = {
            "event": event_type,
            "timestamp": time.time(),
            "data": data,
        }
        payload = json.dumps(message, ensure_ascii=False)

        clients_snapshot = list(self._ws_clients)
        if not clients_snapshot:
            return

        async def _safe_send(ws: WebSocket) -> tuple[WebSocket, bool]:
            try:
                await ws.send_text(payload)
                return ws, True
            except Exception:
                return ws, False

        results = await asyncio.gather(*[_safe_send(ws) for ws in clients_snapshot], return_exceptions=True)
        for res in results:
            if isinstance(res, tuple) and not res[1]:
                self.unregister_ws(res[0])

    async def send_initial_snapshot(self, ws: WebSocket) -> None:
        """
        Sends initial state snapshot to connected WebSocket client.
        Отправляет начальный снимок состояния системы клиенту сразу после подключения.
        """
        snapshot = {
            "event": "initial_snapshot",
            "timestamp": time.time(),
            "data": {
                "status": self.lighting.get_status(),
                "config": self.config.raw(),
                "agent_status": self.agent_manager.get_status(),
            },
        }
        try:
            await ws.send_text(json.dumps(snapshot, ensure_ascii=False))
        except Exception:
            logger.warning("Failed to send initial snapshot to WebSocket client")

    async def notify_render_change(self, plan: RenderPlan) -> None:
        if plan.fingerprint == self._last_fingerprint:
            return

        self._last_fingerprint = plan.fingerprint
        await self.broadcast_event(
            "render_applied",
            {
                "fingerprint": plan.fingerprint,
                "anim_type": plan.anim_type,
                "metadata": plan.metadata,
            },
        )

    async def notify_battery_change(self, battery: BatteryInfo) -> None:
        critical_threshold = self.config.get_config().logic.thresholds.critical
        await self.broadcast_event(
            "battery_updated",
            {
                "device_id": battery.device_id,
                "name": battery.name,
                "percentage": battery.percentage,
                "charging": battery.charging,
                "critical": battery.percentage <= critical_threshold,
            },
        )

    async def notify_config_change(self) -> None:
        cfg = self.config.get_config()
        await self.broadcast_event(
            "config_updated",
            {
                "revision": cfg.revision,
                "active_mode": cfg.mode.active,
            },
        )
