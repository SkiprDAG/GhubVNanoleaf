from __future__ import annotations

import logging
from typing import Literal

from domain.models import (
    PanelAnimation,
    PanelColor,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import (
    build_charging_full_entries,
    build_charging_partial_entries,
    build_critical_entries,
    build_group_mappings,
    build_normal_entries,
    clamp,
)

from .base import LightingMode, RenderContext

logger = logging.getLogger(__name__)


class BatteryMode(LightingMode):
    """
    Logitech G HUB peripheral battery visualizer mode.
    Режим визуализации заряда батарей устройств Logitech.
    """

    name = "battery"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        mappings = build_group_mappings(
            context.batteries,
            context.config.mapping.devices,
        )

        if not mappings:
            logger.debug("No configured devices matched active batteries")
            return None

        logic = context.config.logic
        critical_threshold = logic.thresholds.critical

        all_animations: list[PanelAnimation] = []
        needs_custom = False
        used_panel_ids: set[int] = set()

        for mapping in mappings:
            valid_panel_ids = tuple(pid for pid in mapping.panel_ids if pid not in used_panel_ids)
            duplicate_ids = set(mapping.panel_ids) - set(valid_panel_ids)
            if duplicate_ids:
                logger.warning(
                    "Panels %s in group %r already assigned to another group, skipping duplicate panels",
                    sorted(duplicate_ids),
                    mapping.label,
                )

            if not valid_panel_ids:
                continue

            used_panel_ids.update(valid_panel_ids)
            battery = mapping.battery
            percentage = int(clamp(battery.percentage, 0, 100))

            if battery.charging and (battery.fully_charged or percentage >= 100):
                entries = build_charging_full_entries(
                    valid_panel_ids,
                    mapping.base_color,
                    logic,
                )
                needs_custom = True

            elif battery.charging:
                entries = build_charging_partial_entries(
                    valid_panel_ids,
                    mapping.base_color,
                    percentage,
                    logic,
                )
                needs_custom = True

            elif battery.critical or percentage <= critical_threshold:
                entries = build_critical_entries(
                    valid_panel_ids,
                    mapping.base_color,
                    percentage,
                    logic,
                )
                needs_custom = True

            else:
                entries = build_normal_entries(
                    valid_panel_ids,
                    mapping.base_color,
                    percentage,
                    logic,
                )

            all_animations.extend(entries)

        panel_colors: list[PanelColor] = []
        if not needs_custom:
            for anim in all_animations:
                r, g, b, w, transition_time = anim.frames[0]
                panel_colors.append(
                    PanelColor(
                        panel_id=anim.panel_id,
                        r=r,
                        g=g,
                        b=b,
                        w=w,
                        transition_time=transition_time,
                    )
                )

        anim_type: Literal["static", "custom"] = "custom" if needs_custom else "static"
        panel_colors_tuple = tuple(panel_colors)
        panel_animations_tuple = tuple(all_animations)

        fingerprint = compute_render_fingerprint(
            anim_type=anim_type,
            panel_colors=panel_colors_tuple,
            panel_animations=panel_animations_tuple,
            config_revision=context.config.revision,
        )

        devices_meta = {
            m.battery.device_id: {
                "name": m.battery.name,
                "percentage": m.battery.percentage,
                "charging": m.battery.charging,
                "critical": m.battery.critical,
            }
            for m in mappings
        }

        return RenderPlan(
            anim_type=anim_type,
            panel_colors=panel_colors_tuple,
            panel_animations=panel_animations_tuple,
            fingerprint=fingerprint,
            metadata={"mode": self.name, "devices": devices_meta},
        )
