# GhubVNanoleaf Web Dashboard (Frontend)

Modern, lightning-fast, and responsive local web control center for the **GhubVNanoleaf** lighting bridge.

Built with:
- **React 18** + **TypeScript**
- **Vite 5**
- **Tailwind CSS** (Dark Gamer / Control Center Aesthetic)
- **TanStack Query v5** (Server state synchronization)
- **Lucide Icons**
- **WebSocket Client** with automatic reconnect, ping/pong heartbeat, and live state cache patching

---

## Getting Started

### 1. Installation

From the `frontend/` directory, install npm dependencies:

```bash
cd frontend
npm install
```

### 2. Configuration

Create a `.env` file (or copy from `.env.example`):

```bash
cp .env.example .env
```

Environment variables:
- `VITE_API_BASE_URL`: (Optional) URL of the FastAPI backend. In development, leaving it empty uses the Vite dev server proxy (`http://127.0.0.1:8000`).
- `VITE_WS_BASE_URL`: (Optional) WebSocket URL. By default, it connects to `ws://<host>/ws`.

### 3. Running Locally

Start the Vite development server:

```bash
npm run dev
```

The application will be accessible at: `http://localhost:5173`.

### 4. Building for Production

Compile TypeScript and build the static assets:

```bash
npm run build
```

The production output will be generated in `frontend/dist/`.

---

## Features

- **Live Dashboard**:
  - Live Logitech battery percentages, charging indicators, critical warnings.
  - Device group color previews and assigned Nanoleaf panel IDs.
  - Active render fingerprint and anim type (`static` / `custom`).
- **Devices & Layout**:
  - Mapping device match filters (e.g. `PRO X 2`, `G915`, `G502`) to panels.
  - Visual color picker with hex input and RGB sliders.
  - Add, edit, delete layout groups.
- **Lighting Modes**:
  - Instant mode switcher: `Battery Mode`, `Solid Ambient Mode`, `Blackout (Off)`.
  - Non-linear brightness scaling settings (min/max factors).
  - Charging effect parameters (pulse speed, min/max factors).
  - Critical battery threshold & warning color editor.
- **Configuration**:
  - Global hardware transition times and RGBW white channel saturation.
  - Raw JSON configuration preview with clipboard copy and reload.
- **WebSocket & Error Handling**:
  - Real-time updates with 0-layout shift cache patching.
  - Exponential backoff auto-reconnect.
  - Rich toast notifications with error messages from FastAPI.
