@echo off
title AgriNexa Full Stack Launcher
echo ===================================================
echo   Launching AgriNexa Backend + Frontend
echo ===================================================
cd /d "%~dp0"
start "AgriNexa FastAPI Backend" cmd /k ".\backend\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
start "AgriNexa Vite Frontend" cmd /k "cd frontend && npm run dev"
echo Both servers started!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://127.0.0.1:8000/docs

