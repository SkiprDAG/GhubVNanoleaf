@echo off
title GhubVNanoleaf - Desktop Agent
cd /d "%~dp0"

echo ========================================================
echo Starting GhubVNanoleaf Desktop Agent...
echo ========================================================

if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe run_agent.py
) else (
    python run_agent.py
)

pause
