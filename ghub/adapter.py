from __future__ import annotations

from typing import Any

from domain.models import BatteryInfo
from domain.ports import BatterySourcePort

from .manager import GHubManager


class GHubBatterySource(BatterySourcePort):
    """
    Adapter implementing BatterySourcePort using GHubManager.
    Адаптер, реализующий BatterySourcePort через GHubManager.
    """

    def __init__(self, ghub: GHubManager) -> None:
        self._ghub = ghub

    def get_batteries(self) -> list[BatteryInfo]:
        """
        Returns a thread-safe snapshot of all known device batteries.
        Возвращает снимок всех известных батарей устройств без риска race condition.
        """
        result: list[BatteryInfo] = []
        devices = self._ghub.get_devices_snapshot()

        for device in devices.values():
            battery = device.get("battery")
            if isinstance(battery, BatteryInfo):
                result.append(battery)

        return result

    def get_devices_snapshot(self) -> dict[str, dict[str, Any]]:
        """
        Returns snapshot of all discovered G HUB hardware devices.
        Возвращает снимок всех обнаруженных устройств G HUB.
        """
        return self._ghub.get_devices_snapshot()
