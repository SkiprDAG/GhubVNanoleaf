from __future__ import annotations

from domain.models import (
    PanelAnimation,
    PanelColor,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint

from .base import LightingMode, RenderContext


class OffMode(LightingMode):
    """
    Complete blackout mode for all configured panels.
    Режим полного отключения (гашения) всех сконфигурированных панелей.
    """

    name = "off"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        transition_time = context.config.logic.transition_time

        panel_ids: list[int] = []
        for dev in context.config.mapping.devices:
            for pid in dev.panel_ids:
                if int(pid) > 0 and int(pid) not in panel_ids:
                    panel_ids.append(int(pid))

        if not panel_ids:
            return None

        panel_colors = tuple(
            PanelColor(
                panel_id=pid,
                r=0,
                g=0,
                b=0,
                w=0,
                transition_time=transition_time,
            )
            for pid in panel_ids
        )

        panel_animations = tuple(
            PanelAnimation(
                panel_id=pid,
                frames=((0, 0, 0, 0, transition_time),),
            )
            for pid in panel_ids
        )

        fingerprint = compute_render_fingerprint(
            anim_type="static",
            panel_colors=panel_colors,
            panel_animations=panel_animations,
            config_revision=context.config.revision,
        )

        return RenderPlan(
            anim_type="static",
            panel_colors=panel_colors,
            panel_animations=panel_animations,
            fingerprint=fingerprint,
            metadata={"mode": self.name, "state": "off"},
        )
