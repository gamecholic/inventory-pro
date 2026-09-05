import { join } from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

let sqlite: Database.Database | null = null
let db: BetterSQLite3Database<typeof schema> | null = null

export function dbPath(): string {
  return join(app.getPath('userData'), 'inventory.db')
}

/** Open (or reuse) the SQLite file and run pending Drizzle migrations. */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (db && sqlite) return db
  sqlite = new Database(dbPath())
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') })
  return db
}

/** Raw handle for transactional backup/restore work. */
export function getSqlite(): Database.Database {
  getDb()
  if (!sqlite) throw new Error('Database not open')
  return sqlite
}
