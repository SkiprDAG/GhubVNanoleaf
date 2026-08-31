from __future__ import annotations

from domain.models import (
    PanelAnimation,
    PanelColor,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import scale_rgb

from .base import LightingMode, RenderContext


class SolidMode(LightingMode):
    """
    Static single-color fill mode for configured panels.
    Режим статичной заливки всех сконфигурированных панелей заданным цветом.
    """

    name = "solid"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        solid_cfg = context.config.mode.solid
        raw_color = (solid_cfg.color[0], solid_cfg.color[1], solid_cfg.color[2])
        color = scale_rgb(raw_color, solid_cfg.factor)

        transition_time = solid_cfg.transition_time
        white_channel = context.config.logic.white_channel

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
                r=color[0],
                g=color[1],
                b=color[2],
                w=white_channel,
                transition_time=transition_time,
            )
            for pid in panel_ids
        )

        panel_animations = tuple(
            PanelAnimation(
                panel_id=item.panel_id,
                frames=(
                    (
                        item.r,
                        item.g,
                        item.b,
                        item.w,
                        item.transition_time,
                    ),
                ),
            )
            for item in panel_colors
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
            metadata={
                "mode": self.name,
                "color": list(color),
                "transition_time": transition_time,
            },
        )
