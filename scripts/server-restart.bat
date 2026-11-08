@echo off
REM Inventory Pro - restart the local server.
REM Double-click this file (or call it from Settings).
REM It calls the same exe with --restart (see server/boot.ts):
REM the running instance is stopped gracefully, then a fresh one starts.
REM The new server is detached, so this window closes immediately.
setlocal

REM Find the exe: beside this file (installed), repo dist\app, or default install folder.
set APP_EXE=
if not defined APP_EXE if exist "%~dp0Inventory Pro.exe" set APP_EXE=%~dp0Inventory Pro.exe
if not defined APP_EXE if exist "%~dp0..\dist\app\Inventory Pro.exe" set APP_EXE=%~dp0..\dist\app\Inventory Pro.exe
if not defined APP_EXE if exist "%LOCALAPPDATA%\Programs\Inventory Pro\Inventory Pro.exe" set APP_EXE=%LOCALAPPDATA%\Programs\Inventory Pro\Inventory Pro.exe

if not defined APP_EXE (
  echo Could not find "Inventory Pro.exe".
  echo Expected it beside this file, in dist\app, or in:
  echo   %LOCALAPPDATA%\Programs\Inventory Pro\
  pause
  goto :eof
)

echo Restarting Inventory Pro server...
start "" "%APP_EXE%" --restart
echo Done. The server is restarting in the background.

endlocal
exit /b 0
