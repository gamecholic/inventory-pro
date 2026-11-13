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
import { existsSync, statSync } from 'node:fs'
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

/**
 * Folder the dialog starts in. `path` is a folder for `folder` requests, a
 * file for save, and may be either for open — so trust the filesystem over
 * the request kind: a directory starts *in* itself, a file starts in its
 * parent. (Using dirname() everywhere opened folder pickers one level too
 * high and made "import from old app" start above the backup folder.)
 */
function startFolder(path: string | undefined): string {
  if (!path) return ''
  try {
    if (statSync(path).isDirectory()) return path
  } catch {
    // does not exist yet (new save target): fall back to its parent
  }
  return dirname(path)
}

function buildScript(request: NativeDialogRequest): string {
  const title = psLiteral(request.title)
  const filter = psLiteral(filterString(request.filters))
  const startDir = psLiteral(startFolder(request.path))
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
using System.Text;
using System.Runtime.InteropServices;

public class DialogWindow {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SetActiveWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool on);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool altTab);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

  private const uint SWP_NOSIZE = 0x0001;
  private const uint SWP_NOMOVE = 0x0002;
  private static readonly IntPtr TOPMOST = new IntPtr(-1);
  private static readonly IntPtr NOTOPMOST = new IntPtr(-2);

  private static string Text(IntPtr h) {
    StringBuilder sb = new StringBuilder(512);
    GetWindowText(h, sb, 512);
    return sb.ToString();
  }

  private static string ClassName(IntPtr h) {
    StringBuilder sb = new StringBuilder(256);
    GetClassName(h, sb, 256);
    return sb.ToString();
  }

  /** Our dialog box (#32770); its other windows (console, tooltips) are ignored. */
  private static bool IsOurs(IntPtr h, uint pid) {
    if (!IsWindowVisible(h)) return false;
    uint wpid = 0;
    GetWindowThreadProcessId(h, out wpid);
    if (wpid != pid) return false;
    string cls = ClassName(h);
    if (cls == "#32770") return true;
    string t = Text(h);
    if (t.Length == 0) return false;
    if (t.IndexOf("PowerShell", StringComparison.OrdinalIgnoreCase) >= 0) return false;
    if (t.IndexOf("Console", StringComparison.OrdinalIgnoreCase) >= 0) return false;
    return true;
  }

  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      if (Text(h) == title) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  /** The dialog box of this process, or its first other visible window. */
  public static IntPtr FindForProcess(uint pid) {
    IntPtr dialog = IntPtr.Zero;
    IntPtr other = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsOurs(h, pid)) return true;
      if (ClassName(h) == "#32770") { dialog = h; return false; }
      if (other == IntPtr.Zero) other = h;
      return true;
    }, IntPtr.Zero);
    return dialog != IntPtr.Zero ? dialog : other;
  }

  /**
   * Give the dialog the foreground. Windows only lets a background process
   * take it in some cases, so this is called repeatedly by the script timer:
   * topmost + bring-to-top, then attach to the foreground thread (the trick
   * that makes the API treat us as foreground), then SwitchToThisWindow as a
   * fallback. Returns true only when the dialog really owns the foreground.
   */
  public static bool Activate(IntPtr h) {
    if (h == IntPtr.Zero) return false;
    if (GetForegroundWindow() == h) return true;

    ShowWindow(h, 9); // SW_RESTORE
    SetWindowPos(h, TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE);
    BringWindowToTop(h);

    uint pid;
    uint me = GetCurrentThreadId();
    uint fgThread = GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    bool attached = false;
    if (fgThread != 0 && fgThread != me) attached = AttachThreadInput(me, fgThread, true);
    SetForegroundWindow(h);
    SetActiveWindow(h);
    SetFocus(h);
    if (attached) AttachThreadInput(me, fgThread, false);

    if (GetForegroundWindow() != h) SwitchToThisWindow(h, true);

    if (GetForegroundWindow() == h) {
      // Focus is ours: stop floating above every other window.
      SetWindowPos(h, NOTOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE);
      return true;
    }
    return false;
  }

  /**
   * Last resort after repeated refusals: Windows treats a process that
   * received the last input as allowed to take the foreground. A lone ALT
   * press/release is the least invasive way to count as "last input"; the
   * next Activate() call usually goes through.
   */
  public static void UnlockForeground() {
    const byte VK_MENU = 0x12;
    const uint KEYEVENTF_KEYUP = 0x0002;
    keybd_event(VK_MENU, 0, 0, IntPtr.Zero);
    keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
  }
}
'@

# No owner form: Windows centers the dialog on the active monitor, and the
# timer below lifts it above the browser. (An invisible 1x1 owner pushed the
# dialog into a corner.)
$script:dialogTitle = ${title}
$script:myPid = [uint32]$PID
$script:ticks = 0
$script:lifted = $false
$script:lift = New-Object System.Windows.Forms.Timer
$script:lift.Interval = 80
$script:lift.Add_Tick({
  if ($script:lifted) { $script:lift.Stop(); return }
  $handle = [DialogWindow]::FindForProcess($script:myPid)
  if ($handle -eq [IntPtr]::Zero) { $handle = [DialogWindow]::Find($script:dialogTitle) }
  if ($handle -ne [IntPtr]::Zero -and [DialogWindow]::Activate($handle)) {
    $script:lifted = $true
    $script:lift.Stop()
    return
  }
  # Keep trying while the dialog is being created: one refused attempt used to
  # leave it on top but unactivated until the user clicked it.
  $script:ticks++
  if ($script:ticks -eq 30) { [DialogWindow]::UnlockForeground() }
  if ($script:ticks -gt 50) { $script:lift.Stop() }
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