import { join, isAbsolute } from 'node:path'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type AppDb = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: AppDb | null = null

const DB_FILE_NAME = 'inventory.db'
const LOCATION_FILE = 'db-location.json'

export function dbPath(): string {
  const custom = getCustomDbDir()
  return join(custom !== '' ? custom : app.getPath('userData'), DB_FILE_NAME)
}

/**
 * Custom database folder. The pointer lives in a sidecar JSON file next to
 * userData because the setting itself cannot live inside the database.
 * Corrupt/missing sidecar falls back to the default location.
 */
export function getCustomDbDir(): string {
  try {
    const raw = readFileSync(join(app.getPath('userData'), LOCATION_FILE), 'utf-8')
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
  const sidecar = join(app.getPath('userData'), LOCATION_FILE)
  if (trimmed === '') {
    if (existsSync(sidecar)) unlinkSync(sidecar)
    return getDbInfo()
  }
  if (!isAbsolute(trimmed)) throw new Error('Database folder must be an absolute path')
  if (existsSync(trimmed) && !statSync(trimmed).isDirectory()) throw new Error('Database path is not a folder')
  mkdirSync(trimmed, { recursive: true })
  writeFileSync(sidecar, JSON.stringify({ dir: trimmed }), 'utf-8')
  return getDbInfo()
}

export function migrationsPath(): string {
  return join(__dirname, '../../drizzle')
}

/** Open any SQLite file (or :memory:) and migrate it. Electron-free for tests. */
export function openDatabase(filePath: string): { db: AppDb; sqlite: Database.Database } {
  const handle = new Database(filePath)
  handle.pragma('journal_mode = WAL')
  handle.pragma('foreign_keys = ON')
  const database = drizzle(handle, { schema })
  migrate(database, { migrationsFolder: migrationsPath() })
  return { db: database, sqlite: handle }
}

/** Injectable handles so stores are testable against :memory: (defaults hit the shop DB). */
export interface DbHandles {
  db: AppDb
  sqlite: Database.Database
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
export function getSqlite(): Database.Database {
  getDb()
  if (!sqlite) throw new Error('Database not open')
  return sqlite
}
