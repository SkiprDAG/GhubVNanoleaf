from __future__ import annotations

import unittest

from config.models import DeviceMappingConfig, LogicConfig
from domain.models import BatteryInfo
from lighting.renderer import (
    apply_brightness_scale,
    build_charging_full_entries,
    build_charging_partial_entries,
    build_critical_entries,
    build_group_mappings,
    lerp,
    lerp_rgb,
    panel_brightness_factors,
    scale_rgb,
)


class TestRenderer(unittest.TestCase):
    def test_lerp_and_scale(self) -> None:
        self.assertAlmostEqual(lerp(0.0, 100.0, 0.5), 50.0)
        self.assertEqual(lerp_rgb((0, 0, 0), (100, 200, 50), 0.5), (50, 100, 25))
        self.assertEqual(scale_rgb((100, 200, 50), 0.5), (50, 100, 25))

    def test_apply_brightness_scale_enabled_vs_disabled(self) -> None:
        base_color = (200, 100, 50)

        # When enabled with min 0.1, max 0.9, factor 0.5 -> lerp is 0.5 -> 50% of base_color
        scaled_enabled = apply_brightness_scale(
            base_color,
            0.5,
            enabled=True,
            min_factor=0.2,
            max_factor=0.8,
        )
        # lerp(0.2, 0.8, 0.5) = 0.5
        self.assertEqual(scaled_enabled, (100, 50, 25))

        # When disabled -> factor 0.5 directly scales base_color
        scaled_disabled = apply_brightness_scale(
            base_color,
            0.5,
            enabled=False,
            min_factor=0.2,
            max_factor=0.8,
        )
        self.assertEqual(scaled_disabled, (100, 50, 25))

    def test_panel_brightness_factors(self) -> None:
        # 3 panels, 100% -> all full
        self.assertEqual(panel_brightness_factors(100, 3), [1.0, 1.0, 1.0])

        # 3 panels, 50% -> first full, second half, third zero
        f50 = panel_brightness_factors(50, 3)
        self.assertAlmostEqual(f50[0], 1.0)
        self.assertAlmostEqual(f50[1], 0.5)
        self.assertAlmostEqual(f50[2], 0.0)

        # 3 panels, 0% -> all zero
        self.assertEqual(panel_brightness_factors(0, 3), [0.0, 0.0, 0.0])

    def test_build_charging_partial_entries(self) -> None:
        logic = LogicConfig()
        panel_ids = (10, 20, 30)
        base_color = (255, 0, 255)

        entries = build_charging_partial_entries(panel_ids, base_color, 50, logic)
        self.assertEqual(len(entries), 3)

        # Panel 0 is full (static), Panel 1 is blinking (2 frames), Panel 2 is off (static 0,0,0)
        self.assertEqual(len(entries[0].frames), 1)
        self.assertEqual(len(entries[1].frames), 2)  # blink frame
        self.assertEqual(len(entries[2].frames), 1)

    def test_build_charging_full_entries(self) -> None:
        logic = LogicConfig()
        panel_ids = (10, 20)
        base_color = (0, 255, 255)

        entries = build_charging_full_entries(panel_ids, base_color, logic)
        self.assertEqual(len(entries), 2)
        # All panels pulse with 2 frames
        self.assertEqual(len(entries[0].frames), 2)
        self.assertEqual(len(entries[1].frames), 2)

    def test_build_critical_entries(self) -> None:
        logic = LogicConfig()
        panel_ids = (10, 20, 30)
        base_color = (0, 255, 0)

        # 5% critical battery
        entries = build_critical_entries(panel_ids, base_color, 5, logic)
        self.assertEqual(len(entries), 3)

        # Active lowest panel (panel 0) pulses with warning_color [255, 0, 0]
        self.assertEqual(len(entries[0].frames), 2)
        warning_frame = entries[0].frames[1]
        self.assertEqual((warning_frame[0], warning_frame[1], warning_frame[2]), (255, 0, 0))

    def test_build_critical_entries_zero_percentage(self) -> None:
        logic = LogicConfig()
        panel_ids = (10, 20, 30)
        base_color = (0, 255, 0)

        # 0% battery (completely discharged) should turn off all panels
        entries = build_critical_entries(panel_ids, base_color, 0, logic)
        self.assertEqual(len(entries), 3)
        for entry in entries:
            self.assertEqual(len(entry.frames), 1)
            frame = entry.frames[0]
            self.assertEqual((frame[0], frame[1], frame[2]), (0, 0, 0))

    def test_build_group_mappings(self) -> None:
        batteries = [
            BatteryInfo(
                device_id="dev1",
                name="PRO X 2 LIGHTSPEED Wireless Gaming Headset",
                percentage=80,
                charging=False,
                critical=False,
                fully_charged=False,
            ),
        ]
        dev_configs = [
            DeviceMappingConfig(
                match="PRO X 2",
                label="headset",
                panel_ids=[101, 102],
                base_color=[255, 0, 255],
            ),
            DeviceMappingConfig(
                match="G502",
                label="mouse",
                panel_ids=[201],
                base_color=[0, 255, 0],
            ),
        ]

        mappings = build_group_mappings(batteries, dev_configs)
        self.assertEqual(len(mappings), 1)
        self.assertEqual(mappings[0].label, "headset")
        self.assertEqual(mappings[0].panel_ids, (101, 102))


if __name__ == "__main__":
    unittest.main()
