from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from domain.models import PanelColor, RenderPlan
from domain.ports import LightingOutputPort

from .client import NanoleafClient
from .serializer import build_custom_anim_data


class NanoleafLightingAdapter(LightingOutputPort):
    """
    Adapter implementing LightingOutputPort using NanoleafClient.
    Адаптер, реализующий LightingOutputPort через NanoleafClient.
    """

    def __init__(self, client: NanoleafClient) -> None:
        self._client = client

    def apply_render_plan(self, plan: RenderPlan) -> None:
        """
        Applies RenderPlan to physical Nanoleaf controller.
        Применяет RenderPlan к физическому контроллеру Nanoleaf.
        """
        if plan.anim_type == "static":
            self._client.set_static_panel_colors(plan.panel_colors)
        else:
            anim_data = build_custom_anim_data(plan.panel_animations)
            self._client.display_custom_effect(anim_data, loop=True)

    def set_static_panel_colors(self, panel_colors: Iterable[PanelColor]) -> None:
        self._client.set_static_panel_colors(panel_colors)

    def display_custom_effect(self, anim_data: str, loop: bool = True) -> None:
        self._client.display_custom_effect(anim_data, loop=loop)

    def get_panel_ids(self) -> list[int]:
        """
        Returns latest list of panel IDs retrieved from Nanoleaf controller.
        Возвращает актуальный список ID панелей, полученный от контроллера Nanoleaf.
        """
        return self._client.get_panel_ids()

    def get_layout_geometry(self) -> list[dict[str, Any]]:
        """
        Returns spatial coordinates and shape types of panels.
        Возвращает пространственные координаты и типы форм панелей.
        """
        return self._client.get_layout_geometry()

    def init_ext_control(self) -> dict[str, Any]:
        """
        Initializes UDP External Streaming.
        Инициализирует UDP External Streaming.
        """
        return self._client.init_ext_control()

    def send_udp_frame(self, panel_colors: Iterable[PanelColor]) -> None:
        """
        Sends high-speed frame over UDP.
        Отправляет быстрый кадр по UDP.
        """
        self._client.send_udp_frame(panel_colors)
