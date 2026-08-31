from __future__ import annotations

import asyncio
import json
import logging
import platform
import socket
import sys
import time

from websockets.asyncio.client import ClientConnection
from websockets.asyncio.client import connect as ws_connect
from websockets.typing import Origin, Subprotocol

from .power_hooks import CTRL_CLOSE_EVENT, CTRL_LOGOFF_EVENT, CTRL_SHUTDOWN_EVENT, WindowsPowerHook

logger = logging.getLogger(__name__)


class DesktopAgent:
    """
    Windows Desktop Agent:
    1. Connects to local Logitech G HUB (ws://127.0.0.1:9010).
    2. Connects to Master Server (ws://<server_host>:<server_port>/api/agent/ws).
    3. Streams battery events and PC online status to the server.
    4. Intercepts Windows sleep/shutdown and notifies the server.

    Windows Desktop Agent:
    1. Подключается к локальному Logitech G HUB (ws://127.0.0.1:9010).
    2. Подключается к Master-Серверу (ws://<server_host>:<server_port>/api/agent/ws).
    3. Пробрасывает события батарей и статус ПК на сервер.
    4. Перехватывает выключение/сон Windows и уведомляет сервер.
    """

    def __init__(
        self,
        server_url: str = "ws://127.0.0.1:8000/api/agent/ws",
        ghub_url: str = "ws://127.0.0.1:9010",
    ) -> None:
        self.server_url = server_url
        self.ghub_url = ghub_url
        self._running = False
        self._server_ws: ClientConnection | None = None
        self._ghub_ws: ClientConnection | None = None
        self._power_hook = WindowsPowerHook()
        self._loop: asyncio.AbstractEventLoop | None = None

    def _setup_power_hooks(self) -> None:
        def on_power_event(ctrl_type: int, name: str) -> None:
            logger.info("Power hook triggered: %s", name)
            if ctrl_type in (CTRL_SHUTDOWN_EVENT, CTRL_LOGOFF_EVENT, CTRL_CLOSE_EVENT):
                self._send_power_state_sync("shutdown")

        self._power_hook.add_callback(on_power_event)
        self._power_hook.install()

    def _send_power_state_sync(self, state: str) -> None:
        """
        Synchronous expedited transmission of power state on PC shutdown.
        Синхронная быстрая отправка статуса питания при выключении ПК.
        """
        if self._server_ws is not None and self._loop is not None and self._loop.is_running():
            msg = json.dumps({"type": "pc_power_state", "state": state, "timestamp": time.time()})
            try:
                future = asyncio.run_coroutine_threadsafe(self._server_ws.send(msg), self._loop)
                future.result(timeout=1.0)
                logger.info("Sent %s notification to server.", state)
            except Exception as e:
                logger.debug("Failed to send sync power state: %s", e)

    async def run(self) -> None:
        self._running = True
        self._loop = asyncio.get_running_loop()
        self._setup_power_hooks()

        logger.info("Starting Desktop Agent connecting to server=%s, ghub=%s", self.server_url, self.ghub_url)

        server_task = asyncio.create_task(self._server_loop(), name="agent-server-bridge")
        ghub_task = asyncio.create_task(self._ghub_loop(), name="agent-ghub-bridge")

        try:
            await asyncio.gather(server_task, ghub_task)
        except asyncio.CancelledError:
            logger.info("Desktop Agent shutdown requested")
        finally:
            self._running = False
            self._power_hook.uninstall()

    async def _server_loop(self) -> None:
        """
        Maintains persistent WebSocket connection with Master Server.
        Поддерживает постоянное WebSocket-соединение с Master-Сервером.
        """
        backoff = 1.0
        while self._running:
            try:
                logger.info("Connecting to Master Server at %s...", self.server_url)
                async with ws_connect(self.server_url) as ws:
                    self._server_ws = ws
                    backoff = 1.0
                    logger.info("Connected to Master Server!")

                    # Send initial Hello handshake / Отправка начального рукопожатия
                    hello_payload = {
                        "type": "hello",
                        "data": {
                            "hostname": socket.gethostname(),
                            "platform": platform.platform(),
                            "python": sys.version.split()[0],
                            "timestamp": time.time(),
                        },
                    }
                    await ws.send(json.dumps(hello_payload))

                    # Heartbeat sender & receiver loop / Цикл отправки heartbeat
                    while self._running:
                        heartbeat_payload = {"type": "heartbeat", "timestamp": time.time()}
                        await ws.send(json.dumps(heartbeat_payload))
                        await asyncio.sleep(5.0)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._server_ws = None
                logger.warning("Master Server connection lost (%s). Reconnecting in %.1fs...", e, backoff)
                await asyncio.sleep(backoff)
                backoff = min(30.0, backoff * 1.5)

    async def _ghub_loop(self) -> None:
        """
        Maintains persistent WebSocket connection with Logitech G HUB.
        Поддерживает постоянное WebSocket-соединение с Logitech G HUB.
        """
        backoff = 2.0
        while self._running:
            try:
                logger.info("Connecting to Logitech G HUB at %s...", self.ghub_url)
                async with ws_connect(
                    self.ghub_url,
                    subprotocols=[Subprotocol("json")],
                    origin=Origin("ghub"),
                ) as ws:
                    self._ghub_ws = ws
                    backoff = 2.0
                    logger.info("Connected to G HUB!")

                    # Subscribe to battery & device events / Подписка на события батарей и устройств
                    for path in ["/devices/state/changed", "/battery/state/changed"]:
                        sub_msg = {
                            "msgId": f"sub_{int(time.time()*1000)}",
                            "verb": "SUBSCRIBE",
                            "path": path,
                        }
                        await ws.send(json.dumps(sub_msg))

                    # Request initial device list / Запрос начального списка устройств
                    req_msg = {
                        "msgId": "init_devices",
                        "verb": "GET",
                        "path": "/devices/list",
                    }
                    await ws.send(json.dumps(req_msg))

                    # Message listening loop / Цикл приема сообщений
                    async for raw_msg in ws:
                        if not self._running:
                            break
                        await self._handle_ghub_message(raw_msg)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._ghub_ws = None
                logger.warning("G HUB connection lost (%s). Reconnecting in %.1fs...", e, backoff)
                await asyncio.sleep(backoff)
                backoff = min(30.0, backoff * 1.5)

    async def _handle_ghub_message(self, raw_msg: str | bytes) -> None:
        try:
            data = json.loads(raw_msg)
        except Exception:
            return

        path = data.get("path", "")
        payload = data.get("payload", {})

        if path == "/battery/state/changed":
            logger.info("G HUB Battery event: %s", payload)
            if self._server_ws is not None:
                agent_msg = {
                    "type": "battery_update",
                    "data": payload,
                    "timestamp": time.time(),
                }
                try:
                    await self._server_ws.send(json.dumps(agent_msg))
                except Exception as e:
                    logger.debug("Failed to forward battery to server: %s", e)

        elif path == "/devices/list" and isinstance(payload, list):
            for dev in payload:
                battery = dev.get("battery")
                if battery and self._server_ws is not None:
                    battery_payload = dict(battery)
                    battery_payload["deviceId"] = dev.get("id")
                    battery_payload["name"] = dev.get("extendedDisplayName") or dev.get("name") or "Logitech Device"
                    agent_msg = {
                        "type": "battery_update",
                        "data": battery_payload,
                        "timestamp": time.time(),
                    }
                    try:
                        await self._server_ws.send(json.dumps(agent_msg))
                    except Exception:
                        pass
