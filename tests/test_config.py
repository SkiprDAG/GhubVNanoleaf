from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from config.manager import ConfigManager
from config.models import DeviceMappingConfig


class TestConfig(unittest.TestCase):
    def test_invalid_rgb_raises_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            DeviceMappingConfig(
                match="Test",
                label="test",
                panel_ids=[1],
                base_color=[300, 0, 0],  # 300 > 255
            )

        with self.assertRaises(ValidationError):
            DeviceMappingConfig(
                match="Test",
                label="test",
                panel_ids=[1],
                base_color=[0, 0],  # len != 3
            )

    def test_atomic_save_and_reload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cfg_path = Path(tmp_dir) / "config.json"
            manager = ConfigManager(cfg_path)

            manager.set_transition_time(5)
            manager.add_device_mapping(
                match="Mouse",
                label="mouse",
                panel_ids=[1, 2, 3],
                base_color=[255, 128, 0],
            )

            success = manager.save()
            self.assertTrue(success)
            self.assertTrue(cfg_path.exists())

            # Load into new manager
            reloaded_manager = ConfigManager(cfg_path)
            self.assertEqual(reloaded_manager.get_transition_time(), 5)
            self.assertIsNotNone(reloaded_manager.find_device_mapping("Mouse G502"))

    def test_revision_increments_on_changes(self) -> None:
        manager = ConfigManager()
        initial_rev = manager.get_config().revision

        manager.set_active_mode("solid")
        self.assertEqual(manager.get_config().revision, initial_rev + 1)

        manager.set_brightness_scale_enabled(False)
        self.assertEqual(manager.get_config().revision, initial_rev + 2)

    def test_set_critical_warning_color_fix(self) -> None:
        manager = ConfigManager()
        # Ensure List(value) bug is fixed and does not raise TypeError
        manager.set_critical_warning_color([255, 50, 50])
        color = manager.get_critical_warning_color()
        self.assertEqual(color, [255, 50, 50])

    def test_set_charging_partial_min_factor_float_fix(self) -> None:
        manager = ConfigManager()
        # Ensure float value is not cast to int
        manager.set_charging_partial_min_factor(0.18)
        self.assertAlmostEqual(manager.get_charging_partial_min_factor(), 0.18)

    def test_device_mapping_crud(self) -> None:
        manager = ConfigManager()
        manager.set_device_mappings([])

        manager.add_device_mapping("G502", "mouse", [10, 11], [100, 200, 50])
        self.assertEqual(len(manager.get_device_mappings()), 1)

        updated = manager.update_device_mapping("G502", base_color=[120, 220, 70])
        self.assertTrue(updated)
        self.assertEqual(manager.get_device_mappings()[0]["base_color"], [120, 220, 70])

        removed = manager.remove_device_mapping("G502")
        self.assertTrue(removed)
        self.assertEqual(len(manager.get_device_mappings()), 0)

    def test_get_device_mapping_exact(self) -> None:
        manager = ConfigManager()
        manager.set_device_mappings([
            {"match": "PRO", "label": "old_pro", "panel_ids": [1], "base_color": [255, 0, 0]},
        ])
        manager.add_device_mapping("PRO X 2", "new_headset", [2], [0, 255, 0])
        self.assertEqual(len(manager.get_device_mappings()), 2)
        exact = manager.get_device_mapping_exact("PRO X 2")
        self.assertIsNotNone(exact)
        assert exact is not None
        self.assertEqual(exact["label"], "new_headset")

    def test_ambient_config_defaults(self) -> None:
        manager = ConfigManager()
        amb = manager.get_ambient_config()
        self.assertTrue(amb.enabled)
        self.assertEqual(len(amb.palette), 3)
        self.assertAlmostEqual(amb.min_brightness_factor, 0.18)
        self.assertAlmostEqual(amb.max_brightness_factor, 0.75)
        self.assertEqual(amb.transition_time, 80)

    def test_ambient_config_valid_palette(self) -> None:
        from config.models import AmbientModeConfig
        cfg = AmbientModeConfig(
            palette=[[10, 20, 30], [40, 50, 60], [70, 80, 90]],
            min_brightness_factor=0.2,
            max_brightness_factor=0.8,
        )
        self.assertEqual(len(cfg.palette), 3)

    def test_ambient_config_invalid_palette_too_short(self) -> None:
        from config.models import AmbientModeConfig
        with self.assertRaises(ValidationError):
            AmbientModeConfig(palette=[[10, 20, 30]])  # only 1 color

    def test_ambient_config_invalid_palette_too_long(self) -> None:
        from config.models import AmbientModeConfig
        with self.assertRaises(ValidationError):
            AmbientModeConfig(
                palette=[
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9],
                    [10, 11, 12],
                    [13, 14, 15],
                    [16, 17, 18],
                    [19, 20, 21],  # 7 colors > 6
                ]
            )

    def test_ambient_config_invalid_rgb_channels(self) -> None:
        from config.models import AmbientModeConfig
        with self.assertRaises(ValidationError):
            AmbientModeConfig(palette=[[300, 0, 0], [0, 255, 0]])

    def test_ambient_config_min_greater_than_max_brightness(self) -> None:
        from config.models import AmbientModeConfig
        with self.assertRaises(ValidationError):
            AmbientModeConfig(
                min_brightness_factor=0.9,
                max_brightness_factor=0.2,  # min > max
            )

    def test_ambient_config_invalid_transition_time(self) -> None:
        from config.models import AmbientModeConfig
        with self.assertRaises(ValidationError):
            AmbientModeConfig(transition_time=0)  # ge=1 required


if __name__ == "__main__":
    unittest.main()

