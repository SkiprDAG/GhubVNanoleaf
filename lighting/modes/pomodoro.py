from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from domain.models import (
    RGB,
    PanelColor,
    RenderPlan,
)
from lighting.fingerprint import compute_render_fingerprint
from lighting.renderer import clamp, scale_rgb

from .base import LightingMode, RenderContext

if TYPE_CHECKING:
    from config.models import PomodoroModeConfig

logger = logging.getLogger(__name__)


class PomodoroMode(LightingMode):
    """
    Pomodoro productivity and focus timer engine.
    Visualizes work sprint (25m) and break (5m) progress along panel chains
    with focus amber and cool relaxing break tones.

    Режим фокус-таймера Помодоро (Pomodoro Focus & Break Engine).
    Визуализирует прогресс рабочего спринта (25 мин) и перерывов (5 мин)
    заполнением панелей по цепочке теплыми/расслабляющими цветами.
    """

    name = "pomodoro"

    @classmethod
    def tick_second(cls, pomo: PomodoroModeConfig) -> bool:
        """
        Increments timer by 1 second, handles sprint completion, and switches focus/break phases.
        Returns True if a phase transition occurred (work <-> break).

        Инкрементирует таймер на 1 секунду, обрабатывает завершение спринтов и переключение фаз.
        Возвращает True, если произошла смена фазы (work <-> break).
        """
        if pomo.state not in ("work", "break"):
            return False

        total_sec = (pomo.break_duration_min if pomo.state == "break" else pomo.work_duration_min) * 60
        next_elapsed = pomo.elapsed_seconds + 1

        if next_elapsed >= total_sec:
            if pomo.state == "work":
                next_cycle = pomo.current_cycle + 1
                is_long = (next_cycle % pomo.cycles_before_long_break) == 0
                pomo.state = "break"
                pomo.elapsed_seconds = 0
                pomo.current_cycle = next_cycle
                if is_long:
                    pomo.break_duration_min = pomo.long_break_min
                logger.info(
                    "Pomodoro: Work sprint #%d finished! Starting break (%d min)",
                    next_cycle - 1,
                    pomo.break_duration_min,
                )
            else:
                pomo.state = "work"
                pomo.elapsed_seconds = 0
                logger.info(
                    "Pomodoro: Break finished! Starting work sprint #%d (%d min)",
                    pomo.current_cycle,
                    pomo.work_duration_min,
                )
            return True

        pomo.elapsed_seconds = next_elapsed
        return False

    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        pomo_cfg = context.config.mode.pomodoro

        if not pomo_cfg.enabled:
            logger.debug("PomodoroMode is disabled in config")
            return None

        state = pomo_cfg.state  # "idle", "work", "break", "paused"
        work_sec = max(60, pomo_cfg.work_duration_min * 60)
        break_sec = max(60, pomo_cfg.break_duration_min * 60)

        total_sec = break_sec if "break" in state else work_sec
        elapsed_sec = clamp(pomo_cfg.elapsed_seconds, 0, total_sec)
        progress = elapsed_sec / total_sec if total_sec > 0 else 0.0

        focus_rgb: RGB = (
            int(pomo_cfg.focus_color[0]),
            int(pomo_cfg.focus_color[1]),
            int(pomo_cfg.focus_color[2]),
        )
        break_rgb: RGB = (
            int(pomo_cfg.break_color[0]),
            int(pomo_cfg.break_color[1]),
            int(pomo_cfg.break_color[2]),
        )

        active_rgb = break_rgb if "break" in state else focus_rgb
        transition_time = int(context.config.logic.transition_time)
        white_channel = int(context.config.logic.white_channel)

        device_mappings = context.config.mapping.devices
        # Flatten all panel IDs in sequence / Последовательный список всех ID панелей
        all_ordered_panel_ids: list[int] = []
        for dev in device_mappings:
            for pid in dev.panel_ids:
                panel_id = int(pid)
                if panel_id > 0 and panel_id not in all_ordered_panel_ids:
                    all_ordered_panel_ids.append(panel_id)

        if not all_ordered_panel_ids:
            logger.debug("No valid panels found for PomodoroMode")
            return None

        num_panels = len(all_ordered_panel_ids)
        lit_panel_threshold = progress * num_panels

        panel_colors: list[PanelColor] = []

        for idx, pid in enumerate(all_ordered_panel_ids):
            if state == "idle":
                # Idle state: subtle warm ambient glow / Состояние ожидания: легкое теплое свечение
                panel_rgb = scale_rgb(focus_rgb, 0.15)
            elif idx < int(lit_panel_threshold):
                # Completed fraction: 100% full brightness / Завершенная часть: полная яркость
                panel_rgb = scale_rgb(active_rgb, 0.75)
            elif idx == int(lit_panel_threshold):
                # Filling fraction: partial brightness proportional to remainder
                # Заполняющаяся панель: пропорциональная яркость остатка
                remainder = lit_panel_threshold - int(lit_panel_threshold)
                weight = 0.15 + 0.60 * remainder
                panel_rgb = scale_rgb(active_rgb, weight)
            else:
                # Remaining panels: subtle dimmed background / Оставшиеся панели: фоновое затемнение
                panel_rgb = scale_rgb(active_rgb, 0.05)

            panel_colors.append(
                PanelColor(
                    panel_id=pid,
                    r=panel_rgb[0],
                    g=panel_rgb[1],
                    b=panel_rgb[2],
                    w=white_channel,
                    transition_time=transition_time,
                )
            )

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
                "state": state,
                "progress": round(progress, 3),
                "elapsed_seconds": elapsed_sec,
                "total_seconds": total_sec,
                "panel_count": len(panel_colors),
            },
        )
