from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

from websockets.asyncio.client import ClientConnection, connect
from websockets.typing import Origin, Subprotocol

from domain.models import BatteryInfo

logger = logging.getLogger(__name__)

WEBSOCKET_SERVER = "ws://localhost:9010"
BATTERY_DEVICE_STATE_RE = re.compile(r"^/battery/dev[0-9a-zA-Z]+/state$")


@dataclass(frozen=True, slots=True)
class GHUBMessage:
    """
    Normalized representation of incoming G HUB WebSocket message.
    Нормализованное представление входящего сообщения G HUB WebSocket.
    """

    msg_id: str
    verb: str
    path: str
    origin: str
    payload: dict[str, Any]

    @classmethod
    def from_json(cls, raw: str) -> GHUBMessage:
        data = json.loads(raw)
        payload = data.get("payload")
        if not isinstance(payload, dict):
            payload = {}

        return cls(
            msg_id=str(data.get("msgId", "")),
            verb=str(data.get("verb", "")),
            path=str(data.get("path", "")),
            origin=str(data.get("origin", "")),
            payload=payload,
        )


class GHubManager:
    """
    Asynchronous client for local Logitech G HUB WebSocket API.
    Асинхронный клиент локального G HUB WebSocket API.
    """

    def __init__(
        self,
        event_queue: asyncio.Queue[BatteryInfo],
        *,
        server_url: str = WEBSOCKET_SERVER,
        timeout: float = 5.0,
        max_queue: int = 16,
    ) -> None:
        self.event_queue = event_queue
        self.server_url = server_url
        self.timeout = timeout
        self.ws: ClientConnection | None = None

        self._devices: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

        self._subscriptions = (
            "/devices/state/changed",
            "/battery/state/changed",
        )

        self._backoff_start = 0.5
        self._backoff_max = 30.0

        self._dedupe_window_sec = 0.75
        self._seen_events: OrderedDict[str, float] = OrderedDict()
        self._seen_events_max = 512

        self._max_queue = max_queue

    def get_devices_snapshot(self) -> dict[str, dict[str, Any]]:
        """
        Returns a thread-safe snapshot of currently cached devices.
        Возвращает потокобезопасную копию текущего кэша устройств.
        """
        return dict(self._devices)

    async def _open(self) -> None:
        self.ws = await connect(
            self.server_url,
            origin=Origin("file://"),
            subprotocols=[Subprotocol("json")],
            additional_headers={
                "Pragma": "no-cache",
                "Cache-Control": "no-cache",
            },
            open_timeout=self.timeout,
            max_queue=self._max_queue,
        )

        logger.info("Connected to G HUB at %s", self.server_url)

    async def _close(self) -> None:
        if self.ws is None:
            return

        try:
            await self.ws.close()
            logger.info("G HUB WebSocket closed")
        except Exception:
            logger.exception("Failed to close G HUB WebSocket")
        finally:
            self.ws = None

    async def _send_json(self, payload: dict[str, Any]) -> None:
        if self.ws is None:
            raise RuntimeError("G HUB WebSocket is not connected")

        await self.ws.send(json.dumps(payload))

    async def _subscribe_all(self) -> None:
        for path in self._subscriptions:
            await self._send_json({
                "msgId": "",
                "verb": "SUBSCRIBE",
                "path": path,
            })

        logger.info("Subscribed to G HUB paths: %s", ", ".join(self._subscriptions))

    async def _load_devices(self) -> None:
        await self._send_json({
            "msgId": "",
            "verb": "GET",
            "path": "/devices/list",
        })

    async def _request_battery_state(self, device_id: str) -> None:
        await self._send_json({
            "msgId": "",
            "verb": "GET",
            "path": f"/battery/{device_id}/state",
        })

    def _is_duplicate(self, event_key: str) -> bool:
        now = time.monotonic()

        expired = [
            key
            for key, timestamp in self._seen_events.items()
            if now - timestamp > self._dedupe_window_sec
        ]

        for key in expired:
            self._seen_events.pop(key, None)

        if event_key in self._seen_events:
            return True

        self._seen_events[event_key] = now

        while len(self._seen_events) > self._seen_events_max:
            self._seen_events.popitem(last=False)

        return False

    @staticmethod
    def _battery_signature(payload: dict[str, Any]) -> str:
        values = {
            "deviceId": payload.get("deviceId"),
            "percentage": payload.get("percentage"),
            "charging": payload.get("charging"),
            "criticalLevel": payload.get("criticalLevel"),
            "fullyCharged": payload.get("fullyCharged"),
            "mileage": payload.get("mileage"),
        }

        return json.dumps(values, sort_keys=True, ensure_ascii=False)

    async def _publish_battery(self, payload: dict[str, Any]) -> None:
        if not payload:
            return

        device_id = str(payload.get("deviceId", ""))
        if not device_id:
            logger.warning("Battery event without deviceId")
            return

        device = self._devices.get(device_id, {})
        name = str(device.get("name", device_id))

        battery = BatteryInfo.from_ghub(
            device_id=device_id,
            name=name,
            payload=payload,
        )

        async with self._lock:
            dev_entry = self._devices.setdefault(
                device_id,
                {"id": device_id, "name": name},
            )
            dev_entry["battery"] = battery

        await self.event_queue.put(battery)

        logger.info(
            "Battery update: device=%s percentage=%d charging=%s critical=%s",
            battery.name,
            battery.percentage,
            battery.charging,
            battery.critical,
        )

    async def _handle_devices_list(self, payload: dict[str, Any]) -> None:
        device_infos = payload.get("deviceInfos", [])
        if not isinstance(device_infos, list):
            return

        devices_with_battery: list[str] = []

        async with self._lock:
            for device in device_infos:
                if not isinstance(device, dict):
                    continue

                device_id = str(device.get("id", ""))
                if not device_id:
                    continue

                capabilities = device.get("capabilities") or {}
                has_battery = bool(capabilities.get("hasBatteryStatus", False))
                name = str(device.get("extendedDisplayName", device_id))

                self._devices[device_id] = {
                    "id": device_id,
                    "name": name,
                    "device_type": str(device.get("deviceType", "UNKNOWN")),
                    "has_battery": has_battery,
                    "state": str(device.get("state", "")),
                }

                logger.info("Device discovered: id=%s name=%s (battery=%s)", device_id, name, has_battery)

                if has_battery:
                    devices_with_battery.append(device_id)

        for dev_id in devices_with_battery:
            await self._request_battery_state(dev_id)

    async def _handle_device_state(self, payload: dict[str, Any]) -> None:
        device_id = str(payload.get("id", ""))
        if not device_id:
            return

        signature = json.dumps(
            {
                "id": device_id,
                "state": payload.get("state"),
                "connectionType": payload.get("connectionType"),
            },
            sort_keys=True,
        )

        if self._is_duplicate(signature):
            return

        has_battery = False
        async with self._lock:
            dev = self._devices.setdefault(device_id, {"id": device_id})
            dev.update({
                "name": str(payload.get("extendedDisplayName", dev.get("name", device_id))),
                "state": str(payload.get("state", "")),
                "has_battery": bool((payload.get("capabilities") or {}).get("hasBatteryStatus", dev.get("has_battery", False))),
            })
            has_battery = dev["has_battery"]

        logger.info("Device state changed: id=%s state=%s", device_id, payload.get("state"))

        if has_battery:
            await self._request_battery_state(device_id)

    async def _handle_message(self, raw: str | bytes) -> None:
        try:
            raw_text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
            message = GHUBMessage.from_json(raw_text)
        except (TypeError, ValueError, json.JSONDecodeError):
            logger.exception("Failed to parse G HUB message")
            return

        if message.path == "/devices/list":
            await self._handle_devices_list(message.payload)
            return

        if (
            message.path == "/battery/state/changed"
            or BATTERY_DEVICE_STATE_RE.match(message.path)
        ):
            signature = self._battery_signature(message.payload)
            if self._is_duplicate(signature):
                return

            await self._publish_battery(message.payload)
            return

        if message.path == "/devices/state/changed":
            await self._handle_device_state(message.payload)
            return

    async def _receive_loop(self) -> None:
        if self.ws is None:
            raise RuntimeError("G HUB WebSocket is not connected")

        async for message in self.ws:
            await self._handle_message(message)

        logger.warning("G HUB receive loop terminated")

    async def run(self) -> None:
        backoff = self._backoff_start

        while True:
            try:
                await self._open()
                await self._subscribe_all()
                await self._load_devices()

                backoff = self._backoff_start
                await self._receive_loop()

            except asyncio.CancelledError:
                logger.info("G HUB manager shutdown requested")
                break

            except Exception:
                logger.exception("G HUB connection error")

            finally:
                await self._close()

            logger.warning("Reconnecting to G HUB in %.2f seconds", backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, self._backoff_max)
