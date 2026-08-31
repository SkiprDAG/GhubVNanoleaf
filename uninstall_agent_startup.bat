@echo off
title GhubVNanoleaf Agent - Auto Startup Removal
cd /d "%~dp0"

echo ========================================================
echo Removing GhubVNanoleaf Desktop Agent from Windows Startup...
echo ========================================================

if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe run_agent.py --uninstall-startup
) else (
    python run_agent.py --uninstall-startup
)

echo.
pause
