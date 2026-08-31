from __future__ import annotations

import unittest

from agent.power_hooks import (
    CTRL_C_EVENT,
    CTRL_CLOSE_EVENT,
    CTRL_LOGOFF_EVENT,
    CTRL_SHUTDOWN_EVENT,
    EVENT_NAMES,
    WindowsPowerHook,
)


class TestPowerHooks(unittest.TestCase):
    def test_add_remove_callback(self) -> None:
        hook = WindowsPowerHook()
        events_received: list[tuple[int, str]] = []

        def callback(ctrl_type: int, name: str) -> None:
            events_received.append((ctrl_type, name))

        hook.add_callback(callback)
        # Adding same callback again should not duplicate
        hook.add_callback(callback)
        self.assertEqual(len(hook._callbacks), 1)

        # Trigger internal event handling
        res = hook._on_control_event(CTRL_SHUTDOWN_EVENT)
        self.assertFalse(res)  # Should return False to allow default OS handling
        self.assertEqual(len(events_received), 1)
        self.assertEqual(events_received[0], (CTRL_SHUTDOWN_EVENT, "CTRL_SHUTDOWN"))

        # Remove callback
        hook.remove_callback(callback)
        self.assertEqual(len(hook._callbacks), 0)

        # Trigger event after removal
        hook._on_control_event(CTRL_LOGOFF_EVENT)
        self.assertEqual(len(events_received), 1)

    def test_callback_exception_does_not_crash(self) -> None:
        hook = WindowsPowerHook()

        def failing_callback(ctrl_type: int, name: str) -> None:
            raise RuntimeError("Boom!")

        hook.add_callback(failing_callback)
        # Should gracefully catch and log exception without raising
        res = hook._on_control_event(CTRL_CLOSE_EVENT)
        self.assertFalse(res)

    def test_event_names_mapping(self) -> None:
        self.assertEqual(EVENT_NAMES[CTRL_C_EVENT], "CTRL_C")
        self.assertEqual(EVENT_NAMES[CTRL_SHUTDOWN_EVENT], "CTRL_SHUTDOWN")
        self.assertEqual(EVENT_NAMES[CTRL_LOGOFF_EVENT], "CTRL_LOGOFF")
        self.assertEqual(EVENT_NAMES[CTRL_CLOSE_EVENT], "CTRL_CLOSE")

    def test_install_and_uninstall_lifecycle(self) -> None:
        hook = WindowsPowerHook()
        # Install and uninstall should complete without raising unhandled exceptions
        installed = hook.install()
        self.assertIsInstance(installed, bool)
        uninstalled = hook.uninstall()
        self.assertTrue(uninstalled)


if __name__ == "__main__":
    unittest.main()
