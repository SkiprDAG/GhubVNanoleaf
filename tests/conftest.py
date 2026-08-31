from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from config.models import (
    AppConfig,
    DeviceMappingConfig,
    LogicConfig,
    ModeConfig,
)
from domain.models import BatteryInfo, RenderPlan
from domain.ports import BatterySourcePort, LightingOutputPort


class FakeLightingOutput(LightingOutputPort):
    def __init__(self, panel_ids: list[int] | None = None) -> None:
        self.applied_plans: list[RenderPlan] = []
        self.panel_ids: list[int] = panel_ids if panel_ids is not None else [101, 102, 103, 201, 202, 203, 301]

    def apply_render_plan(self, plan: RenderPlan) -> None:
        self.applied_plans.append(plan)

    def get_panel_ids(self) -> list[int]:
        return list(self.panel_ids)

    def get_layout_geometry(self) -> list[dict[str, Any]]:
        # Generates mock hexagon/triangle coordinates for testing
        res: list[dict[str, Any]] = []
        for i, pid in enumerate(self.panel_ids):
            res.append({
                "panel_id": pid,
                "x": float(i * 120),
                "y": float((i % 2) * 100),
                "orientation": float((i * 60) % 360),
                "shape_type": 7 if pid < 300 else 0,
                "side_length": 100,
            })
        return res



class FakeBatterySource(BatterySourcePort):
    def __init__(
        self,
        batteries: Iterable[BatteryInfo] = (),
        devices_snapshot: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        self.batteries: list[BatteryInfo] = list(batteries)
        self.devices_snapshot = devices_snapshot

    def get_batteries(self) -> list[BatteryInfo]:
        return list(self.batteries)

    def set_batteries(self, batteries: Iterable[BatteryInfo]) -> None:
        self.batteries = list(batteries)

    def get_devices_snapshot(self) -> dict[str, dict[str, Any]]:
        if self.devices_snapshot is not None:
            return dict(self.devices_snapshot)
        res: dict[str, dict[str, Any]] = {}
        for b in self.batteries:
            res[b.device_id] = {
                "id": b.device_id,
                "name": b.name,
                "device_type": "HEADSET" if "Headset" in b.name else "KEYBOARD" if "Keyboard" in b.name else "MOUSE",
                "has_battery": True,
                "battery": b,
            }
        return res



def make_test_config() -> AppConfig:
    return AppConfig(
        revision=1,
        mode=ModeConfig(active="battery"),
        logic=LogicConfig(),
        mapping={"devices": [
            DeviceMappingConfig(
                match="PRO X 2",
                label="headset",
                panel_ids=[101, 102, 103],
                base_color=[200, 0, 200],
            ),
            DeviceMappingConfig(
                match="G915",
                label="keyboard",
                panel_ids=[201, 202, 203],
                base_color=[0, 200, 200],
            ),
        ]},
    )
