import unittest
from unittest.mock import AsyncMock, patch

from control.mdns_broadcaster import MdnsBroadcaster, get_local_ip_addresses


class TestMdnsBroadcaster(unittest.IsolatedAsyncioTestCase):
    def test_get_local_ip_addresses_returns_list(self):
        ips = get_local_ip_addresses()
        self.assertIsInstance(ips, list)
        self.assertTrue(len(ips) > 0)
        for ip in ips:
            self.assertIsInstance(ip, str)
            self.assertIn(".", ip)

    async def test_mdns_broadcaster_start_and_stop(self):
        broadcaster = MdnsBroadcaster(hostname="test-nanoleaf", port=8000)
        self.assertFalse(broadcaster.is_running)

        mock_zeroconf_instance = AsyncMock()
        mock_zeroconf_instance.async_register_service = AsyncMock()
        mock_zeroconf_instance.async_unregister_service = AsyncMock()
        mock_zeroconf_instance.async_close = AsyncMock()

        with patch("control.mdns_broadcaster.AsyncZeroconf", return_value=mock_zeroconf_instance):
            started = await broadcaster.start()
            self.assertTrue(started)
            self.assertTrue(broadcaster.is_running)
            mock_zeroconf_instance.async_register_service.assert_awaited_once()

            # Calling start again should be a no-op / Повторный вызов start не должен дублировать регистрацию
            started_again = await broadcaster.start()
            self.assertTrue(started_again)

            # Stop
            await broadcaster.stop()
            self.assertFalse(broadcaster.is_running)
            mock_zeroconf_instance.async_unregister_service.assert_awaited_once()
            mock_zeroconf_instance.async_close.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
