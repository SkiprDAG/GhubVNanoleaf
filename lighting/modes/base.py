from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from config.models import AppConfig
from domain.models import BatteryInfo, RenderPlan


@dataclass(frozen=True, slots=True)
class RenderContext:
    """
    Context for generating lighting render plans.
    Контекст для генерации плана подсветки.
    """
    batteries: tuple[BatteryInfo, ...]
    config: AppConfig


class LightingMode(ABC):
    """
    Contract for lighting mode strategy.
    Контракт для режима освещения (Strategy).
    """

    name: str

    @abstractmethod
    def build_plan(self, context: RenderContext) -> RenderPlan | None:
        """
        Builds RenderPlan based on context.
        Формирует RenderPlan на основе контекста.
        """
        raise NotImplementedError
