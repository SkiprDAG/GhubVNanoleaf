@echo off
title GhubVNanoleaf Agent - Auto Startup Setup
cd /d "%~dp0\.."

echo ========================================================
echo Installing GhubVNanoleaf Desktop Agent in Windows Startup...
echo ========================================================

if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe run_agent.py --install-startup
) else (
    python run_agent.py --install-startup
)

echo.
pause
