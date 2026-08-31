from __future__ import annotations

import asyncio
import json
import unittest

from starlette.testclient import TestClient

from config.manager import ConfigManager
from control import app, init_api_service
from control.agent_service import AgentManager
from domain.models import BatteryInfo
from lighting.modes import BatteryMode, CircadianMode, OffMode, SolidMode
from lighting.registry import ModeRegistry
from lighting.service import LightingService
from tests.conftest import FakeBatterySource, FakeLightingOutput


class TestAgentProtocol(unittest.TestCase):
    def setUp(self) -> None:
        self.config_manager = ConfigManager()
        self.config_manager.set_device_mappings([
            {"match": "G502", "label": "mouse", "panel_ids": [1], "base_color": [0, 255, 0]},
        ])
        self.output = FakeLightingOutput([1, 2, 3])
        self.source = FakeBatterySource()

        self.modes = ModeRegistry([BatteryMode(), SolidMode(), OffMode(), CircadianMode()])
        self.lighting = LightingService(
            self.output,
            self.source,
            self.config_manager,
            self.modes,
        )

        self.battery_queue: asyncio.Queue[BatteryInfo] = asyncio.Queue()
        self.agent_manager = AgentManager(
            config=self.config_manager,
            lighting=self.lighting,
            battery_queue=self.battery_queue,
        )

        self.api_service = init_api_service(
            config=self.config_manager,
            lighting=self.lighting,
            source=self.source,
            output=self.output,
            agent_manager=self.agent_manager,
        )
        self.client = TestClient(app)

    def test_get_agent_status_endpoint(self) -> None:
        response = self.client.get("/api/agent/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertFalse(data["data"]["pc_online"])
        self.assertEqual(data["data"]["connected_agents_count"], 0)

    def test_update_agent_config_endpoint(self) -> None:
        response = self.client.post(
            "/api/agent/config",
            json={"pc_offline_action": "circadian", "pc_offline_timeout_sec": 20.0},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        cfg = self.config_manager.get_agent_config()
        self.assertEqual(cfg.pc_offline_action, "circadian")
        self.assertEqual(cfg.pc_offline_timeout_sec, 20.0)

    def test_agent_websocket_handshake_and_battery(self) -> None:
        with self.client.websocket_connect("/api/agent/ws") as ws:
            connect_evt = ws.receive_json()
            self.assertEqual(connect_evt["event"], "connected")

            # 1. Check status reflects connected agent
            status = self.agent_manager.get_status()
            self.assertTrue(status["pc_online"])
            self.assertEqual(status["connected_agents_count"], 1)

            # 2. Send Hello message
            hello_msg = {
                "type": "hello",
                "data": {"hostname": "GAMING-RIG", "platform": "Windows-11"},
            }
            ws.send_text(json.dumps(hello_msg))
            ack1 = ws.receive_json()
            self.assertEqual(ack1["event"], "ack")

            # 3. Send Battery update message
            battery_msg = {
                "type": "battery_update",
                "data": {
                    "deviceId": "dev_mouse",
                    "name": "G502 X Mouse",
                    "percentage": 85,
                    "charging": False,
                    "criticalLevel": False,
                },
            }
            ws.send_text(json.dumps(battery_msg))
            ack2 = ws.receive_json()
            self.assertEqual(ack2["event"], "ack")

            # Check battery is queued
            self.assertFalse(self.battery_queue.empty())
            item = self.battery_queue.get_nowait()
            self.assertEqual(item.device_id, "dev_mouse")
            self.assertEqual(item.percentage, 85)

            # 4. Send PC shutdown power state
            shutdown_msg = {"type": "pc_power_state", "state": "shutdown"}
            ws.send_text(json.dumps(shutdown_msg))
            ack3 = ws.receive_json()
            self.assertEqual(ack3["event"], "ack")

            # PC should be marked offline
            self.assertFalse(self.agent_manager.pc_online)

    def test_startup_helpers(self) -> None:
        from agent.startup import get_pythonw_executable, is_startup_installed
        exe = get_pythonw_executable()
        self.assertTrue(exe.endswith(".exe"))
        # Verify check doesn't crash
        status = is_startup_installed()
        self.assertIsInstance(status, bool)


if __name__ == "__main__":
    unittest.main()
