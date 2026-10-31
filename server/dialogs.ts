/**
 * Native Windows file/folder dialogs for a server process.
 *
 * A browser cannot hand over an absolute path (`<input type=file>` uploads the
 * bytes, and `showDirectoryPicker` returns an opaque handle), but this server
 * runs on the same machine as the user, so it can raise a real dialog itself.
 *
 * PowerShell + WinForms is used instead of FFI: it ships with Windows 10, needs
 * no extra dependency, and the process lives for one dialog only.
 *
 * The script is passed with -EncodedCommand (base64 UTF-16LE) so no quoting or
 * escaping layer can mangle a Turkish path.
 */
import { existsSync } from 'node:fs'
import { basename, dirname } from 'node:path'

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface NativeDialogRequest {
  kind: 'open' | 'save' | 'folder'
  title: string
  /** Preselected file (save) or starting folder (open, folder). */
  path?: string
  filters?: FileFilter[]
}

function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function filterString(filters: FileFilter[] | undefined): string {
  const parts = (filters ?? []).map(
    (filter) => `${filter.name} (*.${filter.extensions.join(';*.')})|*.${filter.extensions.join(';*.')}`
  )
  parts.push('All files (*.*)|*.*')
  return parts.join('|')
}

function buildScript(request: NativeDialogRequest): string {
  const title = psLiteral(request.title)
  const filter = psLiteral(filterString(request.filters))
  const startDir = psLiteral(request.path ? dirname(request.path) : '')
  const startName = psLiteral(request.path ? basename(request.path) : '')

  const body =
    request.kind === 'folder'
      ? `
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = ${title}
$dialog.ShowNewFolderButton = $true
if (${startDir} -ne '' -and (Test-Path -LiteralPath ${startDir})) {
  $dialog.SelectedPath = ${startDir}
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $result = $dialog.SelectedPath }`
      : request.kind === 'save'
        ? `
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = ${title}
$dialog.Filter = ${filter}
$dialog.OverwritePrompt = $true
$dialog.AddExtension = $true
if (${startDir} -ne '' -and (Test-Path -LiteralPath ${startDir})) {
  $dialog.InitialDirectory = ${startDir}
  $dialog.FileName = ${startName}
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $result = $dialog.FileName }`
        : `
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = ${title}
$dialog.Filter = ${filter}
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
if (${startDir} -ne '' -and (Test-Path -LiteralPath ${startDir})) {
  $dialog.InitialDirectory = ${startDir}
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $result = $dialog.FileName }`

  return `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class DialogWindow {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool on);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      StringBuilder sb = new StringBuilder(256);
      GetWindowText(h, sb, 256);
      if (sb.ToString() == title) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static IntPtr FindForProcess(int pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      uint wpid = 0;
      GetWindowThreadProcessId(h, out wpid);
      if (wpid != (uint)pid) return true;
      StringBuilder sb = new StringBuilder(256);
      GetWindowText(h, sb, 256);
      string t = sb.ToString();
      if (t.Length == 0) return true;
      if (t.IndexOf("PowerShell", StringComparison.OrdinalIgnoreCase) >= 0) return true;
      if (t.IndexOf("Console", StringComparison.OrdinalIgnoreCase) >= 0) return true;
      found = h; return false;
    }, IntPtr.Zero);
    return found;
  }

  public static void ToFront(IntPtr h) {
    if (h == IntPtr.Zero) return;
    ShowWindow(h, 9);
    SetWindowPos(h, new IntPtr(-1), 0, 0, 0, 0, 0x0003);
    uint _fgPid; uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out _fgPid);
    uint me = GetCurrentThreadId();
    if (fg != 0 && fg != me) {
      AttachThreadInput(me, fg, true);
      SetForegroundWindow(h);
      AttachThreadInput(me, fg, false);
    } else {
      SetForegroundWindow(h);
    }
  }
}
'@

# No owner form: Windows centers the dialog on the active monitor, and the
# timer below lifts it above the browser. (An invisible 1x1 owner pushed the
# dialog into a corner.)
$script:dialogTitle = ${title}
$script:myPid = $PID
$script:lift = New-Object System.Windows.Forms.Timer
$script:lift.Interval = 50
$script:lift.Add_Tick({
  $handle = [DialogWindow]::Find($script:dialogTitle)
  if ($handle -eq [IntPtr]::Zero) { $handle = [DialogWindow]::FindForProcess($script:myPid) }
  if ($handle -ne [IntPtr]::Zero) {
    [DialogWindow]::ToFront($handle)
    $script:lift.Stop()
  }
})
$script:lift.Start()

$result = ''
${body}

$script:lift.Stop()
if ($result -ne '') { [Console]::Out.Write($result) }
`
}

/**
 * Show one dialog and resolve with the chosen path, or null when cancelled.
 * Throws when the dialog subsystem itself fails, so the UI can report it
 * instead of looking like a button that does nothing.
 */
export async function showNativeDialog(request: NativeDialogRequest): Promise<string | null> {
  if (process.platform !== 'win32') {
    throw new Error('Native dialogs are only implemented for Windows')
  }

  const script = buildScript(request)
  const encoded = Buffer.from(script, 'utf16le').toString('base64')

  const child = Bun.spawn(['powershell.exe', '-NoProfile', '-STA', '-EncodedCommand', encoded], {
    stdout: 'pipe',
    stderr: 'pipe',
    windowsHide: true
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ])

  if (exitCode !== 0) {
    const detail = stderr.trim() || `exit code ${exitCode}`
    throw new Error(`Could not open the file dialog: ${detail}`)
  }

  const chosen = stdout.trim()
  return chosen === '' ? null : chosen
}

/** True when a path exists, used to pick a sane starting folder. */
export function existingDir(path: string | undefined): string | undefined {
  return path && existsSync(path) ? path : undefined
}