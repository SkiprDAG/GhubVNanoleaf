#!/usr/bin/env python3
"""
GhubVNanoleaf - Master Server 24/7 Entry Point
Runs standalone Nanoleaf control server (FastAPI, Web UI, Circadian, Pomodoro, Agent Gateway).
Запускает автономный сервер управления Nanoleaf (FastAPI, Web UI, Circadian, Pomodoro, Agent Gateway).
"""
import asyncio

from dotenv import load_dotenv

# main.py provides the complete orchestrator / main.py предоставляет полный оркестратор
from main import main

if __name__ == "__main__":
    load_dotenv()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
