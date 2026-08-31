from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import ClassVar


class ColoredFormatter(logging.Formatter):
    """
    Console log formatter with ANSI color highlighting.
    Formatter для цветного вывода логов в терминал с поддержкой ANSI-цветов.
    """

    RESET = "\033[0m"
    DIM = "\033[2m"
    BOLD = "\033[1m"

    COLORS: ClassVar[dict[int, str]] = {
        logging.DEBUG: "\033[36m",
        logging.INFO: "\033[32m",
        logging.WARNING: "\033[33m",
        logging.ERROR: "\033[31m",
        logging.CRITICAL: "\033[41m\033[97m",
    }

    def __init__(
        self,
        fmt: str,
        datefmt: str | None = None,
        use_colors: bool = True,
    ) -> None:
        super().__init__(fmt=fmt, datefmt=datefmt)
        self.use_colors = use_colors

    def format(self, record: logging.LogRecord) -> str:
        if not self.use_colors:
            return super().format(record)

        color = self.COLORS.get(record.levelno, "")
        original_level = record.levelname
        original_name = record.name

        try:
            record.levelname = f"{self.BOLD}{color}{record.levelname:<8}{self.RESET}"
            record.name = f"{self.DIM}{record.name}{self.RESET}"
            return super().format(record)
        finally:
            record.levelname = original_level
            record.name = original_name


def _supports_color(stream: object) -> bool:
    if not hasattr(stream, "isatty") or not stream.isatty():
        return False

    if os.name != "nt":
        return True

    return any(
        variable in os.environ
        for variable in (
            "WT_SESSION",
            "ANSICON",
            "TERM",
            "COLORTERM",
        )
    )


def setup_logging(
    *,
    console_level: int = logging.INFO,
    file_level: int = logging.DEBUG,
    log_dir: str = "logs",
    log_name: str = "application.log",
) -> None:
    """
    Configures application logging with noise suppression for third-party libraries.
    Настраивает логирование приложения с подавлением спама от сторонних библиотек.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)

    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
        handler.close()

    Path(log_dir).mkdir(parents=True, exist_ok=True)

    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(console_level)
    console_handler.setFormatter(
        ColoredFormatter(
            fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
            use_colors=_supports_color(sys.stderr),
        )
    )

    file_handler = RotatingFileHandler(
        filename=Path(log_dir) / log_name,
        maxBytes=1_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(file_level)
    file_handler.setFormatter(
        logging.Formatter(
            fmt=(
                "%(asctime)s | %(levelname)-8s | %(name)s | "
                "%(funcName)s:%(lineno)d | %(message)s"
            ),
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    # Suppress verbose log noise from networking / Подавление шума в логах от сетевых и фоновых библиотек
    logging.getLogger("websockets").setLevel(logging.INFO)
    logging.getLogger("websockets.client").setLevel(logging.INFO)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
