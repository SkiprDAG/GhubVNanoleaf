from __future__ import annotations

from collections.abc import Sequence

from config.models import DeviceMappingConfig, LogicConfig
from domain.models import (
    RGB,
    BatteryInfo,
    GroupMapping,
    PanelAnimation,
)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def clamp_channel(value: float) -> int:
    return int(clamp(round(value), 0, 255))


def lerp(first: float, second: float, factor: float) -> float:
    return first + (second - first) * factor


def lerp_rgb(first: RGB, second: RGB, factor: float) -> RGB:
    factor = clamp(factor, 0.0, 1.0)
    return (
        clamp_channel(lerp(first[0], second[0], factor)),
        clamp_channel(lerp(first[1], second[1], factor)),
        clamp_channel(lerp(first[2], second[2], factor)),
    )


def scale_rgb(rgb: RGB, factor: float) -> RGB:
    factor = clamp(factor, 0.0, 1.0)
    return (
        clamp_channel(rgb[0] * factor),
        clamp_channel(rgb[1] * factor),
        clamp_channel(rgb[2] * factor),
    )


def apply_brightness_scale(
    rgb: RGB,
    factor: float,
    *,
    enabled: bool,
    min_factor: float,
    max_factor: float,
) -> RGB:
    """
    Translates panel charge progress into effective brightness.
    Преобразует прогресс заряда панели в фактическую яркость.
    """
    factor = clamp(factor, 0.0, 1.0)

    if factor <= 0.0:
        return (0, 0, 0)

    if not enabled:
        return scale_rgb(rgb, factor)

    return scale_rgb(
        rgb,
        lerp(min_factor, max_factor, factor),
    )


def panel_brightness_factors(
    percentage: int,
    panel_count: int,
) -> list[float]:
    """
    Distributes total battery charge percentage across group panels.
    Разделяет процент заряда между панелями группы.
    """
    if panel_count <= 0:
        return []

    progress = clamp(percentage, 0, 100)
    section_size = 100.0 / panel_count

    factors: list[float] = []

    for index in range(panel_count):
        section_start = index * section_size
        section_charge = clamp(
            progress - section_start,
            0.0,
            section_size,
        )
        factor = clamp(section_charge / section_size, 0.0, 1.0)
        factors.append(round(factor, 6))

    return factors


def panel_entry_static(
    panel_id: int,
    rgb: RGB,
    white_channel: int,
    transition_time: int,
) -> PanelAnimation:
    return PanelAnimation(
        panel_id=panel_id,
        frames=(
            (
                rgb[0],
                rgb[1],
                rgb[2],
                white_channel,
                transition_time,
            ),
        ),
    )


def panel_entry_blink(
    panel_id: int,
    first_rgb: RGB,
    second_rgb: RGB,
    white_channel: int,
    transition_time: int,
) -> PanelAnimation:
    return PanelAnimation(
        panel_id=panel_id,
        frames=(
            (
                first_rgb[0],
                first_rgb[1],
                first_rgb[2],
                white_channel,
                transition_time,
            ),
            (
                second_rgb[0],
                second_rgb[1],
                second_rgb[2],
                white_channel,
                transition_time,
            ),
        ),
    )


def build_normal_entries(
    panel_ids: tuple[int, ...],
    base_color: RGB,
    percentage: int,
    logic: LogicConfig,
) -> list[PanelAnimation]:
    bs = logic.brightness_scale
    transition_time = logic.transition_time
    white_channel = logic.white_channel

    factors = panel_brightness_factors(percentage, len(panel_ids))

    return [
        panel_entry_static(
            panel_id=panel_id,
            rgb=apply_brightness_scale(
                base_color,
                factor,
                enabled=bs.enabled,
                min_factor=bs.min_factor,
                max_factor=bs.max_factor,
            ),
            white_channel=white_channel,
            transition_time=transition_time,
        )
        for panel_id, factor in zip(panel_ids, factors, strict=False)
    ]


def build_charging_partial_entries(
    panel_ids: tuple[int, ...],
    base_color: RGB,
    percentage: int,
    logic: LogicConfig,
) -> list[PanelAnimation]:
    bs = logic.brightness_scale
    white_channel = logic.white_channel
    effect = logic.effects.charging_partial

    transition_time = effect.pulse_transition_time
    min_factor = effect.min_factor
    max_factor = effect.max_factor

    factors = panel_brightness_factors(percentage, len(panel_ids))

    full_count = sum(1 for factor in factors if factor >= 1.0)
    blink_index = min(full_count, max(0, len(panel_ids) - 1))

    entries: list[PanelAnimation] = []

    for index, panel_id in enumerate(panel_ids):
        if index < full_count:
            rgb = apply_brightness_scale(
                base_color,
                1.0,
                enabled=bs.enabled,
                min_factor=bs.min_factor,
                max_factor=bs.max_factor,
            )
            entries.append(
                panel_entry_static(
                    panel_id,
                    rgb,
                    white_channel,
                    transition_time,
                )
            )
            continue

        if index == blink_index:
            dim_rgb = apply_brightness_scale(
                base_color,
                min_factor,
                enabled=bs.enabled,
                min_factor=bs.min_factor,
                max_factor=bs.max_factor,
            )
            bright_rgb = apply_brightness_scale(
                base_color,
                max_factor,
                enabled=bs.enabled,
                min_factor=bs.min_factor,
                max_factor=bs.max_factor,
            )
            entries.append(
                panel_entry_blink(
                    panel_id,
                    dim_rgb,
                    bright_rgb,
                    white_channel,
                    transition_time,
                )
            )
            continue

        entries.append(
            panel_entry_static(
                panel_id,
                (0, 0, 0),
                white_channel,
                transition_time,
            )
        )

    return entries


