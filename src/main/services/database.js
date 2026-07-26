const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let SqlInitialized = false;
let SqlJsModule = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'sideloadx.db');
}

/**
 * Wraps sql.js with a better-sqlite3-compatible API
 * so the rest of the codebase doesn't need rewriting.
 */
class SqliteWrapper {
  constructor(sqlDb, saveFn) {
    this._db = sqlDb;
    this._save = saveFn;
  }

  pragma(str) {
    this._db.run(`PRAGMA ${str}`);
  }

  exec(sql) {
    const results = this._db.exec(sql);
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE') ||
        upper.startsWith('CREATE') || upper.startsWith('DROP') || upper.startsWith('ALTER')) {
      this._save();
    }
    return results;
  }

  prepare(sql) {
    const self = this;
    const upperTrimmed = sql.trim().toUpperCase();
    const isInsert = upperTrimmed.startsWith('INSERT');

    return {
      get(params) {
        const stmt = self._db.prepare(sql);
        try {
          if (params !== undefined) {
            const arr = Array.isArray(params) ? params : Object.values(params);
            stmt.bind(arr);
          }
          if (stmt.step()) return stmt.getAsObject();
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(params) {
        const stmt = self._db.prepare(sql);
        try {
          if (params !== undefined) {
            const arr = Array.isArray(params) ? params : Object.values(params);
            stmt.bind(arr);
          }
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally {
          stmt.free();
        }
      },
      run(params) {
        try {
          if (params !== undefined) {
            const arr = Array.isArray(params) ? params : Object.values(params);
            self._db.run(sql, arr);
          } else {
            self._db.run(sql);
          }
        } catch (err) {
          throw err;
        }
        self._save();
        const result = {
          lastInsertRowid: null,
          changes: self._db.getRowsModified(),
        };
        if (isInsert) {
          try {
            const rows = self._db.exec('SELECT last_insert_rowid()');
            if (rows.length > 0 && rows[0].values.length > 0) {
              result.lastInsertRowid = rows[0].values[0][0];
            }
          } catch (_) {}
        }
        return result;
      },
    };
  }
}

async function ensureInit() {
  if (!SqlInitialized) {
    SqlJsModule = await initSqlJs();
    SqlInitialized = true;
  }
}

async function initDatabase() {
  await ensureInit();

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SqlJsModule.Database(buffer);
  } else {
    sqlDb = new SqlJsModule.Database();
  }

  function save() {
    const data = sqlDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  db = new SqliteWrapper(sqlDb, save);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apple_id TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      account_type TEXT NOT NULL DEFAULT 'free',
      team_id TEXT,
      display_name TEXT,
      max_apps INTEGER DEFAULT 3,
      max_devices INTEGER DEFAULT 10,
      current_apps INTEGER DEFAULT 0,
      current_devices INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      last_refresh TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      bundle_id TEXT,
      display_name TEXT,
      version TEXT,
      min_os TEXT,
      icon_path TEXT,
      ipa_path TEXT NOT NULL,
      signed_ipa_path TEXT,
      status TEXT DEFAULT 'uploaded',
      pinned INTEGER DEFAULT 0,
      account_id INTEGER REFERENCES accounts(id),
      certificate_id INTEGER REFERENCES certificates(id),
      device_udid TEXT,
      installed_at TEXT,
      expires_at TEXT,
      last_refreshed TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'free',
      team_id TEXT,
      common_name TEXT,
      p12_path TEXT,
      p12_password TEXT,
      apple_id TEXT,
      provisioning_profile TEXT,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      udid TEXT UNIQUE NOT NULL,
      model TEXT,
      product_type TEXT,
      os_version TEXT,
      connection_type TEXT,
      last_seen TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT REFERENCES apps(id),
      certificate_id INTEGER REFERENCES certificates(id),
      device_udid TEXT,
      status TEXT,
      error_message TEXT,
      signed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 1,
      last_fetched TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  return db;
}

function getDb() {
  return db;
}

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get([key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run([key, String(value)]);
}

module.exports = { initDatabase, getDb, getSetting, setSetting };
