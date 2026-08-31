from __future__ import annotations

import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

REG_KEY_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "GhubVNanoleafAgent"


def get_pythonw_executable() -> str:
    """
    Returns path to pythonw.exe for silent background execution without a black console window.
    Возвращает путь к pythonw.exe для скрытого фонового запуска без черного окна консоли.
    """
    executable = Path(sys.executable)
    # If using virtualenv or installed python, look for pythonw.exe in the same directory
    pythonw = executable.parent / "pythonw.exe"
    if pythonw.exists():
        return str(pythonw.resolve())
    return str(executable.resolve())


def install_startup(server_url: str | None = None) -> bool:
    """
    Registers Desktop Agent in Windows Startup registry (HKCU\\...\\Run).
    Регистрирует Desktop Agent в автозагрузке Windows через HKCU\\...\\Run.
    """
    if sys.platform != "win32":
        logger.warning("Auto-startup registration is only supported on Windows / Автозагрузка поддерживается только на Windows.")
        return False

    import winreg

    pythonw_path = get_pythonw_executable()
    agent_script = Path(__file__).resolve().parent.parent / "run_agent.py"

    cmd_parts = [f'"{pythonw_path}"', f'"{agent_script}"']
    if server_url:
        cmd_parts.append(f'--server "{server_url}"')

    command = " ".join(cmd_parts)

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REG_KEY_PATH,
            0,
            winreg.KEY_SET_VALUE | winreg.KEY_WRITE,
        )
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, command)
        winreg.CloseKey(key)
        logger.info("Successfully registered '%s' in Windows Startup!", APP_NAME)
        logger.info("Command: %s", command)
        return True
    except Exception as e:
        logger.exception("Failed to register Windows Startup: %s", e)
        return False


def uninstall_startup() -> bool:
    """
    Removes Desktop Agent from Windows Startup.
    Удаляет Desktop Agent из автозагрузки Windows.
    """
    if sys.platform != "win32":
        return False

    import winreg

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REG_KEY_PATH,
            0,
            winreg.KEY_SET_VALUE | winreg.KEY_WRITE,
        )
        winreg.DeleteValue(key, APP_NAME)
        winreg.CloseKey(key)
        logger.info("Successfully removed '%s' from Windows Startup.", APP_NAME)
        return True
    except FileNotFoundError:
        logger.info("'%s' is not registered in Windows Startup.", APP_NAME)
        return True
    except Exception as e:
        logger.exception("Failed to remove from Windows Startup: %s", e)
        return False


def is_startup_installed() -> bool:
    """
    Checks if Desktop Agent is currently registered in Windows Startup.
    Проверяет, зарегистрирован ли агент в автозагрузке Windows.
    """
    if sys.platform != "win32":
        return False

    import winreg

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REG_KEY_PATH,
            0,
            winreg.KEY_READ,
        )
        val, _ = winreg.QueryValueEx(key, APP_NAME)
        winreg.CloseKey(key)
        return bool(val)
    except FileNotFoundError:
        return False
    except Exception:
        return False
