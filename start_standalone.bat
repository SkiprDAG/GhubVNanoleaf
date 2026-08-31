@echo off
title GhubVNanoleaf - Standalone All-In-One Mode
cd /d "%~dp0"

echo ========================================================
echo Starting GhubVNanoleaf (Standalone Monolith Mode)...
echo ========================================================

if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe main.py
) else (
    python main.py
)

pause
