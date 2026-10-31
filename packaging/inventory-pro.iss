; Inventory Pro — per-user installer.
; No admin rights, no environment variables, no terminal:
; install -> desktop shortcut -> double-click -> app window.
;
; Build with: npm run app:installer
; AppVersion / SourceDir / OutputDir are passed by scripts/build-installer.ts.

#define AppName "Inventory Pro"
#define AppExe "Inventory Pro.exe"

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\dist\app"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist\installer"
#endif
#ifndef IconFile
  #define IconFile "..\packaging\icon.ico"
#endif

[Setup]
; Stable id: upgrades must find and replace the previous install.
AppId={{7E2C4B10-9A6D-4F3E-8B21-5C7D9E0A1F42}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppName}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Inventory-Pro-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Lets an update replace the running exe without a reboot.
CloseApplications=yes
RestartApplications=no
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExe}
SetupIconFile={#IconFile}
MinVersion=10.0

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce
Name: "startup"; Description: "Start {#AppName} when Windows starts"; GroupDescription: "Startup:"; Flags: checkedonce

[Files]
Source: "{#SourceDir}\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\web\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\drizzle\*"; DestDir: "{app}\drizzle"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
; Autostart lives in HKCU so it needs no elevation.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "InventoryPro"; ValueData: """{app}\{#AppExe}"""; Flags: uninsdeletevalue; Tasks: startup

[Run]
Filename: "{app}\{#AppExe}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; The launcher is a server: stop it before files are removed.
Filename: "{cmd}"; Parameters: "/c taskkill /IM ""{#AppExe}"" /F"; Flags: runhidden; RunOnceId: "StopInventoryPro"

[UninstallDelete]
; The shop database lives in %APPDATA%\Inventory Pro and is intentionally
; left alone: uninstalling must never delete business data.
Type: filesandordirs; Name: "{app}\web"
Type: filesandordirs; Name: "{app}\drizzle"
