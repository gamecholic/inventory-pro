import { basename, dirname, join, isAbsolute } from 'node:path'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'

export type AppDb = BunSQLiteDatabase<typeof schema>

let sqlite: Database | null = null
let db: AppDb | null = null

const DB_FILE_NAME = 'inventory.db'
const LOCATION_FILE = 'db-location.json'

export function dbPath(): string {
  const custom = getCustomDbDir()
  return join(custom !== '' ? custom : app.getPath('userData'), DB_FILE_NAME)
}

function isCompiledExe(): boolean {
  return basename(process.execPath).toLowerCase() !== 'bun.exe'
}

/**
 * Where the DB-location pointer lives — beside the exe only, never the
 * Electron-era %APPDATA% file:
 *   Bun compiled: <exe folder>\db-location.json (dist\app in dev builds,
 *   %LOCALAPPDATA%\Programs\Inventory Pro when installed)
 *   Bun dev (bun.exe): <repo root>\db-location.json (cwd)
 * The Electron build keeps reading its own %APPDATA%\Inventory Pro\
 * db-location.json; the two never touch each other. A shop that had a
 * custom folder in the old file needs to re-pick it once in the new
 * build (Settings > Database) — it will then live beside the exe.
 */
function locationPath(): string {
  return isCompiledExe()
    ? join(dirname(process.execPath), LOCATION_FILE)
    : join(process.cwd(), LOCATION_FILE)
}

/**
 * Custom database folder. The pointer lives in a sidecar JSON file
 * beside the exe (Bun) because the setting itself cannot live inside
 * the database. Corrupt/missing sidecar falls back to the default.
 */
export function getCustomDbDir(): string {
  try {
    const raw = readFileSync(locationPath(), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    const dir = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).dir : ''
    return typeof dir === 'string' ? dir.trim() : ''
  } catch {
    return ''
  }
}

export interface DbInfo {
  custom: string
  resolved: string
}

/** Custom dir ('' = default) plus the resolved database file actually used. */
export function getDbInfo(): DbInfo {
  const custom = getCustomDbDir()
  return { custom, resolved: join(custom !== '' ? custom : app.getPath('userData'), DB_FILE_NAME) }
}

/**
 * Point the app at another folder from the next restart. Empty resets to the
 * default. The current file is never moved or copied: an existing
 * inventory.db in the target folder is used, otherwise a fresh one migrates.
 */
export function setDbDir(dir: string): DbInfo {
  const trimmed = dir.trim()
  const sidecar = locationPath()
  if (trimmed === '') {
    if (existsSync(sidecar)) unlinkSync(sidecar)
    return getDbInfo()
  }
  if (!isAbsolute(trimmed)) throw new Error('Database folder must be an absolute path')
  if (existsSync(trimmed) && !statSync(trimmed).isDirectory()) throw new Error('Database path is not a folder')
  mkdirSync(trimmed, { recursive: true })
  mkdirSync(dirname(sidecar), { recursive: true })
  writeFileSync(sidecar, JSON.stringify({ dir: trimmed }), 'utf-8')
  return getDbInfo()
}

export function migrationsPath(): string {
  // Electron bundles to out/main, so '../../drizzle' is the packaged folder.
  // The Bun build runs from source, where the folder is <cwd>/drizzle.
  const override = process.env.INVENTORY_DRIZZLE_DIR
  if (override) return override
  const bundled = join(__dirname, '../../drizzle')
  return existsSync(bundled) ? bundled : join(process.cwd(), 'drizzle')
}

/** Open any SQLite file (or :memory:) and migrate it. Electron-free for tests. */
export function openDatabase(filePath: string): { db: AppDb; sqlite: Database } {
  const handle = new Database(filePath)
  handle.exec('PRAGMA journal_mode = WAL')
  handle.exec('PRAGMA foreign_keys = ON')
  // Tuned for low-end disks (eMMC/HDD, small RAM): NORMAL sync is safe with
  // WAL and far cheaper than FULL, 8MB page cache covers a shop's working set,
  // 64MB mmap avoids page-by-page read() churn without ballooning RAM.
  handle.exec('PRAGMA synchronous = NORMAL')
  handle.exec('PRAGMA cache_size = -8000')
  handle.exec('PRAGMA temp_store = MEMORY')
  handle.exec('PRAGMA busy_timeout = 5000')
  handle.exec('PRAGMA mmap_size = 67108864')
  handle.exec('PRAGMA journal_size_limit = 67108864')
  const database = drizzle(handle, { schema })
  migrate(database, { migrationsFolder: migrationsPath() })
  return { db: database, sqlite: handle }
}

/** Injectable handles so stores are testable against :memory: (defaults hit the shop DB). */
export interface DbHandles {
  db: AppDb
  sqlite: Database
}

export function defaultHandles(): DbHandles {
  return { db: getDb(), sqlite: getSqlite() }
}

/** Open (or reuse) the shop database and run pending Drizzle migrations. */
export function getDb(): AppDb {
  if (db && sqlite) return db
  const opened = openDatabase(dbPath())
  sqlite = opened.sqlite
  db = opened.db
  return db
}

/** Raw handle for transactional backup/restore work. */
export function getSqlite(): Database {
  getDb()
  if (!sqlite) throw new Error('Database not open')
  return sqlite
}

/** Close the shop database (WAL checkpoint) and clear the cached handles. */
export function closeDb(): void {
  try {
    sqlite?.close()
  } catch {
    // already closed / never opened
  }
  sqlite = null
  db = null
}
