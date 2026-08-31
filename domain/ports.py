from __future__ import annotations

from typing import Any, Protocol

from .models import BatteryInfo, RenderPlan


class LightingOutputPort(Protocol):
    """
    Lighting output port for physical panels (Nanoleaf, etc.).
    Порт вывода световых эффектов на физические панели (Nanoleaf и др.).
    """

    def apply_render_plan(self, plan: RenderPlan) -> None:
        """
        Applies generated RenderPlan to panels.
        Применяет сформированный RenderPlan к панелям.
        """
        ...

    def get_panel_ids(self) -> list[int]:
        """
        Returns list of discovered physical panel IDs.
        Возвращает список обнаруженных ID панелей.
        """
        ...

    def get_layout_geometry(self) -> list[dict[str, Any]]:
        """
        Returns physical coordinates, orientation, and shape of panels.
        Возвращает физические координаты и форму панелей.
        """
        ...


class BatterySourcePort(Protocol):
    """
    Battery data source port (Logitech G HUB, etc.).
    Порт источника данных о батареях (G HUB и др.).
    """

    def get_batteries(self) -> list[BatteryInfo]:
        """
        Returns current snapshot of all known battery states.
        Возвращает актуальный снимок состояния всех известных батарей.
        """
        ...

    def get_devices_snapshot(self) -> dict[str, dict[str, Any]]:
        """
        Returns snapshot of all discovered hardware devices.
        Возвращает снимок всех обнаруженных устройств.
        """
        ...
