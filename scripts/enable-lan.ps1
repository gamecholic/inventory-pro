<#
.SYNOPSIS
  Allow Inventory Pro LAN sharing (TCP 5178) through Windows Firewall.

.DESCRIPTION
  Inventory Pro with Settings > General > Network access (LAN) on binds to
  0.0.0.0:5178. Windows Firewall blocks inbound LAN by default, even on
  Private networks, until explicitly allowed.

  Run this ONCE on the shop PC (not the phone). It self-elevates (UAC prompt)
  and adds an inbound Allow rule for TCP 5178 on all profiles.

  Usage:
    Right-click scripts\enable-lan.bat > Run as Administrator
      -or-
    powershell -ExecutionPolicy Bypass -File scripts\enable-lan.ps1

.PARAMETER Port
  TCP port the app listens on (default 5178). Use the port shown in
  Settings > Network (LAN URL), not the Vite dev port 5173.

.PARAMETER Remove
  Delete the rule instead of adding it.

.NOTES
  The per-user installer (PrivilegesRequired=lowest) cannot add firewall
  rules without admin, which is why this is a separate one-time script.
#>
param(
  [int]$Port = 5178,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

# --- Self-elevate if not admin -------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Requesting Administrator (UAC)..."
  $args = "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port"
  if ($Remove) { $args += " -Remove" }
  Start-Process powershell -Verb RunAs -ArgumentList $args -Wait
  exit 0
}

$ruleName = "Inventory Pro ($Port)"

# --- Add / remove ---------------------------------------------------------
if ($Remove) {
  $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($rule) {
    $rule | Remove-NetFirewallRule
    Write-Host "Removed firewall rule: $ruleName"
  } else {
    Write-Host "No rule named '$ruleName' found."
  }
  exit 0
}

# Remove existing same-name rule first so re-runs are idempotent.
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule -DisplayName $ruleName `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort $Port `
  -Action Allow `
  -Profile Any `
  -Description "Inventory Pro LAN sharing (Settings > General > Network access). Allows other devices on the local network to reach http://<this-PC>:$Port." | Out-Null

Write-Host "`nOK: allowed inbound TCP $Port for '$ruleName' (Private + Public)."
Write-Host "Next:"
Write-Host "  1. Settings > General > Network access: ON > Save."
Write-Host "  2. Fully quit Inventory Pro.exe and relaunch it."
Write-Host "  3. On the phone (same Wi-Fi), open the LAN URL / QR from Settings."
Write-Host "  Verify the rule with: Get-NetFirewallRule -DisplayName `"$ruleName`""
