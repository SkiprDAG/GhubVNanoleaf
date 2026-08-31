from __future__ import annotations

from domain.models import PanelAnimation, PanelColor


def build_static_anim_data(colors: tuple[PanelColor, ...]) -> str:
    """
    Builds animData for a single static frame per panel in Nanoleaf format:
    Строит animData для одного статического кадра каждой панели в формате Nanoleaf:
    <numPanels> <panelId> <numFrames=1> <R> <G> <B> <W> <transitionTime> ...
    """
    parts = [str(len(colors))]

    for color in colors:
        parts.extend([
            str(color.panel_id),
            "1",
            str(color.r),
            str(color.g),
            str(color.b),
            str(color.w),
            str(color.transition_time),
        ])

    return " ".join(parts)


def build_custom_anim_data(animations: tuple[PanelAnimation, ...]) -> str:
    """
    Builds animData for custom multi-frame panel animations:
    Строит animData для пользовательской многокадровой анимации:
    <numPanels> <panelId> <numFrames> <R1> <G1> <B1> <W1> <T1> <R2> ...
    """
    parts = [str(len(animations))]

    for anim in animations:
        parts.extend([
            str(anim.panel_id),
            str(len(anim.frames)),
        ])

        for r, g, b, w, transition_time in anim.frames:
            parts.extend([
                str(r),
                str(g),
                str(b),
                str(w),
                str(transition_time),
            ])

    return " ".join(parts)
