# 💡 GhubVNanoleaf — Интеллектуальный мост Logitech G HUB & Nanoleaf

<div align="center">

<p align="center">
  <a href="README.md"><b>English</b></a> •
  <b>Русский</b>
</p>

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.14-green.svg)
![React](https://img.shields.io/badge/react-18-cyan.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)
![Pydantic](https://img.shields.io/badge/pydantic-v2.8-red.svg)
![Tests](https://img.shields.io/badge/tests-85%20passed-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)

**Автономная система визуализации заряда периферии Logitech G HUB и умного освещения на настенных панелях Nanoleaf (Canvas, Shapes, Lines, Light Panels).**

[Возможности](#-ключевые-возможности) • [Быстрый старт](#-быстрый-старт) • [Режимы подсветки](#-9-режимов-подсветки) • [Архитектура](#-архитектура-и-режимы-работы) • [Конфигурация](#-переменные-окружения-env) • [Тестирование](#-тестирование-и-разработка)

</div>

---

## 🌟 Ключевые возможности

1. **🔋 Умная индикация батарей Logitech (Battery Mode):**
   - Точное динамическое отображение уровня заряда поддерживаемых Logitech G HUB беспроводных устройств.
   - Интеллектуальное секционирование панелей: если группе назначено 3 панели, 50% заряда плавно заполняет 1.5 панели.
   - Эффекты зарядки: пульсирующий индикатор при активном питании, полный пульс при 100%.
   - **Critical Warning Alert**: тревожное пульсирующее мигание красным цветом при критически низком заряде (< 15%). При полном разряде (0%) панели устройства полностью гаснут, сигнализируя о севшем аккумуляторе.

2. **🌈 9 Режимов освещения (Lighting Modes):**
   - **Battery**: визуализация статуса периферии G HUB.
   - **Circadian**: суточный 24-часовой биодинамический солнечный цикл (от теплого 1800K ночью до яркого 6500K днем).
   - **Pomodoro**: автономный таймер продуктивности с плавной шкалой прогресса на панелях.
   - **Audio Reactive**: скоростная светомузыка (WASAPI Loopback 35 FPS по UDP ExtControl v2).
   - **Ambient**: мягкий перелив с настраиваемыми палитрами и дыханием яркости.
   - **Vortex**: вращающаяся турбина с настраиваемым шлейфом.
   - **Wave**: горизонтальные и отражающиеся световые волны.
   - **Solid**: статичный заливающий цвет с регулятором яркости.
   - **Off**: плавное гашение панелей.

3. **⚡ Гибридная архитектура 24/7 (Dual Mode):**
   - **Монолитный режим:** все компоненты работают на одном ПК в одном процессе.
   - **Гибридный режим 24/7:** запуск Master-сервера в Docker на Raspberry Pi / NAS / Home Server + легкий агент на ПК в автозагрузке Windows.
   - **Win32 Power Hooks:** при выключении или сне ПК свет автоматически плавно гаснет или переходит в биоритмический ночник.

4. **✨ Интерактивный Setup Wizard:**
   - Автоматический опрос геометрии и формы панелей Nanoleaf по Wi-Fi OpenAPI.
   - Интерактивная подсветка выбранной панели в браузере в реальном времени (Identify Panel).
   - Авто-обход по кругу (Cycle Auto-Walk) и валидация наложений групп.

---

## 🚀 Быстрый старт

### Вариант 1: Запуск на Windows ПК (Монолитный режим)

#### 1. Клонирование и установка зависимостей:
```powershell
git clone https://github.com/your-username/GhubVNanoleaf.git
cd GhubVNanoleaf
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

> [!TIP]
> Всегда активируйте виртуальное окружение `.\venv\Scripts\activate` или используйте исполняемый файл `.\venv\Scripts\python.exe`, чтобы избежать ошибки `ModuleNotFoundError`.

#### 2. Настройка подключения к Nanoleaf:
Скопируйте файл `.env.example` в `.env`:
```powershell
copy .env.example .env
```
Заполните параметры в `.env`:
```env
NANOLEAF_IP=192.168.1.100
NANOLEAF_TOKEN=ваш_токен_авторизации
NANOLEAF_PORT=16021
HTTP_HOST=127.0.0.1
HTTP_PORT=8000
```

#### 3. Запуск приложения:
Запустите двойным кликом по [`start_standalone.bat`](file:///d:/project/GhubVNanoleaf/start_standalone.bat) или командой:
```powershell
.\venv\Scripts\python.exe main.py
```

#### 4. Открытие панели управления:
Перейдите в браузере по адресу: **`http://localhost:8000`**

---

### Вариант 2: Запуск 24/7 (Master-Сервер в Docker + Windows Desktop Agent)

Такой сценарий идеален, если вы хотите, чтобы подсветка (Circadian / Pomodoro) работала круглосуточно на домашнем сервере (Raspberry Pi / NAS / Linux Server), а при включении игрового ПК автоматически подхватывала заряд батарей Logitech.

#### Шаг 1: Запуск Master-сервера (на сервере / Raspberry Pi / NAS)
```bash
# Клонируйте репозиторий на сервер и настройте .env
docker compose up -d --build
```

#### Шаг 2: Запуск и регистрация Desktop Agent (на игровом Windows ПК)
Зарегистрируйте агент в автозагрузке Windows (запускается в фоне через `pythonw.exe` без черного окна консоли):
```powershell
.\venv\Scripts\python.exe run_agent.py --server ws://<IP_СЕРВЕРА>:8000/api/agent/ws --install-startup
```
*(Или запустите [`install_agent_startup.bat`](file:///d:/project/GhubVNanoleaf/install_agent_startup.bat))*

Для удаления из автозагрузки:
```powershell
.\venv\Scripts\python.exe run_agent.py --uninstall-startup
```

---

## 🔑 Как получить токен Nanoleaf (Auth Token)

1. Убедитесь, что панели Nanoleaf и ПК находятся в одной локальной сети Wi-Fi.
2. Зажмите кнопку питания на контроллере Nanoleaf на 5–7 секунд, пока светодиод на кнопке не начнет непрерывно мигать.
3. В течение 30 секунд выполните POST-запрос в PowerShell:
   ```powershell
   Invoke-RestMethod -Method POST -Uri "http://<IP_NANOLEAF>:16021/api/v1/new"
   ```
4. Полученный токен вида `{"auth_token": "xxxxxxxxxxxxxxxxxxxxxxxx"}` скопируйте в переменную `NANOLEAF_TOKEN` в файле `.env`.

---

## 🌈 9 Режимов подсветки

| Режим | Описание | Основные настройки |
|---|---|---|
| **`battery`** | Динамическая индикация уровня заряда устройств G HUB | Цвета групп, порог тревоги (15%), эффекты пульса при зарядке |
| **`circadian`** | 24-часовой биодинамический суточный цикл естественного солнца | Мин./макс. температура (1800K – 6500K), макс. яркость |
| **`pomodoro`** | Автономный таймер фокуса и отдыха со шкалой заполнения | Длительность спринта (25 мин), отдыха (5/15 мин), цвета фокуса |
| **`audio`** | Real-time FFT светомузыка с захватом звука ПК (Spotify, YouTube, Games) | Чувствительность, скорость затухания, RGB-цвета 3 частотных полос |
| **`ambient`** | Органический волновой градиент с плавным дыханием яркости | Палитра 2–6 цветов, скорость перехода, сдвиг фазы групп |
| **`vortex`** | Эффект турбины с плавным вращением по часовой/против стрелки | Скорость (мс), длина шлейфа, палитра турбины |
| **`wave`** | Горизонтальные световые волны (Left-to-Right, Bounce) | Скорость шага (мс), направление, палитра |
| **`solid`** | Равномерная статическая заливка выбранным цветом | RGB-цвет, коэффициент яркости, время перехода |
| **`off`** | Плавное и полное выключение панелей | Время перехода |

---

## ⚙️ Переменные окружения (.env)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `NANOLEAF_IP` | `192.168.100.100` | Локальный IP-адрес контроллера Nanoleaf |
| `NANOLEAF_TOKEN` | `""` | Токен авторизации Nanoleaf OpenAPI |
| `NANOLEAF_PORT` | `16021` | REST API порт контроллера Nanoleaf |
| `NANOLEAF_TIMEOUT` | `5.0` | Таймаут сетевых запросов к Nanoleaf (в секундах) |
| `GHUB_WS_URL` | `ws://localhost:9010` | Локальный WebSocket порт Logitech G HUB |
| `GHUB_TIMEOUT` | `5.0` | Таймаут подключения к G HUB |
| `HTTP_HOST` | `127.0.0.1` | Хост для запуска веб-сервера FastAPI (`0.0.0.0` для Docker/LAN) |
| `HTTP_PORT` | `8000` | HTTP-порт для веб-интерфейса и API |
| `CONFIG_PATH` | `config/config.json` | Путь к файлу конфигурации приложения |
| `CORS_ORIGINS` | `""` | Разрешенные CORS источники (`*` или через запятую) |
| `MASTER_SERVER_URL` | `ws://127.0.0.1:8000/api/agent/ws` | Адрес Master-сервера для Desktop Agent |

---

## 📁 Структура проекта

```
GhubVNanoleaf/
├── agent/                      # Windows Desktop Agent
│   ├── client.py               # WebSocket мост G HUB <-> Master Server
│   ├── power_hooks.py          # Системный перехват Shutdown/Sleep Windows (Win32 API)
│   └── startup.py              # Менеджер автозагрузки Windows (pythonw.exe)
├── config/                     # Управление конфигурацией (Pydantic v2)
│   ├── manager.py              # Потокобезопасный ConfigManager с атомарным save
│   └── models.py               # Схемы всех 9 режимов, логики и маппинга
├── control/                    # FastAPI & WebSocket Control Layer
│   ├── api.py                  # Маршрутизация REST API, WebSockets и SPA static
│   ├── schemas.py              # Pydantic DTO для API
│   ├── service.py              # ApiService рассылки broadcast-событий
│   ├── agent_service.py        # Управление удаленными агентами и fallback-режимами
│   └── setup_coordinator.py    # Координатор интерактивной настройки маппинга
├── domain/                     # Чистый доменный слой (Clean Architecture)
│   ├── models.py               # Immutable BatteryInfo, PanelColor, RenderPlan
│   └── ports.py                # Интерфейсы LightingOutputPort, BatterySourcePort
├── frontend/                   # Современный SPA интерфейс (React 18 + TS + Vite)
│   ├── src/pages/              # Dashboard, Setup, Modes, Devices, Settings
│   └── src/components/         # Интерактивный Canvas Visualizer, формы настроек
├── ghub/                       # Драйвер Logitech G HUB
│   ├── manager.py              # WebSocket клиент G HUB с авто-реконнектом и дедупликацией
│   └── adapter.py              # Реализация BatterySourcePort
├── lighting/                   # Движок рендеринга и анимаций
│   ├── audio_engine.py         # WASAPI Loopback + FFT спектроанализатор (NumPy)
│   ├── fingerprint.py          # SHA256 хэширование кадров для отсечения дублей
│   ├── renderer.py             # Интерполяция цвета, секционирование и эффекты пульсации
│   ├── registry.py             # ModeRegistry (паттерн Strategy)
│   ├── service.py              # Оркестратор LightingService
│   └── modes/                  # 9 изолированных стратегий режимов
├── tests/                      # Набор из 85 модульных и интеграционных тестов
├── Dockerfile                  # Multi-stage сборка (Node 20 -> Python 3.11-slim)
├── docker-compose.yml          # Развертывание 24/7 сервера
├── pyproject.toml              # Стандарт проекта (PEP 518/621), конфиг Ruff/Pyright/Pytest
├── main.py                     # Точка входа монолитного приложения
├── run_server.py               # Точка входа 24/7 сервера
└── run_agent.py                # Точка входа Windows Desktop Agent
```

---

## 🧪 Тестирование и разработка

### Запуск тестов:
```powershell
.\venv\Scripts\python.exe -m unittest discover tests
```
*Все 85 тестов выполняются за ~0.7 секунды благодаря in-memory мокам портов ввода/вывода.*

### Проверка типов и линтинг:
```powershell
.\venv\Scripts\python.exe -m ruff check .
```

### Сборка фронтенда:
```powershell
python build_frontend.py
# или напрямую через npm:
npm --prefix frontend run build
```

---

## 📄 Лицензия
Проект распространяется под лицензией **MIT**. Создано для комфортного гейминга, фокуса и идеального освещения рабочего пространства.
