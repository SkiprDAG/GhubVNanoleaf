from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket

from config.manager import ConfigManager
from domain.models import BatteryInfo
from lighting.service import LightingService

logger = logging.getLogger(__name__)


class AgentManager:
    """
    Manages remote Windows Desktop Agent connections (WebSocket & PC power state)
    and executes configurable lighting fallback when PC goes offline.

    Управляет подключениями удаленных Windows-агентов (WebSocket + статус ПК)
    и переключает освещение в резервный режим (Fallback) при выключении ПК.
    """

    def __init__(
        self,
        config: ConfigManager,
        lighting: LightingService,
        battery_queue: asyncio.Queue[BatteryInfo] | None = None,
    ) -> None:
        self.config = config
        self.lighting = lighting
        self.battery_queue = battery_queue

        self._connected_agents: set[WebSocket] = set()
        self._pc_online: bool = False
        self._last_heartbeat_time: float = 0.0
        self._agent_metadata: dict[str, Any] = {}
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    @property
    def pc_online(self) -> bool:
        return self._pc_online

    def get_status(self) -> dict[str, Any]:
        agent_cfg = self.config.get_agent_config()
        return {
            "pc_online": self._pc_online,
            "connected_agents_count": len(self._connected_agents),
            "last_heartbeat": self._last_heartbeat_time,
            "metadata": dict(self._agent_metadata),
            "fallback_action": agent_cfg.pc_offline_action,
            "enabled": agent_cfg.enabled,
        }

    async def register_agent(self, ws: WebSocket, metadata: dict[str, Any] | None = None) -> None:
        async with self._lock:
            self._connected_agents.add(ws)
            self._pc_online = True
            self._last_heartbeat_time = time.time()
            if metadata:
                self._agent_metadata.update(metadata)
            hostname = metadata.get("hostname", "unknown") if metadata else "unknown"
            logger.info("Agent connected (hostname=%s, total=%d)", hostname, len(self._connected_agents))

    async def unregister_agent(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self._connected_agents:
                self._connected_agents.remove(ws)
            if not self._connected_agents:
                self._pc_online = False
                logger.info("All agents disconnected. PC marked OFFLINE / Все агенты отключены. ПК отмечен как OFFLINE.")
                await self._handle_pc_offline_locked()

    async def handle_agent_message(self, ws: WebSocket, message_text: str) -> None:
        try:
            msg = json.loads(message_text)
        except Exception:
            return

        msg_type = msg.get("type")
        self._last_heartbeat_time = time.time()

        if msg_type == "hello":
            self._pc_online = True
            meta = msg.get("data", {})
            self._agent_metadata.update(meta)
            logger.info("Agent Hello received: %s", meta)

        elif msg_type == "heartbeat":
            self._pc_online = True

        elif msg_type == "battery_update":
            self._pc_online = True
            data = msg.get("data", {})
            battery = BatteryInfo.from_ghub(
                device_id=str(data.get("deviceId", "agent_dev")),
                name=str(data.get("name", "Unknown Device")),
                payload=data,
            )
            if self.battery_queue is not None:
                await self.battery_queue.put(battery)

        elif msg_type == "pc_power_state":
            state = msg.get("state", "")
            logger.info("PC Power State changed: %s", state)
            if state in ("shutdown", "sleep", "logoff"):
                async with self._lock:
                    self._pc_online = False
                    await self._handle_pc_offline_locked()
            elif state in ("online", "resumed"):
                self._pc_online = True

    async def _handle_pc_offline_locked(self) -> None:
        """
        Applies configured fallback action when PC goes offline or sleeps.
        Применяет настроенное действие при выключении или уходе в сон ПК.
        """
        agent_cfg = self.config.get_agent_config()
        action = agent_cfg.pc_offline_action

        logger.info("Applying PC Offline Fallback Action: %s", action)
        if action == "off":
            self.config.set_active_mode("off")
            self.config.save()
            await self.lighting.apply_batteries(force=True)
        elif action == "circadian":
            self.config.set_active_mode("circadian")
            self.config.save()
            await self.lighting.apply_batteries(force=True)
        elif action == "ambient":
            self.config.set_active_mode("ambient")
            self.config.save()
            await self.lighting.apply_batteries(force=True)

    async def start(self) -> None:
        """
        Starts agent liveness heartbeat checker task.
        Запускает фоновую задачу проверки живости агента.
        """
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._heartbeat_checker_loop())

    async def stop(self) -> None:
        if self._heartbeat_task is not None:
            self._heartbeat_task.cancel()
            self._heartbeat_task = None

    async def _heartbeat_checker_loop(self) -> None:
        """
        Periodically checks agent heartbeat deadline.
        Периодически проверяет heartbeat от агента.
        """
        while True:
            try:
                await asyncio.sleep(5.0)
                timeout = self.config.get_agent_config().pc_offline_timeout_sec
                if self._pc_online and (time.time() - self._last_heartbeat_time > timeout):
                    async with self._lock:
                        self._pc_online = False
                        logger.warning("Agent heartbeat timed out (>%.1fs). PC marked OFFLINE.", timeout)
                        await self._handle_pc_offline_locked()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in agent heartbeat checker loop")
