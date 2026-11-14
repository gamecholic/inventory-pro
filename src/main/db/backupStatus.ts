import { readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { toISO } from '../../shared/dates'
import type { BackupProvider, BackupStatus, BackupSyncState, QuickBackupResult } from '../../shared/backup'
import { backupDir, pruneSameDayScheduledFiles, scheduledBackupPath } from './backup'
import { updateSettings } from './settingsStore'

/** Every file the app itself writes into the backup folder (scheduled and manual exports share this shape). */
const BACKUP_FILE = /^inventory-[\w.-]*\.xlsx$/i

/**
 * A file untouched for this long has had time to reach the cloud, so its
 * Explorer badge is the settled one. Anything younger may still be uploading.
 */
const REFERENCE_MIN_AGE_MS = 10 * 60 * 1000

const POWERSHELL_TIMEOUT_MS = 8_000

interface BackupFile {
  name: string
  path: string
  mtimeMs: number
  sizeBytes: number
}

/**
 * Name the cloud client that owns a folder. Google Drive mirror folders live
 * under `...\Google Drive`, its stream drive is `X:\My Drive` (or
 * `X:\Shared drives`). OneDrive comes from the environment its client sets.
 */
export function detectProvider(dir: string, env: NodeJS.ProcessEnv = process.env): BackupProvider {
  const path = `\\${dir.replace(/\//g, '\\').toLowerCase().replace(/^\\+|\\+$/g, '')}\\`
  if (path.includes('\\my drive\\') || path.includes('\\google drive\\') || path.includes('\\shared drives\\')) {
    return 'google-drive'
  }
  for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial'] as const) {
    const root = (env[key] ?? '').trim()
    if (root === '') continue
    const prefix = `\\${root.replace(/\//g, '\\').toLowerCase().replace(/^\\+|\\+$/g, '')}\\`
    if (path.startsWith(prefix)) return 'onedrive'
  }
  return 'local'
}

/**
 * Explorer decides a file's badge per file; the badge index alone carries no
 * meaning we can name. Compare against a settled file instead: equal badges
 * mean the same state, and a non-zero reference proves a handler answered.
 * A negative index means the probe could not read that path, which is not a
 * sync state either.
 */
export function classifySync(
  fileIndex: number,
  referenceIndex: number
): Extract<BackupSyncState, 'synced' | 'pending' | 'unknown'> {
  if (referenceIndex <= 0 || fileIndex < 0) return 'unknown'
  return fileIndex === referenceIndex ? 'synced' : 'pending'
}

export function listBackupFiles(dir: string): BackupFile[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const files: BackupFile[] = []
  for (const name of names) {
    if (!BACKUP_FILE.test(name)) continue
    try {
      const path = join(dir, name)
      const stat = statSync(path)
      if (stat.isFile()) files.push({ name, path, mtimeMs: stat.mtimeMs, sizeBytes: stat.size })
    } catch {
      // removed between readdir and stat
    }
  }
  return files
}

export function pickNewestBackup(files: BackupFile[]): BackupFile | null {
  let newest: BackupFile | null = null
  for (const file of files) {
    if (newest === null || file.mtimeMs > newest.mtimeMs) newest = file
  }
  return newest
}

/** Oldest file that has had time to settle. Its badge is the "synced" sample. */
export function pickReferenceFile(files: BackupFile[], newestPath: string, nowMs: number): BackupFile | null {
  const cutoff = nowMs - REFERENCE_MIN_AGE_MS
  let oldest: BackupFile | null = null
  for (const file of files) {
    if (file.path === newestPath || file.mtimeMs > cutoff) continue
    if (oldest === null || file.mtimeMs < oldest.mtimeMs) oldest = file
  }
  return oldest
}

/**
 * Overlay index Explorer would draw on each path, via shell32's SHGetFileInfo.
 * Index 0 means no badge (no cloud client, or a plain local file). Windows
 * only; null when the probe itself fails so the caller can say "unknown".
 */
