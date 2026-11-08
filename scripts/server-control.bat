@echo off
REM Inventory Pro - restart or stop the local server.
REM Double-click this file. A small window opens with:
REM   Restart - stops and starts the server again (app stays usable)
REM   Stop    - stops the server (app closes)
REM   Exit    - does nothing
REM It calls the same exe with --restart / --stop (see server/boot.ts).
REM The server is detached, so this window closes after the action.
setlocal

REM Find the exe: beside this file (installed), repo dist\app, or default install folder.
set APP_EXE=
if not defined APP_EXE if exist "%~dp0Inventory Pro.exe" set APP_EXE=%~dp0Inventory Pro.exe
if not defined APP_EXE if exist "%~dp0..\dist\app\Inventory Pro.exe" set APP_EXE=%~dp0..\dist\app\Inventory Pro.exe
if not defined APP_EXE if exist "%LOCALAPPDATA%\Programs\Inventory Pro\Inventory Pro.exe" set APP_EXE=%LOCALAPPDATA%\Programs\Inventory Pro\Inventory Pro.exe

if not defined APP_EXE (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Could not find Inventory Pro.exe. Expected it beside this file, in dist\app, or in LocalAppData Programs Inventory Pro.','Inventory Pro','OK','Error') | Out-Null"
  goto :eof
)

REM Friendly popup: three buttons. DialogResult Yes=Restart, No=Stop, Cancel=Exit.
REM Written to a temp file so the batch file can read the choice.
set CHOICE_FILE=%TEMP%\ip-server-choice.txt
if exist "%CHOICE_FILE%" del "%CHOICE_FILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.Form; $f.Text='Inventory Pro - Server Control'; $f.Width=400; $f.Height=200; $f.StartPosition='CenterScreen'; $f.FormBorderStyle='FixedDialog'; $f.MaximizeBox=$false; $f.MinimizeBox=$false; $l = New-Object System.Windows.Forms.Label; $l.Text='What do you want to do with Inventory Pro?'; $l.AutoSize=$true; $l.Location=New-Object System.Drawing.Point(20,20); $f.Controls.Add($l); $hint = New-Object System.Windows.Forms.Label; $hint.Text='Restart: close and start again.  Stop: close the app.'; $hint.AutoSize=$true; $hint.Location=New-Object System.Drawing.Point(20,45); $f.Controls.Add($hint); $b1 = New-Object System.Windows.Forms.Button; $b1.Text='Restart'; $b1.Width=100; $b1.Location=New-Object System.Drawing.Point(20,90); $b1.DialogResult=[System.Windows.Forms.DialogResult]::Yes; $f.Controls.Add($b1); $b2 = New-Object System.Windows.Forms.Button; $b2.Text='Stop'; $b2.Width=100; $b2.Location=New-Object System.Drawing.Point(130,90); $b2.DialogResult=[System.Windows.Forms.DialogResult]::No; $f.Controls.Add($b2); $b3 = New-Object System.Windows.Forms.Button; $b3.Text='Exit'; $b3.Width=100; $b3.Location=New-Object System.Drawing.Point(240,90); $b3.DialogResult=[System.Windows.Forms.DialogResult]::Cancel; $f.Controls.Add($b3); $r = $f.ShowDialog(); Write-Output $r" > "%CHOICE_FILE%" 2>nul

set CHOICE=
for /f "usebackq delims=" %%C in ("%CHOICE_FILE%") do set CHOICE=%%C
if defined CHOICE goto :handle

REM Fallback text menu if the popup could not open (e.g. no GUI session).
:menu
cls
echo ===========================================
echo   Inventory Pro - Server Control
echo ===========================================
echo.
echo   [R] Restart - close and start the app again
echo   [S] Stop    - close the app
echo   [X] Exit    - do nothing
echo.
echo App: %APP_EXE%
echo.
choice /C RSX /N /M "Press R, S or X: "
if errorlevel 3 goto end
if errorlevel 2 goto stop
if errorlevel 1 goto restart
goto menu

:handle
if "%CHOICE%"=="Yes" goto restart
if "%CHOICE%"=="No" goto stop
goto end

:restart
title Inventory Pro - Restarting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Restarting Inventory Pro. The app will start again in a few seconds.','Inventory Pro','OK','Information') | Out-Null"
start "" "%APP_EXE%" --restart
goto end

:stop
title Inventory Pro - Stopping...
"%APP_EXE%" --stop
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Inventory Pro has been stopped.','Inventory Pro','OK','Information') | Out-Null"
goto end

:end
if exist "%CHOICE_FILE%" del "%CHOICE_FILE%"
endlocal
exit /b 0
