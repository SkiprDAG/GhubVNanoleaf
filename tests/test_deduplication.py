from __future__ import annotations

import unittest

from config.manager import ConfigManager
from domain.models import BatteryInfo
from lighting.modes import AmbientMode, BatteryMode, OffMode, SolidMode
from lighting.registry import ModeRegistry
from lighting.service import LightingService
from tests.conftest import FakeBatterySource, FakeLightingOutput, make_test_config


class TestDeduplication(unittest.IsolatedAsyncioTestCase):
    async def test_deduplication_skips_identical_battery_state(self) -> None:
        output = FakeLightingOutput()
        battery = BatteryInfo(
            device_id="dev1",
            name="PRO X 2 Headset",
            percentage=80,
            charging=False,
            critical=False,
            fully_charged=False,
        )
        source = FakeBatterySource([battery])

        config_manager = ConfigManager()
        config_manager.set_config(make_test_config())

        modes = ModeRegistry([BatteryMode(), SolidMode(), OffMode(), AmbientMode()])
        service = LightingService(output, source, config_manager, modes)

        # First apply -> applied
        plan1 = await service.apply_batteries()
        self.assertIsNotNone(plan1)
        self.assertEqual(len(output.applied_plans), 1)

        # Second apply with same battery state -> skipped (deduplication)
        plan2 = await service.apply_batteries()
        self.assertIsNone(plan2)
        self.assertEqual(len(output.applied_plans), 1)

    async def test_config_change_triggers_rerender_with_same_battery(self) -> None:
        """
        Regression test: when battery level is unchanged but config color changes,
        the render plan MUST recalculate and apply.
        Главный регрессионный тест: при неизменном уровне заряда батарей,
        но изменении цвета в конфиге, план ОБЯЗАН пересчитаться и примениться.
        """
        output = FakeLightingOutput()
        battery = BatteryInfo(
            device_id="dev1",
            name="PRO X 2 Headset",
            percentage=80,
            charging=False,
            critical=False,
            fully_charged=False,
        )
        source = FakeBatterySource([battery])

        config_manager = ConfigManager()
        config_manager.set_config(make_test_config())

        modes = ModeRegistry([BatteryMode(), SolidMode(), OffMode(), AmbientMode()])
        service = LightingService(output, source, config_manager, modes)

        # First apply
        plan1 = await service.apply_batteries()
        self.assertIsNotNone(plan1)

        # Change base color in config (battery remains 80%)
        config_manager.update_device_mapping("PRO X 2", base_color=[0, 255, 0])

        # Second apply with same battery -> MUST apply due to new fingerprint!
        plan2 = await service.apply_batteries()
        self.assertIsNotNone(plan2)
        assert plan1 is not None
        assert plan2 is not None
        self.assertEqual(len(output.applied_plans), 2)
        self.assertNotEqual(plan1.fingerprint, plan2.fingerprint)

    async def test_force_apply_bypasses_fingerprint_check(self) -> None:
        output = FakeLightingOutput()
        battery = BatteryInfo(
            device_id="dev1",
            name="PRO X 2 Headset",
            percentage=80,
            charging=False,
            critical=False,
            fully_charged=False,
        )
        source = FakeBatterySource([battery])

        config_manager = ConfigManager()
        config_manager.set_config(make_test_config())

        modes = ModeRegistry([BatteryMode(), SolidMode(), OffMode(), AmbientMode()])
        service = LightingService(output, source, config_manager, modes)

        plan1 = await service.apply_batteries()
        self.assertIsNotNone(plan1)

        # Force apply with identical state
        plan2 = await service.apply_batteries(force=True)
        self.assertIsNotNone(plan2)
        self.assertEqual(len(output.applied_plans), 2)

    async def test_ambient_mode_deduplication_and_reapply(self) -> None:
        output = FakeLightingOutput()
        source = FakeBatterySource([])

        config_manager = ConfigManager()
        config_manager.set_config(make_test_config())
        config_manager.set_active_mode("ambient")

        modes = ModeRegistry([BatteryMode(), SolidMode(), OffMode(), AmbientMode()])
        service = LightingService(output, source, config_manager, modes)

        # First apply -> applied custom animation
        plan1 = await service.apply_batteries()
        self.assertIsNotNone(plan1)
        assert plan1 is not None
        self.assertEqual(plan1.anim_type, "custom")
        self.assertEqual(len(output.applied_plans), 1)

        # Second apply without config change -> skipped by deduplication
        plan2 = await service.apply_batteries()
        self.assertIsNone(plan2)
        self.assertEqual(len(output.applied_plans), 1)

        # Update ambient palette -> new fingerprint triggers apply
        config_manager.set_ambient_config(palette=[[200, 50, 100], [50, 200, 150]])
        plan3 = await service.apply_batteries()
        self.assertIsNotNone(plan3)
        assert plan3 is not None
        self.assertEqual(len(output.applied_plans), 2)
        self.assertNotEqual(plan1.fingerprint, plan3.fingerprint)


if __name__ == "__main__":
    unittest.main()
