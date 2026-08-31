@echo off
title GhubVNanoleaf - Master Server 24/7
cd /d "%~dp0\.."

echo ========================================================
echo Starting GhubVNanoleaf Master Server 24/7...
echo ========================================================

if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe run_server.py
) else (
    python run_server.py
)

pause
