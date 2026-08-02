@echo off
title AirSketch Print Launcher

echo ===================================================
echo   AirSketch Print - Starting Servers
echo ===================================================

echo [1/2] Launching Backend Server (Port 5000)...
start "AirSketch Print Backend" cmd /k "cd backend && npm run dev"

echo [2/2] Launching Frontend Server (Port 5173)...
start "AirSketch Print Frontend" cmd /k "cd frontend && npm run dev"

echo Done! Both servers are initializing in separate windows.
echo Keep those windows open while using the app.
pause
