#!/usr/bin/env python3
"""
GhubVNanoleaf - Windows Desktop Agent Entry Point
Launches client agent on PC to stream Logitech G HUB data to Master Server.
Запускает клиентского агента на ПК для трансляции данных G HUB на Master-Сервер.
"""
import argparse
import asyncio
import logging
import os

from dotenv import load_dotenv

from agent.client import DesktopAgent
from agent.startup import install_startup, is_startup_installed, uninstall_startup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ghub-agent")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="GhubVNanoleaf Desktop Agent")
    parser.add_argument(
        "--server",
        default=os.getenv("MASTER_SERVER_URL", "ws://127.0.0.1:8000/api/agent/ws"),
        help="Master Server WebSocket URL (e.g. ws://192.168.1.100:8000/api/agent/ws)",
    )
    parser.add_argument(
        "--ghub",
        default=os.getenv("GHUB_WS_URL", "ws://127.0.0.1:9010"),
        help="Logitech G HUB WebSocket URL (default: ws://127.0.0.1:9010)",
    )
    parser.add_argument(
        "--install-startup",
        action="store_true",
        help="Register agent in Windows Startup (runs silently in background on boot)",
    )
    parser.add_argument(
        "--uninstall-startup",
        action="store_true",
        help="Remove agent from Windows Startup",
    )
    parser.add_argument(
        "--status-startup",
        action="store_true",
        help="Check if agent is registered in Windows Startup",
    )
    args = parser.parse_args()

    if args.install_startup:
        success = install_startup(server_url=args.server if args.server != "ws://127.0.0.1:8000/api/agent/ws" else None)
        if success:
            print("OK: Desktop Agent successfully registered in Windows Startup.")
        else:
            print("ERROR: Failed to register in Windows Startup.")
        return

    if args.uninstall_startup:
        success = uninstall_startup()
        if success:
            print("OK: Desktop Agent removed from Windows Startup.")
        else:
            print("ERROR: Failed to remove from Windows Startup.")
        return

    if args.status_startup:
        installed = is_startup_installed()
        print(f"Windows Startup Status: {'INSTALLED' if installed else 'NOT INSTALLED'}")
        return

    agent = DesktopAgent(server_url=args.server, ghub_url=args.ghub)
    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        logger.info("Agent stopped by user / Агент остановлен пользователем")


if __name__ == "__main__":
    main()
