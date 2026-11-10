@echo off
chcp 65001 >nul
title GAUSS Werbemittel einrichten
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js fehlt auf diesem Rechner.
  echo Bitte die LTS-Version von https://nodejs.org installieren und danach diese Datei erneut starten.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0einrichten.ps1"
echo.
pause
