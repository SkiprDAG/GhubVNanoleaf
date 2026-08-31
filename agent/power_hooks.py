from __future__ import annotations

import logging
import sys
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

# Windows Console Control Handler Event Constants / Константы событий обработчика консоли Windows
CTRL_C_EVENT = 0
CTRL_BREAK_EVENT = 1
CTRL_CLOSE_EVENT = 2
CTRL_LOGOFF_EVENT = 5
CTRL_SHUTDOWN_EVENT = 6

EVENT_NAMES = {
    CTRL_C_EVENT: "CTRL_C",
    CTRL_BREAK_EVENT: "CTRL_BREAK",
    CTRL_CLOSE_EVENT: "CTRL_CLOSE",
    CTRL_LOGOFF_EVENT: "CTRL_LOGOFF",
    CTRL_SHUTDOWN_EVENT: "CTRL_SHUTDOWN",
}

PowerCallback = Callable[[int, str], Any]


class WindowsPowerHook:
    """
    Intercepts system shutdown, restart, logoff, and console close signals
    via Win32 SetConsoleCtrlHandler. Acts as a safe no-op on non-Windows platforms.

    Перехватывает системные сигналы выключения, перезагрузки, выхода из системы
    и закрытия консоли Windows через Win32 SetConsoleCtrlHandler.
    На других ОС работает как безопасный no-op.
    """

    def __init__(self) -> None:
        self._callbacks: list[PowerCallback] = []
        self._installed = False
        self._handler_ref: Any = None

    def add_callback(self, callback: PowerCallback) -> None:
        """
        Registers a callback function for power event notifications.
        Регистрирует callback-функцию для уведомления о событиях питания.
        """
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    def remove_callback(self, callback: PowerCallback) -> None:
        """
        Removes a callback function.
        Удаляет callback-функцию.
        """
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    def _on_control_event(self, ctrl_type: int) -> bool:
        event_name = EVENT_NAMES.get(ctrl_type, f"UNKNOWN_CTRL_{ctrl_type}")
        logger.info("Windows Console Control Event received: %s (code=%d)", event_name, ctrl_type)

        for callback in list(self._callbacks):
            try:
                callback(ctrl_type, event_name)
            except Exception:
                logger.exception("Error executing power callback for event %s", event_name)

        # Return False to let Windows continue default shutdown handling
        # Возвращаем False, чтобы Windows продолжила штатную обработку завершения работы
        return False

    def install(self) -> bool:
        """
        Installs Win32 console control handler.
        Устанавливает Win32 обработчик событий консоли.
        """
        if self._installed:
            return True

        if sys.platform != "win32":
            logger.debug("WindowsPowerHook is disabled on non-Windows platform (%s)", sys.platform)
            self._installed = True
            return True

        try:
            import ctypes
            import ctypes.wintypes

            handler_type = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.DWORD)
            self._handler_ref = handler_type(self._on_control_event)

            res = ctypes.windll.kernel32.SetConsoleCtrlHandler(self._handler_ref, True)
            if res == 0:
                err = ctypes.GetLastError()
                logger.error("SetConsoleCtrlHandler failed with error code: %d", err)
                return False

            self._installed = True
            logger.info("WindowsPowerHook successfully installed.")
            return True

        except Exception as exc:
            logger.exception("Failed to install WindowsPowerHook: %s", exc)
            return False

    def uninstall(self) -> bool:
        """
        Uninstalls Win32 console control handler.
        Снимает Win32 обработчик событий консоли.
        """
        if not self._installed:
            return True

        if sys.platform != "win32":
            self._installed = False
            return True

        try:
            if self._handler_ref is not None:
                import ctypes

                ctypes.windll.kernel32.SetConsoleCtrlHandler(self._handler_ref, False)
                self._handler_ref = None

            self._installed = False
            logger.info("WindowsPowerHook uninstalled.")
            return True

        except Exception as exc:
            logger.exception("Failed to uninstall WindowsPowerHook: %s", exc)
            return False
