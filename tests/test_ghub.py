from __future__ import annotations

import asyncio
import json
import unittest

from domain.models import BatteryInfo
from ghub.adapter import GHubBatterySource
from ghub.manager import GHubManager, GHUBMessage


class TestGHub(unittest.TestCase):
    def test_ghub_message_from_json(self) -> None:
        raw = json.dumps({
            "msgId": "123",
            "verb": "BROADCAST",
            "path": "/battery/state/changed",
            "origin": "ghub",
            "payload": {"deviceId": "dev1", "percentage": 85},
        })
        msg = GHUBMessage.from_json(raw)
        self.assertEqual(msg.msg_id, "123")
        self.assertEqual(msg.verb, "BROADCAST")
        self.assertEqual(msg.path, "/battery/state/changed")
        self.assertEqual(msg.payload["percentage"], 85)

    def test_battery_info_from_ghub(self) -> None:
        payload = {
            "percentage": "90",
            "charging": True,
            "criticalLevel": False,
            "fullyCharged": False,
            "mileage": 12.5,
        }
        battery = BatteryInfo.from_ghub(
            device_id="dev1",
            name="G915 Keyboard",
            payload=payload,
        )
        self.assertEqual(battery.device_id, "dev1")
        self.assertEqual(battery.name, "G915 Keyboard")
        self.assertEqual(battery.percentage, 90)
        self.assertTrue(battery.charging)
        self.assertFalse(battery.critical)
        self.assertEqual(battery.mileage, 12.5)

    def test_battery_info_float_string_percentage(self) -> None:
        payload = {
            "percentage": "85.5",
            "charging": False,
            "criticalLevel": False,
            "fullyCharged": False,
        }
        battery = BatteryInfo.from_ghub(
            device_id="dev2",
            name="Mouse",
            payload=payload,
        )
        self.assertEqual(battery.percentage, 86)

    def test_ghub_deduplication(self) -> None:
        q: asyncio.Queue[BatteryInfo] = asyncio.Queue()
        mgr = GHubManager(q)

        sig = "test_event_signature"
        self.assertFalse(mgr._is_duplicate(sig))  # First time: not duplicate
        self.assertTrue(mgr._is_duplicate(sig))   # Second time within window: duplicate!

    def test_ghub_adapter_snapshot(self) -> None:
        q: asyncio.Queue[BatteryInfo] = asyncio.Queue()
        mgr = GHubManager(q)

        # Manually populate internal dictionary
        mgr._devices["dev1"] = {
            "id": "dev1",
            "name": "Mouse",
            "battery": BatteryInfo(
                device_id="dev1",
                name="Mouse",
                percentage=75,
                charging=False,
                critical=False,
                fully_charged=False,
            ),
        }

        source = GHubBatterySource(mgr)
        batteries = source.get_batteries()
        self.assertEqual(len(batteries), 1)
        self.assertEqual(batteries[0].percentage, 75)


if __name__ == "__main__":
    unittest.main()
