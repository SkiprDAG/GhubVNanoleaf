from __future__ import annotations

import unittest

from starlette.testclient import TestClient

from config.manager import ConfigManager
from control import app, init_api_service
from domain.models import BatteryInfo
from lighting.modes import AmbientMode, BatteryMode, OffMode, SolidMode
from lighting.registry import ModeRegistry
from lighting.service import LightingService
from tests.conftest import FakeBatterySource, FakeLightingOutput, make_test_config


class TestApi(unittest.TestCase):
    def setUp(self) -> None:
        self.output = FakeLightingOutput()
        self.battery = BatteryInfo(
            device_id="dev1",
            name="PRO X 2 Headset",
            percentage=80,
            charging=False,
            critical=False,
            fully_charged=False,
        )
        self.source = FakeBatterySource([self.battery])

        self.config_manager = ConfigManager()
        self.config_manager.set_config(make_test_config())

        self.modes = ModeRegistry([BatteryMode(), SolidMode(), OffMode(), AmbientMode()])
        self.lighting_service = LightingService(
            self.output,
            self.source,
            self.config_manager,
            self.modes,
        )


        self.api_service = init_api_service(
            config=self.config_manager,
            lighting=self.lighting_service,
        )

        self.client = TestClient(app)

    def test_get_status_returns_200(self) -> None:
        """
        Regression test for GET /status (previously caused 500 AttributeError).
        Регрессионный тест для GET /status (ранее падал с 500 AttributeError).
        """
        response = self.client.get("/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["active_mode"], "battery")
        self.assertIn("battery", data["available_modes"])
        self.assertEqual(len(data["devices"]), 1)
        self.assertEqual(data["devices"][0]["name"], "PRO X 2 Headset")

    def test_get_config_returns_200(self) -> None:
        response = self.client.get("/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mode"]["active"], "battery")

    def test_post_mode_switch(self) -> None:
        response = self.client.post("/mode", json={"mode": "solid"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(self.config_manager.get_active_mode(), "solid")
        self.assertGreaterEqual(len(self.output.applied_plans), 1)

    def test_post_mode_switch_with_websocket(self) -> None:
        with self.client.websocket_connect("/ws") as ws:
            init_msg = ws.receive_json()
            self.assertEqual(init_msg["event"], "initial_snapshot")

            response = self.client.post("/mode", json={"mode": "solid"})
            self.assertEqual(response.status_code, 200)

            event1 = ws.receive_json()
            self.assertEqual(event1["event"], "config_updated")

            event2 = ws.receive_json()
            self.assertEqual(event2["event"], "render_applied")

    def test_post_mode_switch_invalid_mode(self) -> None:
        response = self.client.post("/mode", json={"mode": "non_existent_mode_xyz"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unknown lighting mode", response.json()["detail"])

    def test_post_device_color_update(self) -> None:
        response = self.client.post(
            "/config/device-color",
            json={"match": "PRO X 2", "base_color": [10, 200, 10]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        dev = self.config_manager.find_device_mapping("PRO X 2")
        self.assertIsNotNone(dev)
        assert dev is not None
        self.assertEqual(dev["base_color"], [10, 200, 10])

    def test_put_full_config(self) -> None:
        cfg = self.config_manager.raw()
        cfg["logic"]["transition_time"] = 7
        response = self.client.put("/config", json=cfg)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(self.config_manager.get_transition_time(), 7)

    def test_post_thresholds(self) -> None:
        response = self.client.post("/config/thresholds", json={"critical": 15})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(self.config_manager.get_critical_threshold(), 15)

    def test_post_solid_mode_update(self) -> None:
        response = self.client.post(
            "/config/solid",
            json={"color": [255, 100, 50], "factor": 0.9, "transition_time": 4},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        cfg = self.config_manager.get_config()
        self.assertEqual(cfg.mode.solid.color, [255, 100, 50])
        self.assertEqual(cfg.mode.solid.factor, 0.9)

    def test_device_mapping_crud(self) -> None:
        # Add new device mapping
        response = self.client.post(
            "/config/mapping/device",
            json={
                "match": "G733",
                "label": "secondary_headset",
                "panel_ids": [101, 102],
                "base_color": [50, 150, 250],
            },
        )
        self.assertEqual(response.status_code, 200)
        dev = self.config_manager.find_device_mapping("G733")
        self.assertIsNotNone(dev)
        assert dev is not None
        self.assertEqual(dev["label"], "secondary_headset")

        # Delete device mapping
        del_resp = self.client.delete("/config/mapping/device/G733")
        self.assertEqual(del_resp.status_code, 200)
        self.assertIsNone(self.config_manager.find_device_mapping("G733"))

    def test_post_mode_switch_to_ambient(self) -> None:
        response = self.client.post("/mode", json={"mode": "ambient"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(self.config_manager.get_active_mode(), "ambient")
        self.assertGreaterEqual(len(self.output.applied_plans), 1)
        self.assertEqual(self.output.applied_plans[-1].anim_type, "custom")

    def test_post_ambient_mode_update(self) -> None:
        response = self.client.post(
            "/config/ambient",
            json={
                "palette": [[10, 50, 150], [20, 100, 200]],
                "min_brightness_factor": 0.1,
                "max_brightness_factor": 0.8,
                "transition_time": 90,
                "phase_offset_per_group": 0.2,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        amb = self.config_manager.get_ambient_config()
        self.assertEqual(len(amb.palette), 2)
        self.assertEqual(amb.palette[0], [10, 50, 150])
        self.assertAlmostEqual(amb.min_brightness_factor, 0.1)
        self.assertAlmostEqual(amb.max_brightness_factor, 0.8)
        self.assertEqual(amb.transition_time, 90)

    def test_post_ambient_mode_invalid_validation(self) -> None:
        # Palette too short (only 1 color)
        response = self.client.post(
            "/config/ambient",
            json={"palette": [[10, 20, 30]]},
        )
        self.assertEqual(response.status_code, 422)

        # min_factor > max_factor
        response = self.client.post(
            "/config/ambient",
            json={"min_brightness_factor": 0.9, "max_brightness_factor": 0.1},
        )
        self.assertEqual(response.status_code, 400)

    def test_get_setup_devices(self) -> None:
        response = self.client.get("/setup/devices")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("devices", data)
        self.assertEqual(len(data["devices"]), 1)
        self.assertEqual(data["devices"][0]["name"], "PRO X 2 Headset")
        self.assertTrue(data["devices"][0]["is_mapped"])

    def test_get_setup_panels(self) -> None:
        response = self.client.get("/setup/panels")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("panels", data)
        self.assertGreaterEqual(len(data["panels"]), 6)

    def test_setup_session_start_stop(self) -> None:
        start_resp = self.client.post("/setup/session/start")
        self.assertEqual(start_resp.status_code, 200)
        self.assertTrue(start_resp.json()["active"])

        stop_resp = self.client.post("/setup/session/stop")
        self.assertEqual(stop_resp.status_code, 200)
        self.assertTrue(stop_resp.json()["ok"])

    def test_setup_identify_panel(self) -> None:
        resp = self.client.post(
            "/setup/panels/101/identify",
            json={"color": [255, 255, 0], "duration_ms": 500},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["ok"])

    def test_setup_preview_and_clear(self) -> None:
        preview_resp = self.client.post(
            "/setup/preview",
            json={"panel_ids": [101, 102], "color": [0, 255, 128], "transition_time": 2},
        )
        self.assertEqual(preview_resp.status_code, 200)

        clear_resp = self.client.post("/setup/preview/clear")
        self.assertEqual(clear_resp.status_code, 200)

    def test_put_layout_group_save(self) -> None:
        save_resp = self.client.put(
            "/config/layout/groups/G502",
            json={
                "match": "G502",
                "label": "mouse",
                "panel_ids": [301],
                "base_color": [0, 200, 255],
            },
        )
        self.assertEqual(save_resp.status_code, 200)
        self.assertTrue(save_resp.json()["ok"])
        mapping = self.config_manager.find_device_mapping("G502")
        self.assertIsNotNone(mapping)
        assert mapping is not None
        self.assertEqual(mapping["panel_ids"], [301])

    def test_put_layout_group_conflict_409(self) -> None:
        # Panel 101 is already mapped to PRO X 2
        save_resp = self.client.put(
            "/config/layout/groups/G502",
            json={
                "match": "G502",
                "label": "mouse",
                "panel_ids": [101],
                "base_color": [0, 200, 255],
            },
        )
        self.assertEqual(save_resp.status_code, 409)

    def test_websocket_initial_snapshot(self) -> None:
        with self.client.websocket_connect("/ws") as ws:
            data = ws.receive_json()
            self.assertEqual(data["event"], "initial_snapshot")
            self.assertIn("status", data["data"])
            self.assertIn("config", data["data"])

    def test_spa_frontend_served(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("<html", response.text.lower())


if __name__ == "__main__":
    unittest.main()


