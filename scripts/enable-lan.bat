@echo off
REM Inventory Pro - one-click firewall helper for LAN sharing (TCP 5178).
REM Double-click this file. The .ps1 will prompt for Administrator (UAC).
powershell -ExecutionPolicy Bypass -File "%~dp0enable-lan.ps1" %*
pause
