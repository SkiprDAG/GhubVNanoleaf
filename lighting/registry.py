from __future__ import annotations

from collections.abc import Iterable

from .modes.base import LightingMode


class ModeRegistry:
    """
    Registry of available lighting mode strategies.
    Реестр доступных режимов освещения.
    """

    def __init__(self, modes: Iterable[LightingMode]) -> None:
        self._modes: dict[str, LightingMode] = {
            mode.name.lower(): mode
            for mode in modes
        }

    def register(self, mode: LightingMode) -> None:
        self._modes[mode.name.lower()] = mode

    def get(self, name: str) -> LightingMode:
        key = name.strip().lower()

        try:
            return self._modes[key]
        except KeyError as exc:
            available = ", ".join(sorted(self._modes))
            raise ValueError(
                f"Unknown lighting mode: {name!r}. Available modes: {available}"
            ) from exc

    def names(self) -> tuple[str, ...]:
        return tuple(sorted(self._modes))
