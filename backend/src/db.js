const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'db.sqlite');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    // Enable WAL mode
    db.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) console.error('Error enabling WAL mode:', err);
      else console.log('SQLite WAL mode enabled.');
    });
  }
});

// Wrap callback methods with Promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize Table
const initDB = async () => {
  const schema = `
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      customer_name TEXT DEFAULT 'Anonymous',
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      pages INTEGER DEFAULT 1,
      copies INTEGER DEFAULT 1,
      color INTEGER DEFAULT 1, -- 0 for B&W, 1 for Color
      paper_size TEXT DEFAULT 'A4',
      duplex INTEGER DEFAULT 0, -- 0 for Single, 1 for Double-Sided
      status TEXT DEFAULT 'waiting', -- 'waiting', 'printing', 'done'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await dbRun(schema);
    console.log('Jobs table initialized.');

    // Safe migration: Add customer_name column to jobs table if not present
    try {
      await dbRun(`ALTER TABLE jobs ADD COLUMN customer_name TEXT DEFAULT 'Anonymous'`);
      console.log('Database migrated: customer_name column added.');
    } catch (migrateErr) {
      if (!migrateErr.message.toLowerCase().includes('duplicate')) {
        console.warn('Migration warning:', migrateErr.message);
      }
    }
  } catch (error) {
    console.error('Error initializing table:', error);
  }
};

module.exports = {
  dbRun,
  dbGet,
  dbAll,
  initDB,
  db
};
