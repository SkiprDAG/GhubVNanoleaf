from __future__ import annotations

import asyncio
import logging
import socket

from zeroconf import ServiceInfo
from zeroconf.asyncio import AsyncZeroconf

logger = logging.getLogger(__name__)


def get_local_ip_addresses() -> list[str]:
    """
    Discovers non-loopback IPv4 addresses of the current host.
    Определяет не-loopback IPv4 адреса текущего хоста.
    """
    addresses: list[str] = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and ip != "0.0.0.0":
                addresses.append(ip)
    except Exception:
        pass

    if not addresses:
        # Fallback socket connect trick to find default outgoing route
        # Fallback-метод через временный сокет для определения исходящего интерфейса
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                ip = s.getsockname()[0]
                if ip not in addresses:
                    addresses.append(ip)
        except Exception:
            pass

    return addresses or ["127.0.0.1"]


class MdnsBroadcaster:
    """
    mDNS (Multicast DNS / Zeroconf) local domain broadcaster.
    Publishes 'http://<hostname>.local:<port>' across the local Wi-Fi/LAN network,
    allowing mobile devices, tablets, and laptops to access the dashboard without IP addresses.

    Широковещательный mDNS-сервис (Zeroconf) для локальной сети.
    Анонсирует домен 'http://<hostname>.local:<port>' в домашней Wi-Fi сети,
    позволяя подключаться со смартфонов и планшетов без ручного ввода IP-адресов.
    """

    def __init__(
        self,
        hostname: str = "nanoleaf",
        port: int = 8000,
        service_name: str = "GhubVNanoleaf Controller",
    ) -> None:
        self.hostname = hostname.rstrip(".").lower()
        self.port = port
        self.service_name = service_name
        self._zeroconf: AsyncZeroconf | None = None
        self._service_info: ServiceInfo | None = None
        self._running: bool = False
        self._lock = asyncio.Lock()

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> bool:
        """
        Starts AsyncZeroconf and announces the HTTP service on the local network.
        Запускает AsyncZeroconf и анонсирует HTTP-сервис в локальной сети.
        """
        async with self._lock:
            if self._running:
                return True

            try:
                ip_strings = get_local_ip_addresses()
                packed_ips = [socket.inet_aton(ip) for ip in ip_strings]

                service_type = "_http._tcp.local."
                full_service_name = f"{self.service_name}.{service_type}"
                server_domain = f"{self.hostname}.local."

                self._service_info = ServiceInfo(
                    type_=service_type,
                    name=full_service_name,
                    addresses=packed_ips,
                    port=self.port,
                    properties={
                        "path": "/",
                        "app": "GhubVNanoleaf",
                        "version": "1.0.0",
                    },
                    server=server_domain,
                )

                self._zeroconf = AsyncZeroconf()
                await self._zeroconf.async_register_service(self._service_info)
                self._running = True

                logger.info(
                    "mDNS Broadcaster active: http://%s:%d announced (IPs: %s)",
                    server_domain.rstrip("."),
                    self.port,
                    ", ".join(ip_strings),
                )
                return True

            except Exception:
                logger.exception("Failed to start mDNS Zeroconf broadcaster (non-fatal)")
                if self._zeroconf is not None:
                    try:
                        await self._zeroconf.async_close()
                    except Exception:
                        pass
                    self._zeroconf = None
                return False

    async def stop(self) -> None:
        """
        Gracefully unregisters mDNS service and closes Zeroconf.
        Корректно разрегистрирует mDNS-сервис и закрывает Zeroconf.
        """
        async with self._lock:
            if not self._running or self._zeroconf is None:
                return

            try:
                if self._service_info is not None:
                    await self._zeroconf.async_unregister_service(self._service_info)
                await self._zeroconf.async_close()
                logger.info("mDNS Broadcaster stopped")
            except Exception:
                logger.exception("Error while shutting down mDNS broadcaster")
            finally:
                self._zeroconf = None
                self._service_info = None
                self._running = False
