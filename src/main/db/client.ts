import { join } from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type AppDb = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: AppDb | null = null

export function dbPath(): string {
  return join(app.getPath('userData'), 'inventory.db')
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
