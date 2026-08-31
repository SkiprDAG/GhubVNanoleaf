from __future__ import annotations

import hashlib
import json

from domain.models import PanelAnimation, PanelColor


def compute_render_fingerprint(
    anim_type: str,
    panel_colors: tuple[PanelColor, ...],
    panel_animations: tuple[PanelAnimation, ...],
    config_revision: int,
) -> str:
    """
    Computes a deterministic hash fingerprint for a lighting render plan.
    Формирует детерминированный хэш (fingerprint) визуального плана.

    The hash changes on any modification of:
    - Panel IDs;
    - RGBW colors and transition times per frame;
    - Animation type (static / custom);
    - Configuration revision.

    Хэш меняется при любом изменении:
    - ID панелей;
    - RGBW цветов и времени переходов каждого кадра;
    - типа анимации (static / custom);
    - версии конфигурации (config_revision).
    """
    payload = {
        "anim_type": anim_type,
        "revision": config_revision,
        "colors": [
            (c.panel_id, c.r, c.g, c.b, c.w, c.transition_time)
            for c in sorted(panel_colors, key=lambda x: x.panel_id)
        ],
        "animations": [
            (a.panel_id, a.frames)
            for a in sorted(panel_animations, key=lambda x: x.panel_id)
        ],
    }
    raw = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
