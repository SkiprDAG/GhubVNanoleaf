from __future__ import annotations

import logging
import math

from domain.models import (
    RGB,
    PanelAnimation,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import clamp, lerp, scale_rgb

from .base import LightingMode, RenderContext

logger = logging.getLogger(__name__)


class AmbientMode(LightingMode):
    """
    Smooth cyclic ambient lighting mode for Nanoleaf panels.
    Panels smoothly transition between palette colors with group phase offsets,
    creating a harmonious flowing atmosphere.

    Режим плавной циклической атмосферной подсветки всех панелей Nanoleaf.
    Панели плавно переливаются между цветами заданной палитры с фазовым сдвигом
    между группами устройств, создавая гармоничную волну без привязки к уровню батарей.
    """

    name = "ambient"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        ambient_cfg = context.config.mode.ambient

        if not ambient_cfg.enabled:
            logger.debug("AmbientMode is disabled in config")
            return None

        palette_raw = ambient_cfg.palette
        if not palette_raw or len(palette_raw) < 2:
            logger.warning("AmbientMode requires at least 2 colors in palette")
            return None

        palette: list[RGB] = [
            (int(c[0]), int(c[1]), int(c[2]))
            for c in palette_raw
        ]

        min_factor = clamp(ambient_cfg.min_brightness_factor, 0.0, 1.0)
        max_factor = clamp(ambient_cfg.max_brightness_factor, 0.0, 1.0)
        if min_factor > max_factor:
            min_factor, max_factor = max_factor, min_factor

        transition_time = max(1, int(ambient_cfg.transition_time))
        phase_offset = clamp(ambient_cfg.phase_offset_per_group, 0.0, 1.0)
        white_channel = int(context.config.logic.white_channel)

        # Collect unique panel IDs per group
        # Сбор уникальных ID панелей по группам
        device_mappings = context.config.mapping.devices
        all_animations: list[PanelAnimation] = []
        used_panel_ids: set[int] = set()

        num_colors = len(palette)

        group_index = 0
        for dev in device_mappings:
            group_panel_ids: list[int] = []
            for pid in dev.panel_ids:
                panel_id = int(pid)
                if panel_id <= 0:
                    continue
                if panel_id in used_panel_ids:
                    logger.warning("Panel ID %d is duplicated in layout, skipping duplicate", panel_id)
                    continue
                used_panel_ids.add(panel_id)
                group_panel_ids.append(panel_id)

            if not group_panel_ids:
                continue

            # Build cyclic frames for this group with deterministic phase offset
            # Построение циклических кадров для группы с детерминированным фазовым сдвигом
            group_phase = group_index * phase_offset
            group_frames: list[tuple[int, int, int, int, int]] = []

            for step in range(num_colors):
                color_idx = (step + group_index) % num_colors
                base_color = palette[color_idx]

                # Deterministic cosine wave brightness variation
                # Детерминированная косинусная вариация яркости
                wave_phase = (step / num_colors) + group_phase
                cosine_val = 0.5 + 0.5 * math.cos(2.0 * math.pi * wave_phase)
                brightness_factor = lerp(min_factor, max_factor, cosine_val)

                scaled_color = scale_rgb(base_color, brightness_factor)
                group_frames.append((
                    scaled_color[0],
                    scaled_color[1],
                    scaled_color[2],
                    white_channel,
                    transition_time,
                ))

            frames_tuple = tuple(group_frames)
            for pid in group_panel_ids:
                all_animations.append(
                    PanelAnimation(
                        panel_id=pid,
                        frames=frames_tuple,
                    )
                )

            group_index += 1

        if not all_animations:
            logger.debug("No valid panels found in layout for AmbientMode")
            return None

        # Sort animations by panel_id for consistent ordering
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
                "transition_time": transition_time,
                "panel_count": len(all_animations),
            },
        )