def build_charging_full_entries(
    panel_ids: tuple[int, ...],
    base_color: RGB,
    logic: LogicConfig,
) -> list[PanelAnimation]:
    bs = logic.brightness_scale
    white_channel = logic.white_channel
    effect = logic.effects.charging_full

    transition_time = effect.pulse_transition_time
    min_factor = effect.min_factor
    max_factor = effect.max_factor

    dim_rgb = apply_brightness_scale(
        base_color,
        min_factor,
        enabled=bs.enabled,
        min_factor=bs.min_factor,
        max_factor=bs.max_factor,
    )
    bright_rgb = apply_brightness_scale(
        base_color,
        max_factor,
        enabled=bs.enabled,
        min_factor=bs.min_factor,
        max_factor=bs.max_factor,
    )

    return [
        panel_entry_blink(
            panel_id=panel_id,
            first_rgb=dim_rgb,
            second_rgb=bright_rgb,
            white_channel=white_channel,
            transition_time=transition_time,
        )
        for panel_id in panel_ids
    ]


def build_critical_entries(
    panel_ids: tuple[int, ...],
    base_color: RGB,
    percentage: int,
    logic: LogicConfig,
) -> list[PanelAnimation]:
    white_channel = logic.white_channel
    transition_time = logic.transition_time

    # When device is completely discharged (0%), all panels are completely turned off
    # Когда устройство полностью разряжено (0%), все панели полностью гаснут
    if percentage <= 0:
        return [
            panel_entry_static(
                panel_id=panel_id,
                rgb=(0, 0, 0),
                white_channel=white_channel,
                transition_time=transition_time,
            )
            for panel_id in panel_ids
        ]

    bs = logic.brightness_scale
    effect = logic.effects.critical

    pulse_transition_time = effect.pulse_transition_time
    warning_color = (
        effect.warning_color[0],
        effect.warning_color[1],
        effect.warning_color[2],
    )

    factors = panel_brightness_factors(percentage, len(panel_ids))

    active_indices = [
        index for index, factor in enumerate(factors) if factor > 0.0
    ]
    active_index = active_indices[-1] if active_indices else 0

    entries: list[PanelAnimation] = []

    for index, panel_id in enumerate(panel_ids):
        factor = factors[index]

        if index == active_index:
            base_rgb = apply_brightness_scale(
                base_color,
                factor if factor > 0.0 else (bs.min_factor if bs.enabled else 0.1),
                enabled=bs.enabled,
                min_factor=bs.min_factor,
                max_factor=bs.max_factor,
            )
            entries.append(
                panel_entry_blink(
                    panel_id=panel_id,
                    first_rgb=base_rgb,
                    second_rgb=warning_color,
                    white_channel=white_channel,
                    transition_time=pulse_transition_time,
                )
            )
            continue

        if factor <= 0.0:
            entries.append(
                panel_entry_static(
                    panel_id,
                    (0, 0, 0),
                    white_channel,
                    transition_time,
                )
            )
            continue

        base_rgb = apply_brightness_scale(
            base_color,
            factor,
            enabled=bs.enabled,
            min_factor=bs.min_factor,
            max_factor=bs.max_factor,
        )
        entries.append(
            panel_entry_static(
                panel_id,
                base_rgb,
                white_channel,
                transition_time,
            )
        )

    return entries


def build_group_mappings(
    batteries: Sequence[BatteryInfo],
    device_configs: Sequence[DeviceMappingConfig],
) -> list[GroupMapping]:
    """
    Binds discovered devices to panel groups matching device name substring.
    Строит привязку устройств к группам панелей по совпадению подстроки имени.
    """
    result: list[GroupMapping] = []

    for dev_cfg in device_configs:
        match_text = dev_cfg.match.lower()

        battery = next(
            (b for b in batteries if match_text in b.name.lower()),
            None,
        )

        if battery is None:
            continue

        panel_ids = tuple(int(p) for p in dev_cfg.panel_ids if int(p) > 0)
        if not panel_ids:
            continue

        base_color = (
            int(dev_cfg.base_color[0]),
            int(dev_cfg.base_color[1]),
            int(dev_cfg.base_color[2]),
        )

        result.append(
            GroupMapping(
                battery=battery,
                panel_ids=panel_ids,
                label=dev_cfg.label or dev_cfg.match,
                base_color=base_color,
            )
        )

    return result
