from __future__ import annotations

import logging

from domain.models import (
    RGB,
    PanelAnimation,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import clamp, scale_rgb

from .base import LightingMode, RenderContext

logger = logging.getLogger(__name__)


class VortexMode(LightingMode):
    """
    Turbine vortex spinning light mode inside panel clusters.
    Panels ignite sequentially in circular patterns with a smooth trailing tail.

    Режим циклического вращения света («турбина / вихрь») внутри каждого шестиугольника.
    Панели каждого кластера последовательно вспыхивают по кругу с неоновым шлейфом.
    """

    name = "vortex"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        vortex_cfg = context.config.mode.vortex

        if not vortex_cfg.enabled:
            logger.debug("VortexMode is disabled in config")
            return None

        palette_raw = vortex_cfg.palette
        if not palette_raw:
            logger.warning("VortexMode requires at least 1 color in palette")
            return None

        palette: list[RGB] = [
            (int(c[0]), int(c[1]), int(c[2]))
            for c in palette_raw
        ]

        speed_ms = vortex_cfg.speed_ms
        transition_time = max(1, round(speed_ms / 100))
        clockwise = vortex_cfg.clockwise
        trail_length = int(clamp(vortex_cfg.trail_length, 1, 5))
        white_channel = int(context.config.logic.white_channel)

        device_mappings = context.config.mapping.devices
        all_animations: list[PanelAnimation] = []
        used_panel_ids: set[int] = set()

        num_colors = len(palette)

        for group_idx, dev in enumerate(device_mappings):
            group_panel_ids: list[int] = []
            for pid in dev.panel_ids:
                panel_id = int(pid)
                if panel_id <= 0 or panel_id in used_panel_ids:
                    continue
                used_panel_ids.add(panel_id)
                group_panel_ids.append(panel_id)

            if not group_panel_ids:
                continue

            num_panels = len(group_panel_ids)
            cluster_color = palette[group_idx % num_colors]

            # If counter-clockwise, invert sequence / Инвертирование последовательности при вращении против часовой
            ordered_panel_ids = group_panel_ids if clockwise else list(reversed(group_panel_ids))

            # Trail brightness decay curve / Кривая затухания шлейфа
            trail_weights = [1.0, 0.55, 0.25, 0.10, 0.04][:trail_length]

            panel_frames_map: dict[int, list[tuple[int, int, int, int, int]]] = {
                pid: [] for pid in ordered_panel_ids
            }

            for step in range(num_panels):
                for p_idx, pid in enumerate(ordered_panel_ids):
                    # Distance behind the current leading step / Дистанция позади ведущего шага
                    dist = (step - p_idx) % num_panels
                    if dist < len(trail_weights):
                        weight = trail_weights[dist]
                    else:
                        weight = 0.03  # Subtle ambient glow / Фоновое свечение

                    scaled_rgb = scale_rgb(cluster_color, weight)
                    panel_frames_map[pid].append((
                        scaled_rgb[0],
                        scaled_rgb[1],
                        scaled_rgb[2],
                        white_channel,
                        transition_time,
                    ))

            for pid, frames in panel_frames_map.items():
                all_animations.append(
                    PanelAnimation(
                        panel_id=pid,
                        frames=tuple(frames),
                    )
                )

        if not all_animations:
            logger.debug("No valid panels found for VortexMode")
            return None

        all_animations.sort(key=lambda a: a.panel_id)
        panel_animations_tuple = tuple(all_animations)

        fingerprint = compute_render_fingerprint(
            anim_type="custom",
            panel_colors=(),
            panel_animations=panel_animations_tuple,
            config_revision=context.config.revision,
        )

        return RenderPlan(
            anim_type="custom",
            panel_colors=(),
            panel_animations=panel_animations_tuple,
            fingerprint=fingerprint,
            metadata={
                "mode": self.name,
                "palette": palette_raw,
                "speed_ms": speed_ms,
                "clockwise": clockwise,
                "panel_count": len(all_animations),
            },
        )
