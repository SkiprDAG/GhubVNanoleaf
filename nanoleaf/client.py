import logging
import socket
import struct
from collections.abc import Iterable, Mapping
from typing import Any
from urllib.parse import quote

import requests
from requests import Response, Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from domain.models import PanelColor

from .serializer import build_static_anim_data

logger = logging.getLogger(__name__)


class NanoleafError(RuntimeError):
    """
    Base Nanoleaf client exception.
    Базовая ошибка Nanoleaf-клиента.
    """


class NanoleafRequestError(NanoleafError):
    """
    Connection or HTTP request error.
    Ошибка соединения или HTTP-запроса.
    """


class NanoleafResponseError(NanoleafError):
    """
    Invalid response from Nanoleaf OpenAPI.
    Некорректный ответ Nanoleaf.
    """


class NanoleafClient:
    """
    Synchronous HTTP & UDP streaming client for Nanoleaf OpenAPI.
    Синхронный HTTP и UDP-клиент Nanoleaf OpenAPI.
    """

    def __init__(
        self,
        ip: str,
        token: str,
        port: int = 16021,
        udp_port: int | None = None,
        request_timeout: float = 5.0,
        session: Session | None = None,
    ) -> None:
        if not ip.strip():
            raise ValueError("ip must not be empty")

        if not token.strip():
            raise ValueError("token must not be empty")

        if not 1 <= port <= 65535:
            raise ValueError("port must be between 1 and 65535")

        if request_timeout <= 0:
            raise ValueError("request_timeout must be greater than zero")

        self.ip = ip
        self.token = token
        self.port = port
        self.udp_port = udp_port
        self.request_timeout = request_timeout

        self._session = session or self._create_session()
        self._owns_session = session is None
        self._udp_socket: socket.socket | None = None

    @staticmethod
    def _create_session() -> Session:
        session = requests.Session()

        retry = Retry(
            total=2,
            connect=2,
            read=2,
            status=2,
            backoff_factor=0.25,
            status_forcelist=(502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            raise_on_status=False,
        )

        adapter = HTTPAdapter(
            max_retries=retry,
            pool_connections=1,
            pool_maxsize=4,
        )

        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
        })

        return session

    @property
    def _base_url(self) -> str:
        return f"http://{self.ip}:{self.port}/api/v1"

    @property
    def _token_path(self) -> str:
        return quote(self.token, safe="")

    @property
    def _effects_url(self) -> str:
        return f"{self._base_url}/{self._token_path}/effects"

    @property
    def _layout_url(self) -> str:
        return f"{self._base_url}/{self._token_path}/panelLayout/layout"

    def close(self) -> None:
        if self._owns_session:
            self._session.close()
        if self._udp_socket is not None:
            try:
                self._udp_socket.close()
            except Exception:
                pass
            self._udp_socket = None

    def __enter__(self) -> "NanoleafClient":
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        self.close()

    def _request(
        self,
        method: str,
        url: str,
        *,
        json_payload: Mapping[str, Any] | None = None,
    ) -> Response:
        try:
            response = self._session.request(
                method=method,
                url=url,
                json=json_payload,
                timeout=self.request_timeout,
            )
            response.raise_for_status()
            return response

        except requests.Timeout as exc:
            raise NanoleafRequestError(
                f"Nanoleaf request timed out: {method} {url}"
            ) from exc

        except requests.ConnectionError as exc:
            raise NanoleafRequestError(
                f"Cannot connect to Nanoleaf: {method} {url}"
            ) from exc

        except requests.HTTPError as exc:
            status = (
                exc.response.status_code
                if exc.response is not None
                else "unknown"
            )
            raise NanoleafRequestError(
                f"Nanoleaf returned HTTP {status}: {method} {url}"
            ) from exc

        except requests.RequestException as exc:
            raise NanoleafRequestError(
                f"Nanoleaf request failed: {method} {url}"
            ) from exc

    @staticmethod
    def _parse_json_object(response: Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError as exc:
            raise NanoleafResponseError(
                "Nanoleaf returned invalid JSON"
            ) from exc

        if not isinstance(data, dict):
            raise NanoleafResponseError(
                "Nanoleaf response must be a JSON object"
            )

        return data

    def get_panel_ids(self) -> list[int]:
        geometry = self.get_layout_geometry()
        return [g["panel_id"] for g in geometry]

    def get_layout_geometry(self) -> list[dict[str, Any]]:
        """
        Returns full panel topology and physical coordinates from Nanoleaf OpenAPI.
        Возвращает полную топологию и физические координаты панелей из Nanoleaf OpenAPI.
        """
        response = self._request("GET", self._layout_url)
        data = self._parse_json_object(response)

        position_data = data.get("positionData", [])
        if not isinstance(position_data, list):
            raise NanoleafResponseError(
                "positionData must be a list"
            )

        side_length = int(data.get("sideLength", 100))
        geometry: list[dict[str, Any]] = []

        for item in position_data:
            if not isinstance(item, dict):
                continue

            try:
                panel_id = int(item.get("panelId", 0))
            except (TypeError, ValueError):
                continue

            # Shape type 1 is usually the controller/rhythm module, panelId <= 0 is controller
            # Shape type 1 обычно контроллер/модуль ритма, panelId <= 0 контроллер
            if panel_id <= 0:
                continue

            geometry.append({
                "panel_id": panel_id,
                "x": float(item.get("x", 0.0)),
                "y": float(item.get("y", 0.0)),
                "orientation": float(item.get("o", 0.0)),
                "shape_type": int(item.get("shapeType", 0)),
                "side_length": side_length,
            })

        return geometry

    def set_static_panel_colors(
        self,
        panel_colors: Iterable[PanelColor],
    ) -> None:
        colors = tuple(panel_colors)
        if not colors:
            return

        anim_data = build_static_anim_data(colors)
        payload = {
            "write": {
                "command": "display",
                "animType": "static",
                "animData": anim_data,
                "loop": False,
                "palette": [],
            }
        }
        self._request(
            "PUT",
            self._effects_url,
            json_payload=payload,
        )

    def display_custom_effect(
        self,
        anim_data: str,
        *,
        loop: bool = True,
    ) -> None:
        if not anim_data.strip():
            raise ValueError("anim_data must not be empty")

        payload = {
            "write": {
                "command": "display",
                "animType": "custom",
                "animData": anim_data.strip(),
                "loop": bool(loop),
                "palette": [],
            }
        }

        self._request(
            "PUT",
            self._effects_url,
            json_payload=payload,
        )

    def init_ext_control(self) -> dict[str, Any]:
        """
        Initializes External Streaming mode (UDP ExtControl) on Nanoleaf controller.
        Инициализирует режим External Streaming (UDP) на контроллере Nanoleaf.
        """
        payload = {
            "write": {
                "command": "display",
                "animType": "extControl",
                "extControlVersion": "v2",
            }
        }
        try:
            response = self._request("PUT", self._effects_url, json_payload=payload)
            data = self._parse_json_object(response)
            if "streamControlPort" in data:
                self.udp_port = int(data["streamControlPort"])
            return data
        except Exception as e:
            logger.debug("Failed to init extControl v2, fallback to standard: %s", e)
            return {}

    def send_udp_frame(self, panel_colors: Iterable[PanelColor]) -> None:
        """
        Sends high-speed UDP lighting frame to panels via ExtControl protocol.
        Отправляет высокоскоростной кадр цвета на панели по протоколу UDP (ExtControl).
        """
        if self._udp_socket is None:
            self._udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            # Disable ICMP port unreachable resetting the socket on Windows (SIO_UDP_CONNRESET)
            # Отключение сброса сокета Windows при ICMP port unreachable
            if hasattr(socket, "SIO_UDP_CONNRESET"):
                try:
                    self._udp_socket.ioctl(socket.SIO_UDP_CONNRESET, False)
                except Exception:
                    pass

        colors = list(panel_colors)
        if not colors:
            return

        port = self.udp_port or 60222
        # v2 payload: [num_panels: 2 bytes Big Endian], then for each: [panel_id: 2 bytes, R: 1, G: 1, B: 1, W: 1, trans_time: 2 bytes]
        packet = bytearray()
        packet.extend(struct.pack(">H", len(colors)))
        for p in colors:
            packet.extend(
                struct.pack(
                    ">HBBBBH",
                    p.panel_id,
                    p.r,
                    p.g,
                    p.b,
                    p.w,
                    max(1, p.transition_time),
                )
            )

        try:
            self._udp_socket.sendto(bytes(packet), (self.ip, port))
        except OSError as e:
            logger.debug("UDP sendto failed: %s. Resetting socket.", e)
            try:
                self._udp_socket.close()
            except Exception:
                pass
            self._udp_socket = None
        except Exception as e:
            logger.debug("Unexpected error during UDP sendto: %s", e)
