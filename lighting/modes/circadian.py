from __future__ import annotations

import datetime
import logging
import math

from domain.models import (
    RGB,
    PanelColor,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import clamp, scale_rgb

from .base import LightingMode, RenderContext

logger = logging.getLogger(__name__)


def kelvin_to_rgb(temp_k: float) -> RGB:
    """
    Converts color temperature in Kelvin (1000K - 12000K) to accurate RGB
    using Tanner Helland Planckian locus approximation algorithm.
    Преобразует цветовую температуру в Кельвинах (1000K - 12000K) в точный RGB
    по алгоритму Планковского излучения (Tanner Helland algorithm).
    """
    temp = clamp(temp_k, 1000, 12000) / 100.0

    # Red channel
    red: float
    if temp <= 66:
        red = 255.0
    else:
        red = 329.698727446 * math.pow(temp - 60, -0.1332047592)
        red = clamp(red, 0.0, 255.0)

    # Green channel
    green: float
    if temp <= 66:
        green = 99.4708025861 * math.log(temp) - 161.1195681661
        green = clamp(green, 0.0, 255.0)
    else:
        green = 288.1221695283 * math.pow(temp - 60, -0.0755148492)
        green = clamp(green, 0.0, 255.0)

    # Blue channel
    blue: float
    if temp >= 66:
        blue = 255.0
    elif temp <= 19:
        blue = 0.0
    else:
        blue = 138.5177312231 * math.log(temp - 10) - 305.0447927307
        blue = clamp(blue, 0.0, 255.0)

    return (round(red), round(green), round(blue))


def calculate_circadian_kelvin(
    current_hour_float: float,
    min_k: float = 1800,
    max_k: float = 6500,
) -> tuple[float, float]:
    """
    Calculates natural sunlight temperature (Kelvin) and brightness factor
    based on current hour of the day (0.0 - 24.0).
    Вычисляет естественную температуру солнечного света (Кельвины) и фактор яркости
    на основе текущего часа суток (0.0 - 24.0).
    """
    h = current_hour_float % 24.0

    if 0.0 <= h < 6.0:
        # Night (1800K, deep warm amber, dimmed) / Ночь (1800K, глубокий теплый янтарный, приглушенная яркость)
        kelvin = min_k
        brightness = 0.35
    elif 6.0 <= h < 9.0:
        # Sunrise (1800K -> 4500K) / Восход (1800K -> 4500K)
        t = (h - 6.0) / 3.0
        kelvin = min_k + (4500 - min_k) * t
        brightness = 0.35 + 0.45 * t
    elif 9.0 <= h < 14.0:
        # Morning/day peak activity (4500K -> 6500K) / Утренний/дневной пик активности (4500K -> 6500K)
        t = (h - 9.0) / 5.0
        kelvin = 4500 + (max_k - 4500) * math.sin(t * math.pi * 0.5)
        brightness = 0.80 + 0.20 * math.sin(t * math.pi * 0.5)
    elif 14.0 <= h < 18.0:
        # Afternoon (6500K -> 4800K) / Вторая половина дня (6500K -> 4800K)
        t = (h - 14.0) / 4.0
        kelvin = max_k - (max_k - 4800) * t
        brightness = 1.0 - 0.20 * t
    elif 18.0 <= h < 21.0:
        # Sunset (4800K -> 2400K, warm evening light) / Закат (4800K -> 2400K, вечерний мягкий свет без синего спектра)
        t = (h - 18.0) / 3.0
        kelvin = 4800 - (4800 - 2400) * t
        brightness = 0.80 - 0.35 * t
    else:
        # Sleep preparation 21:00 - 24:00 (2400K -> 1800K) / 21:00 - 24:00 Подготовка ко сну (2400K -> 1800K)
        t = (h - 21.0) / 3.0
        kelvin = 2400 - (2400 - min_k) * t
        brightness = 0.45 - 0.10 * t

    return kelvin, brightness


class CircadianMode(LightingMode):
    """
    Circadian sunlight lighting mode (24h Natural Sunlight Rhythm).
    Automatically synchronizes color temperature and panel brightness
    with the position of the sun and time of day.

    Режим циркадного освещения (Circadian Sunlight Rhythm).
    Автоматически синхронизирует цветовую температуру и яркость стены
    с естественным положением солнца и временем суток.
    """

    name = "circadian"

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        circ_cfg = context.config.mode.circadian

        if not circ_cfg.enabled:
            logger.debug("CircadianMode is disabled in config")
            return None

        now = datetime.datetime.now()
        current_hour = now.hour + now.minute / 60.0 + now.second / 3600.0

        min_k = circ_cfg.min_temp_k
        max_k = circ_cfg.max_temp_k
        max_brightness = clamp(circ_cfg.brightness_factor, 0.1, 1.0)
        transition_time = circ_cfg.transition_time
        white_channel = int(context.config.logic.white_channel)

        target_kelvin, time_brightness = calculate_circadian_kelvin(current_hour, min_k, max_k)
        effective_brightness = time_brightness * max_brightness

        base_rgb = kelvin_to_rgb(target_kelvin)
        final_rgb = scale_rgb(base_rgb, effective_brightness)

        device_mappings = context.config.mapping.devices
        panel_colors: list[PanelColor] = []
        used_panel_ids: set[int] = set()

        for dev in device_mappings:
            for pid in dev.panel_ids:
                panel_id = int(pid)
                if panel_id <= 0 or panel_id in used_panel_ids:
                    continue
                used_panel_ids.add(panel_id)
                panel_colors.append(
                    PanelColor(
                        panel_id=panel_id,
                        r=final_rgb[0],
                        g=final_rgb[1],
                        b=final_rgb[2],
                        w=white_channel,
                        transition_time=transition_time,
                    )
                )

        if not panel_colors:
            logger.debug("No valid panels found for CircadianMode")
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
                "hour": round(current_hour, 2),
                "kelvin": round(target_kelvin),
                "rgb": list(final_rgb),
                "brightness": round(effective_brightness, 2),
                "panel_count": len(panel_colors),
            },
        )
