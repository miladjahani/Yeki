const Database = require('better-sqlite3');
const path = require('path');

let db = null, dbPath = null;

function init(userDataPath) {
  dbPath = path.join(userDataPath, 'minehse.db');   // %APPDATA% در ویندوز
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');                  // سرعت و پایداری صنعتی
  db.exec('CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, detail TEXT, ts INTEGER)');
  return db;
}
function kvGet(key) {
  const row = db.prepare('SELECT value FROM kv WHERE key=?').get(key);
  return row ? JSON.parse(row.value) : null;
}
function kvSet(key, val) {
  db.prepare(`INSERT INTO kv(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(key, JSON.stringify(val), Date.now());
}
function audit(action, detail) {
  db.prepare('INSERT INTO audit(action,detail,ts) VALUES(?,?,?)').run(action, detail || '', Date.now());
}
module.exports = { init, kvGet, kvSet, audit, getDbPath: () => dbPath };