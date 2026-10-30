@echo off
title AgriNexa FastAPI Backend
echo ===================================================
echo   Starting AgriNexa FastAPI Backend on Port 8000
echo ===================================================
cd /d "%~dp0"
.\backend\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
pause

