const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const databasePath = path.join(dataDir, 'index-valuations.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS indices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      nse_index_name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS index_valuations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      index_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      price REAL,
      pe REAL,
      pb REAL,
      div_yield REAL,
      change_amount REAL,
      change_percent REAL,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (index_id) REFERENCES indices(id),
      UNIQUE(index_id, date)
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_index_valuations_index_date ON index_valuations(index_id, date DESC)`);
}

module.exports = {
  databasePath,
  run,
  get,
  all,
  initDatabase
};
