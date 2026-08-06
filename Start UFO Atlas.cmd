@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-UFOAtlas.ps1"
if errorlevel 1 (
  echo.
  echo UFO Atlas could not be started. See the error above.
  pause
)
