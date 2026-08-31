from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

RGB = tuple[int, int, int]
Frame = tuple[int, int, int, int, int]  # r, g, b, w, transition_time


@dataclass(frozen=True, slots=True)
class BatteryInfo:
    """
    Normalized device battery state.
    Нормализованное состояние батареи устройства.

    This class is decoupled from specific external APIs (e.g. G HUB payload).
    Этот класс не зависит от конкретного внешнего API (например, G HUB payload).
    """

    device_id: str
    name: str
    percentage: int
    charging: bool
    critical: bool
    fully_charged: bool
    mileage: float = 0.0

    @classmethod
    def from_ghub(
        cls,
        *,
        device_id: str,
        name: str,
        payload: dict[str, Any],
    ) -> BatteryInfo:
        """
        Converts G HUB battery payload into internal domain model.
        Преобразует payload батареи G HUB во внутреннюю доменную модель.
        """
        percentage = payload.get("percentage", 0)
        try:
            pct_int = round(float(percentage))
        except (TypeError, ValueError):
            pct_int = 0
        pct_clamped = max(0, min(100, pct_int))

        return cls(
            device_id=device_id,
            name=name,
            percentage=pct_clamped,
            charging=bool(payload.get("charging", False)),
            critical=bool(payload.get("criticalLevel", False)),
            fully_charged=bool(payload.get("fullyCharged", False)),
            mileage=float(payload.get("mileage", 0.0)),
        )


@dataclass(frozen=True, slots=True)
class PanelColor:
    """
    Single static RGBW color for a Nanoleaf panel.
    Один статический RGBW-цвет для панели Nanoleaf.
    """

    panel_id: int
    r: int
    g: int
    b: int
    w: int = 0
    transition_time: int = 0


@dataclass(frozen=True, slots=True)
class PanelAnimation:
    """
    Sequence of animation frames for a dynamic panel.
    Последовательность кадров для динамической панели.
    """

    panel_id: int
    frames: tuple[Frame, ...]


@dataclass(frozen=True, slots=True)
class RenderPlan:
    """
    Abstract lighting render plan for panels.
    Абстрактный план отображения для панелей.

    Decoupled from specific Nanoleaf OpenAPI animData binary format.
    Полностью изолирован от формата Nanoleaf OpenAPI animData.
    """

    anim_type: Literal["static", "custom"]
    panel_colors: tuple[PanelColor, ...]
    panel_animations: tuple[PanelAnimation, ...]
    fingerprint: str
    metadata: dict[str, Any]


@dataclass(frozen=True, slots=True)
class GroupMapping:
    """
    Binds a single device to a group of physical panels.
    Связывает одно устройство с группой панелей.
    """

    battery: BatteryInfo
    panel_ids: tuple[int, ...]
    label: str
    base_color: RGB