export async function readOverlayIndices(paths: string[]): Promise<number[] | null> {
  if (process.platform !== 'win32' || paths.length === 0) return null
  const executable = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  const list = paths.map((path) => `'${path.replace(/'/g, "''")}'`).join(',')
  const script = `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class OverlayProbe {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct SHFILEINFO {
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName;
  }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);

  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);

  const uint SHGFI_ICON = 0x100;
  const uint SHGFI_SMALLICON = 0x1;
  const uint SHGFI_OVERLAYINDEX = 0x40;

  public static int Get(string path) {
    SHFILEINFO info = new SHFILEINFO();
    IntPtr result = SHGetFileInfo(path, 0, ref info, (uint)Marshal.SizeOf(info), SHGFI_ICON | SHGFI_SMALLICON | SHGFI_OVERLAYINDEX);
    if (info.hIcon != IntPtr.Zero) DestroyIcon(info.hIcon);
    if (result == IntPtr.Zero) return -1;
    return (info.iIcon >> 24) & 0xFF;
  }
}
'@
$result = @()
foreach ($p in @(${list})) {
  if (Test-Path -LiteralPath $p -PathType Leaf) { $result += [OverlayProbe]::Get($p) } else { $result += -1 }
}
Write-Output ('{"i":[' + ($result -join ',') + ']}')`
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  try {
    const child = Bun.spawn([executable, '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      stdout: 'pipe',
      stderr: 'ignore',
      windowsHide: true
    })
    const timeout = setTimeout(() => child.kill(), POWERSHELL_TIMEOUT_MS)
    const stdout = await new Response(child.stdout).text()
    const status = await child.exited
    clearTimeout(timeout)
    if (status !== 0 || stdout.trim() === '') return null
    const parsed = JSON.parse(stdout.trim()) as { i?: unknown }
    if (!Array.isArray(parsed.i)) return null
    return parsed.i.map((value) => (typeof value === 'number' ? value : -1))
  } catch {
    return null
  }
}

/**
 * Write the Excel snapshot without a dialog, into the same file the hourly
 * backup would write at this minute (inventory-YYYY-MM-DD-HHMM.xlsx), with the
 * same one-file-per-day retention (§1.8). Clicking twice in the same minute
 * rewrites that file; a later minute replaces the day's earlier file.
 */
export async function writeQuickBackup(now: Date = new Date()): Promise<QuickBackupResult> {
  const filePath = scheduledBackupPath(now)
  // The hourly run may write the same minute; never share a temp file with it.
  const tmpPath = `${filePath}.${process.pid}-${now.getTime()}.tmp`
  try {
    const { writeExcelBackup } = await import('./excel')
    await writeExcelBackup(tmpPath)
    renameSync(tmpPath, filePath)
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true })
    } catch {
      // best effort cleanup
    }
    throw error
  }
  pruneSameDayScheduledFiles(now, filePath)
  // Settings > Database shows "Last backup", so a quick backup is a backup too.
  try {
    updateSettings('general', { scheduledBackupLastAt: toISO(now) })
  } catch (error) {
    console.error(`[quick-backup] could not record last-backup time: ${error instanceof Error ? error.message : String(error)}`)
  }
  const stat = statSync(filePath)
  return {
    fileName: basename(filePath),
    filePath,
    sizeBytes: stat.size,
    writtenAt: toISO(new Date(stat.mtimeMs))
  }
}

/** Newest backup file in the folder plus what Explorer says about its cloud state. */
export async function getBackupStatus(now: Date = new Date()): Promise<BackupStatus> {
  const folder = backupDir()
  const provider = detectProvider(folder)
  const files = listBackupFiles(folder)
  const newest = pickNewestBackup(files)
  const base = {
    folder,
    provider,
    fileName: newest?.name ?? null,
    filePath: newest?.path ?? null,
    sizeBytes: newest?.sizeBytes ?? null,
    writtenAt: newest ? toISO(new Date(newest.mtimeMs)) : null,
    checkedAt: toISO(now)
  }
  if (newest === null) {
    return { ...base, sync: provider === 'local' ? 'local' : 'unknown', reason: 'no-file' }
  }
  if (provider === 'local') {
    return { ...base, sync: 'local', reason: 'no-cloud' }
  }
  const reference = pickReferenceFile(files, newest.path, now.getTime())
  if (reference === null) {
    return { ...base, sync: 'unknown', reason: 'no-reference' }
  }
  const indices = await readOverlayIndices([newest.path, reference.path])
  const fileIndex = indices?.[0]
  const referenceIndex = indices?.[1]
  if (typeof fileIndex !== 'number' || typeof referenceIndex !== 'number' || referenceIndex <= 0) {
    return { ...base, sync: 'unknown', reason: 'no-overlay' }
  }
  return { ...base, sync: classifySync(fileIndex, referenceIndex), reason: null }
}
