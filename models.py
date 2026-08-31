from __future__ import annotations

from domain.models import (
    RGB,
    BatteryInfo,
    Frame,
    GroupMapping,
    PanelAnimation,
    PanelColor,
    RenderPlan,
)
from ghub.manager import GHUBMessage

# Backward-compatibility alias
CompositeRenderPlan = RenderPlan

__all__ = [
    "RGB",
    "BatteryInfo",
    "CompositeRenderPlan",
    "Frame",
    "GHUBMessage",
    "GroupMapping",
    "PanelAnimation",
    "PanelColor",
    "RenderPlan",
]
