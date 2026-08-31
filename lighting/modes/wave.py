from __future__ import annotations

import logging

from domain.models import (
    RGB,
    PanelAnimation,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import scale_rgb

from .base import LightingMode, RenderContext

logger = logging.getLogger(__name__)


class WaveMode(LightingMode):
    """
    Horizontal running neon light wave mode (Left-to-Right / Bounce).
    Creates a smooth kinetic light wave rolling across the entire installation.

    Режим горизонтальной бегущей неоновой волны слева направо (Наушники -> Клавиатура -> Мышь).
    Создает плавный световой перекат энергии через всю инсталляцию.
    """

    name = "wave"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        wave_cfg = context.config.mode.wave

        if not wave_cfg.enabled:
            logger.debug("WaveMode is disabled in config")
            return None

        palette_raw = wave_cfg.palette
        if not palette_raw:
            logger.warning("WaveMode requires at least 1 color in palette")
            return None

        palette: list[RGB] = [
            (int(c[0]), int(c[1]), int(c[2]))
            for c in palette_raw
        ]

        speed_ms = wave_cfg.speed_ms
        transition_time = max(1, round(speed_ms / 100))
        direction = wave_cfg.direction  # "left_to_right", "right_to_left", "bounce"
        white_channel = int(context.config.logic.white_channel)

        device_mappings = context.config.mapping.devices
        if not device_mappings:
            return None

        all_animations: list[PanelAnimation] = []
        num_groups = len(device_mappings)
        num_colors = len(palette)

        # Build group sequence based on direction
        # E.g. for 3 groups left_to_right: [0, 1, 2]
        # For bounce: [0, 1, 2, 1]
        if direction == "right_to_left":
            steps_order = list(reversed(range(num_groups)))
        elif direction == "bounce" and num_groups > 2:
            steps_order = list(range(num_groups)) + list(reversed(range(1, num_groups - 1)))
        else:
            steps_order = list(range(num_groups))

        total_steps = len(steps_order)
        trail_weights = [1.0, 0.45, 0.15, 0.04]

        for g_idx, dev in enumerate(device_mappings):
            group_color = palette[g_idx % num_colors]
            group_frames: list[tuple[int, int, int, int, int]] = []

            for step_num in range(total_steps):
                active_group = steps_order[step_num]
                # Distance of this group from active wave crest
                # Расстояние текущей группы от гребня волны
                dist = abs(active_group - g_idx)
                if dist < len(trail_weights):
                    weight = trail_weights[dist]
                else:
                    weight = 0.03  # Background glow / Фоновое свечение

                scaled = scale_rgb(group_color, weight)
                group_frames.append((
                    scaled[0],
                    scaled[1],
                    scaled[2],
                    white_channel,
                    transition_time,
                ))

            frames_tuple = tuple(group_frames)
            for pid in dev.panel_ids:
                panel_id = int(pid)
                if panel_id <= 0:
                    continue
                all_animations.append(
                    PanelAnimation(
                        panel_id=panel_id,
                        frames=frames_tuple,
                    )
                )

        if not all_animations:
            logger.debug("No valid panels found for WaveMode")
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
                "direction": direction,
                "panel_count": len(all_animations),
            },
        )
