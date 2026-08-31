from __future__ import annotations

import logging

from domain.models import (
    RGB,
    PanelColor,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import clamp, scale_rgb

from .base import LightingMode, RenderContext

logger = logging.getLogger(__name__)


class AudioMode(LightingMode):
    """
    Audio reactive music visualizer mode.
    Driven in real-time by AudioEngine via WASAPI loopback / microphone capture.

    Режим спектрографа и музыкального визуализатора (Audio Reactive Visualizer).
    Управляется в реальном времени AudioEngine по микрофону / системному аудио.
    """

    name = "audio"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        audio_cfg = context.config.mode.audio

        if not audio_cfg.enabled:
            logger.debug("AudioMode is disabled in config")
            return None

        bass_rgb: RGB = (
            int(audio_cfg.bass_color[0]),
            int(audio_cfg.bass_color[1]),
            int(audio_cfg.bass_color[2]),
        )
        mid_rgb: RGB = (
            int(audio_cfg.mid_color[0]),
            int(audio_cfg.mid_color[1]),
            int(audio_cfg.mid_color[2]),
        )
        high_rgb: RGB = (
            int(audio_cfg.high_color[0]),
            int(audio_cfg.high_color[1]),
            int(audio_cfg.high_color[2]),
        )

        min_brightness = clamp(audio_cfg.min_brightness, 0.02, 0.3)
        device_mappings = context.config.mapping.devices
        white_channel = int(context.config.logic.white_channel)
        preset = audio_cfg.preset

        cluster_colors = [bass_rgb, mid_rgb, high_rgb]

        panel_colors: list[PanelColor] = []

        for g_idx, dev in enumerate(device_mappings):
            base_col = cluster_colors[g_idx % len(cluster_colors)]
            r, g, b = scale_rgb(base_col, min_brightness)

            for pid in dev.panel_ids:
                panel_id = int(pid)
                if panel_id <= 0:
                    continue
                panel_colors.append(
                    PanelColor(
                        panel_id=panel_id,
                        r=r,
                        g=g,
                        b=b,
                        w=white_channel,
                        transition_time=1,
                    )
                )

        if not panel_colors:
            logger.debug("No valid panels found for AudioMode")
            return None

        panel_colors.sort(key=lambda p: p.panel_id)
        panel_colors_tuple = tuple(panel_colors)

        fingerprint = compute_render_fingerprint(
            anim_type="static",
            panel_colors=panel_colors_tuple,
            panel_animations=(),
            config_revision=context.config.revision,
        )

        return RenderPlan(
            anim_type="static",
            panel_colors=panel_colors_tuple,
            panel_animations=(),
            fingerprint=fingerprint,
            metadata={
                "mode": self.name,
                "preset": preset,
                "sensitivity": audio_cfg.sensitivity,
                "panel_count": len(panel_colors),
            },
        )
