from __future__ import annotations

import unittest

from domain.models import BatteryInfo
from lighting.modes import (
    AmbientMode,
    AudioMode,
    BatteryMode,
    CircadianMode,
    OffMode,
    PomodoroMode,
    RenderContext,
    SolidMode,
    VortexMode,
    WaveMode,
)
from lighting.registry import ModeRegistry
from tests.conftest import make_test_config


class TestModes(unittest.TestCase):
    def test_battery_mode_plan(self) -> None:
        mode = BatteryMode()
        cfg = make_test_config()
        batteries = (
            BatteryInfo(
                device_id="dev1",
                name="PRO X 2 Headset",
                percentage=50,
                charging=False,
                critical=False,
                fully_charged=False,
            ),
        )

        plan = mode.build_plan(RenderContext(batteries=batteries, config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "static")
        self.assertEqual(len(plan.panel_colors), 3)
        self.assertEqual(plan.panel_colors[0].panel_id, 101)

    def test_battery_mode_critical_threshold_behavior(self) -> None:
        mode = BatteryMode()
        cfg = make_test_config()
        cfg.logic.thresholds.critical = 10

        # Case 1: Battery at 15% (even if raw ghub critical flag is True) -> should be NORMAL static mode
        battery_15 = (
            BatteryInfo(
                device_id="dev1",
                name="PRO X 2 Headset",
                percentage=15,
                charging=False,
                critical=True,  # Raw G HUB flag is True at 15%
                fully_charged=False,
            ),
        )
        plan_15 = mode.build_plan(RenderContext(batteries=battery_15, config=cfg))
        self.assertIsNotNone(plan_15)
        assert plan_15 is not None
        self.assertEqual(plan_15.anim_type, "static")
        self.assertFalse(plan_15.metadata["devices"]["dev1"]["critical"])

        # Case 2: Battery at 10% -> must trigger CRITICAL animation plan
        battery_10 = (
            BatteryInfo(
                device_id="dev1",
                name="PRO X 2 Headset",
                percentage=10,
                charging=False,
                critical=True,
                fully_charged=False,
            ),
        )
        plan_10 = mode.build_plan(RenderContext(batteries=battery_10, config=cfg))
        self.assertIsNotNone(plan_10)
        assert plan_10 is not None
        self.assertEqual(plan_10.anim_type, "custom")
        self.assertTrue(plan_10.metadata["devices"]["dev1"]["critical"])

    def test_solid_mode_plan(self) -> None:
        mode = SolidMode()
        cfg = make_test_config()
        cfg.mode.solid.color = [100, 200, 50]
        cfg.mode.solid.factor = 0.5

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "static")
        self.assertEqual(len(plan.panel_colors), 6)
        self.assertEqual(plan.panel_colors[0].r, 50)
        self.assertEqual(plan.panel_colors[0].g, 100)
        self.assertEqual(plan.panel_colors[0].b, 25)

    def test_off_mode_plan(self) -> None:
        mode = OffMode()
        cfg = make_test_config()

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "static")
        self.assertEqual(len(plan.panel_colors), 6)
        self.assertEqual(plan.panel_colors[0].r, 0)
        self.assertEqual(plan.panel_colors[0].g, 0)
        self.assertEqual(plan.panel_colors[0].b, 0)

    def test_ambient_mode_plan(self) -> None:
        mode = AmbientMode()
        cfg = make_test_config()

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "custom")
        self.assertEqual(len(plan.panel_animations), 6)
        self.assertEqual(plan.panel_animations[0].panel_id, 101)
        self.assertEqual(len(plan.panel_animations[0].frames), 3)

    def test_ambient_mode_palette_validation(self) -> None:
        mode = AmbientMode()
        cfg = make_test_config()
        cfg.mode.ambient.palette = [[200, 100, 50]]  # only 1 color

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNone(plan)

    def test_ambient_mode_fingerprint_changes_on_palette(self) -> None:
        mode = AmbientMode()
        cfg1 = make_test_config()
        cfg2 = make_test_config()
        cfg2.mode.ambient.palette = [[255, 0, 100], [0, 255, 200]]

        plan1 = mode.build_plan(RenderContext(batteries=(), config=cfg1))
        plan2 = mode.build_plan(RenderContext(batteries=(), config=cfg2))
        self.assertIsNotNone(plan1)
        self.assertIsNotNone(plan2)
        assert plan1 is not None
        assert plan2 is not None
        self.assertNotEqual(plan1.fingerprint, plan2.fingerprint)

    def test_ambient_mode_disabled_returns_none(self) -> None:
        mode = AmbientMode()
        cfg = make_test_config()
        cfg.mode.ambient.enabled = False

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNone(plan)

    def test_vortex_mode_plan(self) -> None:
        mode = VortexMode()
        cfg = make_test_config()

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "custom")
        self.assertEqual(len(plan.panel_animations), 6)
        self.assertEqual(plan.panel_animations[0].panel_id, 101)

    def test_wave_mode_plan(self) -> None:
        mode = WaveMode()
        cfg = make_test_config()

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "custom")
        self.assertEqual(len(plan.panel_animations), 6)
        self.assertEqual(plan.panel_animations[0].panel_id, 101)

    def test_pomodoro_mode_plan(self) -> None:
        mode = PomodoroMode()
        cfg = make_test_config()
        cfg.mode.pomodoro.state = "work"
        cfg.mode.pomodoro.elapsed_seconds = 12 * 60  # half-way through 25 min

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "static")
        self.assertEqual(len(plan.panel_colors), 6)

    def test_pomodoro_mode_tick_second(self) -> None:
        cfg = make_test_config()
        pomo = cfg.mode.pomodoro
        pomo.state = "work"
        pomo.work_duration_min = 25
        pomo.break_duration_min = 5
        pomo.elapsed_seconds = 24 * 60 + 58  # 1498s / 1500s

        # Tick 1: 1499s
        switched = PomodoroMode.tick_second(pomo)
        self.assertFalse(switched)
        self.assertEqual(pomo.elapsed_seconds, 1499)
        self.assertEqual(pomo.state, "work")

        # Tick 2: 1500s -> switches to break!
        switched = PomodoroMode.tick_second(pomo)
        self.assertTrue(switched)
        self.assertEqual(pomo.state, "break")
        self.assertEqual(pomo.elapsed_seconds, 0)
        self.assertEqual(pomo.current_cycle, 2)

        # Tick in idle state returns False without changing seconds
        pomo.state = "idle"
        switched = PomodoroMode.tick_second(pomo)
        self.assertFalse(switched)

    def test_circadian_mode_plan(self) -> None:
        mode = CircadianMode()
        cfg = make_test_config()

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "static")
        self.assertEqual(len(plan.panel_colors), 6)

    def test_audio_mode_plan(self) -> None:
        mode = AudioMode()
        cfg = make_test_config()

        plan = mode.build_plan(RenderContext(batteries=(), config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.anim_type, "static")
        self.assertEqual(len(plan.panel_colors), 6)


    def test_mode_registry(self) -> None:
        registry = ModeRegistry([
            BatteryMode(),
            SolidMode(),
            OffMode(),
            AmbientMode(),
            VortexMode(),
            WaveMode(),
            PomodoroMode(),
            CircadianMode(),
            AudioMode(),
        ])

        self.assertIn("pomodoro", registry.names())
        self.assertIn("circadian", registry.names())
        self.assertIn("audio", registry.names())
        self.assertIsInstance(registry.get("audio"), AudioMode)

        with self.assertRaises(ValueError) as ctx:
            registry.get("rainbow")
        self.assertIn("Available modes", str(ctx.exception))

    def test_battery_mode_with_overlapping_panels_graceful_dedup(self) -> None:
        mode = BatteryMode()
        cfg = make_test_config()
        # Add duplicate panel 101 to second group
        cfg.mapping.devices[1].panel_ids = [101, 201, 202]

        batteries = (
            BatteryInfo(
                device_id="dev1",
                name="PRO X 2 Headset",
                percentage=50,
                charging=False,
                critical=False,
                fully_charged=False,
            ),
            BatteryInfo(
                device_id="dev2",
                name="G915 Keyboard",
                percentage=70,
                charging=False,
                critical=False,
                fully_charged=False,
            ),
        )

        plan = mode.build_plan(RenderContext(batteries=batteries, config=cfg))
        self.assertIsNotNone(plan)
        assert plan is not None
        # Panel 101 assigned to first group, remaining unique panels in second group are 201, 202
        panel_ids = [p.panel_id for p in plan.panel_colors]
        self.assertEqual(len(panel_ids), len(set(panel_ids)))
        self.assertIn(101, panel_ids)
        self.assertIn(201, panel_ids)
        self.assertIn(202, panel_ids)


if __name__ == "__main__":
    unittest.main()
