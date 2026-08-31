# 💡 GhubVNanoleaf — Intelligent Bridge for Logitech G HUB & Nanoleaf

<div align="center">

<p align="center">
  <b>English</b> •
  <a href="README.ru.md"><b>Русский</b></a>
</p>

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.14-green.svg)
![React](https://img.shields.io/badge/react-18-cyan.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)
![Pydantic](https://img.shields.io/badge/pydantic-v2.8-red.svg)
![Tests](https://img.shields.io/badge/tests-85%20passed-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)

**Autonomous battery visualization system for Logitech G HUB peripherals and smart lighting controller for Nanoleaf panels (Canvas, Shapes, Lines, Light Panels).**

[Features](#-key-features) • [Quick Start](#-quick-start) • [Lighting Modes](#-9-lighting-modes) • [Architecture](#-architecture--dual-mode) • [Configuration](#-environment-variables-env) • [Testing](#-testing--development)

</div>

---

## 🌟 Key Features

1. **🔋 Smart Logitech Battery Indication (Battery Mode):**
   - Precise dynamic battery level visualization for any wireless Logitech devices supported in Logitech G HUB (mice, keyboards, headsets, gamepads, etc.).
   - Intelligent panel sectioning: if a group is assigned 3 panels, a 50% charge smoothly fills 1.5 panels.
   - Charging effects: animated pulsing indicator during charging, full pulse when 100% reached.
   - **Critical Warning Alert**: pulsing red warning alert on critical battery level (< 15%). When completely discharged (0%), all assigned panels turn completely off.

2. **🌈 9 Versatile Lighting Modes:**
   - **Battery**: dynamic status visualization of G HUB peripherals.
   - **Circadian**: 24-hour biodynamic solar rhythm syncing color temperature (1800K warm night to 6500K daylight).
   - **Pomodoro**: autonomous productivity focus timer with smooth panel progress gauge.
   - **Audio Reactive**: ultra-low-latency music visualizer (Windows WASAPI Loopback 35 FPS over UDP ExtControl v2).
   - **Ambient**: organic wave color flow with smooth breathing brightness and customizable palettes.
   - **Vortex**: turbine spinning light animation with customizable trail length.
   - **Wave**: horizontal sweep and bouncing wave light effects.
   - **Solid**: uniform static solid fill with fine brightness control.
   - **Off**: smooth panel blackout.

3. **⚡ 24/7 Hybrid Architecture (Dual Mode):**
   - **Standalone Monolith Mode:** all components run in a single process on one PC.
   - **24/7 Hybrid Mode:** run the Master Server in Docker on a 24/7 host (Raspberry Pi / NAS / Home Server) + lightweight Desktop Agent in Windows Startup.
   - **Win32 Power Hooks:** when PC sleeps or shuts down, lights automatically fade out or switch to night mode.

4. **✨ Interactive Setup & Mapping Wizard:**
   - Automatic Nanoleaf panel layout geometry discovery via Wi-Fi OpenAPI.
   - Real-time interactive panel identification with single-click visual feedback.
   - Automatic circular panel walk (Cycle Auto-Walk) and conflict validation.

---

## 🚀 Quick Start

### Option 1: Running on Windows PC (Standalone Monolith)

#### 1. Clone repository and set up virtual environment:
```powershell
git clone https://github.com/SkiprDAG/GhubVNanoleaf.git
cd GhubVNanoleaf
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

> [!TIP]
> Always activate your virtual environment `.\venv\Scripts\activate` or use `.\venv\Scripts\python.exe` to avoid `ModuleNotFoundError`.

#### 2. Configure Nanoleaf connection:
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Fill in the parameters in `.env`:
```env
NANOLEAF_IP=192.168.1.100
NANOLEAF_TOKEN=your_auth_token_here
NANOLEAF_PORT=16021
HTTP_HOST=127.0.0.1
HTTP_PORT=8000
```

#### 3. Launch application:
Run via double-clicking [`start_standalone.bat`](file:///d:/project/GhubVNanoleaf/start_standalone.bat) or from PowerShell:
```powershell
.\venv\Scripts\python.exe main.py
```

#### 4. Open Web Dashboard:
Navigate in your browser to: **`http://localhost:8000`**

---

### Option 2: 24/7 Hybrid Setup (Docker Master Server + Windows Desktop Agent)

Best when you want round-the-clock lighting (Circadian / Pomodoro) running on a home server (Raspberry Pi / NAS / Linux Server), automatically streaming battery data whenever your gaming PC is powered on.

#### Step 1: Launch Master Server (on Raspberry Pi / NAS / Linux host)
```bash
# Clone repository on your server and configure .env
docker compose up -d --build
```

#### Step 2: Register Desktop Agent (on your Windows Gaming PC)
Register the agent to Windows Startup (runs silently in the background using `pythonw.exe` without a black console window):
```powershell
.\venv\Scripts\python.exe run_agent.py --server ws://<SERVER_IP>:8000/api/agent/ws --install-startup
```
*(Or double-click [`install_agent_startup.bat`](file:///d:/project/GhubVNanoleaf/install_agent_startup.bat))*

To unregister from Windows Startup:
```powershell
.\venv\Scripts\python.exe run_agent.py --uninstall-startup
```

---

## 🔑 How to Get Nanoleaf Auth Token

1. Ensure your Nanoleaf controller and PC are connected to the same local Wi-Fi network.
2. Hold the power button on the Nanoleaf controller for 5–7 seconds until the button LED begins flashing continuously.
3. Within 30 seconds, send a POST request in PowerShell:
   ```powershell
   Invoke-RestMethod -Method POST -Uri "http://<NANOLEAF_IP>:16021/api/v1/new"
   ```
4. Copy the received token `{"auth_token": "xxxxxxxxxxxxxxxxxxxxxxxx"}` into the `NANOLEAF_TOKEN` variable in your `.env` file.

---

## 🌈 9 Lighting Modes

| Mode | Description | Key Settings |
|---|---|---|
| **`battery`** | Dynamic battery level gauge for G HUB peripherals | Device group colors, critical threshold (15%), charging pulse effects |
| **`circadian`** | 24-hour natural sunlight biodynamic daylight cycle | Min/max Kelvin (1800K – 6500K), max brightness factor |
| **`pomodoro`** | Autonomous focus timer with visual panel progress gauge | Work duration (25m), break (5/15m), focus & break colors |
| **`audio`** | Real-time FFT desktop audio visualizer (Spotify, YouTube, Games) | Sensitivity, decay speed, 3-band RGB color tuning |
| **`ambient`** | Organic flowing wave gradient with brightness breathing | 2–6 color palette, transition time, group phase offset |
| **`vortex`** | Spinning turbine vortex with smooth trailing tail | Speed (ms), trail length, turbine palette |
| **`wave`** | Horizontal and bouncing light wave sweep | Step speed (ms), sweep direction, palette |
| **`solid`** | Uniform static single-color panel fill | RGB color, brightness multiplier, transition time |
| **`off`** | Smooth and complete blackout of all panels | Transition time |

---

## ⚙️ Environment Variables (.env)

| Variable | Default | Description |
|---|---|---|
| `NANOLEAF_IP` | `192.168.100.100` | Local IP address of Nanoleaf controller |
| `NANOLEAF_TOKEN` | `""` | Nanoleaf OpenAPI authorization token |
| `NANOLEAF_PORT` | `16021` | REST API port of Nanoleaf controller |
| `NANOLEAF_TIMEOUT` | `5.0` | HTTP request timeout in seconds |
| `GHUB_WS_URL` | `ws://localhost:9010` | Local WebSocket endpoint of Logitech G HUB |
| `GHUB_TIMEOUT` | `5.0` | Connection timeout for G HUB WebSocket |
| `HTTP_HOST` | `127.0.0.1` | Host for FastAPI server (`0.0.0.0` for Docker/LAN) |
| `HTTP_PORT` | `8000` | HTTP port for Web UI and REST API |
| `CONFIG_PATH` | `config/config.json` | Path to persistent configuration JSON |
| `CORS_ORIGINS` | `""` | Allowed CORS origins (`*` or comma-separated URLs) |
| `MASTER_SERVER_URL` | `ws://127.0.0.1:8000/api/agent/ws` | Master Server URL for Desktop Agent |

---

## 📁 Project Structure

```
GhubVNanoleaf/
├── agent/                      # Windows Desktop Agent
│   ├── client.py               # G HUB <-> Master Server WebSocket bridge
│   ├── power_hooks.py          # Win32 SetConsoleCtrlHandler power & shutdown hooks
│   └── startup.py              # Windows Startup registry manager (pythonw.exe)
├── config/                     # Configuration Management (Pydantic v2)
│   ├── manager.py              # Thread-safe ConfigManager with atomic disk write
│   └── models.py               # Pydantic schemas for all 9 modes and device mappings
├── control/                    # FastAPI & WebSocket Control Layer
│   ├── api.py                  # REST API routes, WebSocket endpoints and SPA static serving
│   ├── schemas.py              # Pydantic DTOs for API payloads
│   ├── service.py              # ApiService for real-time WebSocket event broadcast
│   ├── agent_service.py        # Remote agent manager & PC offline fallback handler
│   └── setup_coordinator.py    # Setup Wizard & interactive panel mapping coordinator
├── domain/                     # Pure Domain Layer (Clean Architecture)
│   ├── models.py               # Immutable BatteryInfo, PanelColor, RenderPlan
│   └── ports.py                # Abstract LightingOutputPort & BatterySourcePort protocols
├── frontend/                   # Modern Web SPA (React 18 + TypeScript + Vite + Tailwind)
│   ├── src/pages/              # Dashboard, Setup, Modes, Devices, Settings
│   └── src/components/         # Interactive Canvas Visualizer, dynamic forms
├── ghub/                       # Logitech G HUB Driver
│   ├── manager.py              # Async G HUB WebSocket client with auto-reconnect & deduplication
│   └── adapter.py              # BatterySourcePort adapter implementation
├── lighting/                   # Core Lighting & Rendering Engine
│   ├── audio_engine.py         # WASAPI Loopback + FFT spectrum analyzer (NumPy)
│   ├── fingerprint.py          # SHA256 frame hashing for duplicate frame suppression
│   ├── renderer.py             # Color interpolation, panel sectioning & pulse effects
│   ├── registry.py             # ModeRegistry (Strategy Pattern)
│   ├── service.py              # LightingService application orchestrator
│   └── modes/                  # 9 isolated lighting mode strategies
├── tests/                      # Suite of 85 unit and integration tests
├── Dockerfile                  # Multi-stage build (Node 20 -> Python 3.11-slim)
├── docker-compose.yml          # Containerized 24/7 server deployment
├── pyproject.toml              # Project packaging (PEP 518/621), Ruff/Pyright/Pytest config
├── main.py                     # Monolithic application entry point
├── run_server.py               # 24/7 Master Server entry point
└── run_agent.py                # Windows Desktop Agent entry point
```

---

## 🧪 Testing & Development

### Run Unit Tests:
```powershell
.\venv\Scripts\python.exe -m unittest discover tests
```
*All 85 tests complete in ~0.7 seconds with in-memory port mocks.*

### Code Style & Type Checking:
```powershell
.\venv\Scripts\python.exe -m ruff check .
```

### Build Frontend:
```powershell
python build_frontend.py
# or directly via npm:
npm --prefix frontend run build
```

---

## 📄 License
This project is licensed under the **MIT License**. Created for comfortable gaming, deep focus, and ambient workspace lighting.
