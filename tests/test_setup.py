from __future__ import annotations

import asyncio
import unittest

from config.manager import ConfigManager
from control.setup_coordinator import MappingSetupCoordinator
from domain.models import BatteryInfo
from lighting.modes import AmbientMode, BatteryMode, OffMode, SolidMode
from lighting.registry import ModeRegistry
from lighting.service import LightingService
from tests.conftest import FakeBatterySource, FakeLightingOutput, make_test_config


class TestSetupCoordinator(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.output = FakeLightingOutput(panel_ids=[101, 102, 103, 201, 202, 203, 301, 302])
        self.battery = BatteryInfo(
            device_id="dev1",
            name="PRO X 2 Headset",
            percentage=85,
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

        self.coordinator = MappingSetupCoordinator(
            config=self.config_manager,
            lighting=self.lighting_service,
            source=self.source,
            output=self.output,
        )

    def test_discovered_devices_mapping_status(self) -> None:
        # Add an unmapped device
        devices = self.source.get_devices_snapshot()
        devices["dev2"] = {
            "id": "dev2",
            "name": "Logitech G502 X PLUS",
            "device_type": "MOUSE",
            "has_battery": True,
            "battery": BatteryInfo(
                device_id="dev2",
                name="Logitech G502 X PLUS",
                percentage=50,
                charging=False,
                critical=False,
                fully_charged=False,
            ),
        }
        self.source.devices_snapshot = devices

        discovered = self.coordinator.get_discovered_devices()
        self.assertEqual(len(discovered), 2)

        headset = next(d for d in discovered if "PRO X 2" in d["name"])
        self.assertTrue(headset["is_mapped"])
        self.assertEqual(headset["mapped_match"], "PRO X 2")
        self.assertEqual(headset["mapped_label"], "headset")

        mouse = next(d for d in discovered if "G502" in d["name"])
        self.assertFalse(mouse["is_mapped"])

    async def test_discovered_panels_filtering_and_conflicts(self) -> None:
        panels = await self.coordinator.get_discovered_panels()
        # [101, 102, 103, 201, 202, 203, 301, 302] -> 8 panels
        self.assertEqual(len(panels), 8)

        p101 = next(p for p in panels if p["panel_id"] == 101)
        self.assertTrue(p101["is_assigned"])
        self.assertEqual(p101["assigned_group_label"], "headset")
        self.assertFalse(p101["has_conflict"])

        p301 = next(p for p in panels if p["panel_id"] == 301)
        self.assertFalse(p301["is_assigned"])
        self.assertIsNone(p301["assigned_group_label"])

    async def test_discovered_panels_detects_conflicts(self) -> None:
        # Intentionally assign panel 101 to second group
        self.config_manager.add_device_mapping("Mouse", "mouse", [101, 301], [10, 20, 30])
        panels = await self.coordinator.get_discovered_panels()

        p101 = next(p for p in panels if p["panel_id"] == 101)
        self.assertTrue(p101["has_conflict"])
        self.assertEqual(len(p101["conflict_group_labels"]), 2)
        self.assertIn("headset", p101["conflict_group_labels"])
        self.assertIn("mouse", p101["conflict_group_labels"])

    async def test_identify_single_panel(self) -> None:
        await self.coordinator.identify_panel(102, color=[255, 255, 0], duration_ms=150)
        self.assertGreaterEqual(len(self.output.applied_plans), 1)
        last_plan = self.output.applied_plans[-1]
        self.assertEqual(last_plan.metadata.get("mode"), "setup_identify")
        self.assertEqual(last_plan.metadata.get("identifying_panel"), 102)

        # Check color of 102 vs other panels
        c102 = next(c for c in last_plan.panel_colors if c.panel_id == 102)
        self.assertEqual((c102.r, c102.g, c102.b), (255, 255, 0))

        c101 = next(c for c in last_plan.panel_colors if c.panel_id == 101)
        self.assertEqual((c101.r, c101.g, c101.b), (0, 0, 0))

        # Wait for auto-restore
        await asyncio.sleep(0.2)
        restored_plan = self.output.applied_plans[-1]
        self.assertEqual(restored_plan.metadata.get("mode"), "battery")

    async def test_identify_cycle_lifecycle(self) -> None:
        await self.coordinator.start_identify_cycle([101, 102], color=[0, 255, 255], step_duration_ms=200, repeat=False)
        self.assertTrue(self.coordinator.get_session_state()["cycle_running"])

        await asyncio.sleep(0.3)
        await self.coordinator.stop_identify_cycle()
        self.assertFalse(self.coordinator.get_session_state()["cycle_running"])

        # Restores normal mode
        restored_plan = self.output.applied_plans[-1]
        self.assertEqual(restored_plan.metadata.get("mode"), "battery")

    async def test_preview_group_and_clear(self) -> None:
        await self.coordinator.preview_group([101, 102], color=[255, 0, 128])
        self.assertTrue(self.coordinator.get_session_state()["preview_active"])

        preview_plan = self.output.applied_plans[-1]
        self.assertEqual(preview_plan.metadata.get("mode"), "setup_preview")

        c101 = next(c for c in preview_plan.panel_colors if c.panel_id == 101)
        self.assertEqual((c101.r, c101.g, c101.b), (255, 0, 128))

        await self.coordinator.clear_preview()
        self.assertFalse(self.coordinator.get_session_state()["preview_active"])
        self.assertEqual(self.output.applied_plans[-1].metadata.get("mode"), "battery")

    async def test_save_mapping_validation_conflicts(self) -> None:
        # Panel 101 is already in "PRO X 2"
        with self.assertRaises(ValueError) as ctx:
            await self.coordinator.save_mapping(
                label="mouse",
                match="G502",
                panel_ids=[101, 301],
                base_color=[100, 200, 50],
            )
        self.assertIn("already assigned", str(ctx.exception))

    async def test_save_mapping_validation_invalid_panel(self) -> None:
        with self.assertRaises(ValueError) as ctx:
            await self.coordinator.save_mapping(
                label="mouse",
                match="G502",
                panel_ids=[999],  # Non-existent panel
                base_color=[100, 200, 50],
            )
        self.assertIn("do not exist in Nanoleaf layout", str(ctx.exception))

    async def test_save_mapping_success(self) -> None:
        initial_rev = self.config_manager.get_config().revision
        await self.coordinator.save_mapping(
            label="mouse",
            match="G502",
            panel_ids=[301, 302],
            base_color=[0, 255, 120],
        )

        self.assertEqual(self.config_manager.get_config().revision, initial_rev + 1)
        mapping = self.config_manager.find_device_mapping("G502")
        self.assertIsNotNone(mapping)
        assert mapping is not None
        self.assertEqual(mapping["panel_ids"], [301, 302])


if __name__ == "__main__":
    unittest.main()
