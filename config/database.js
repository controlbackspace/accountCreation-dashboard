const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = process.env.DB_PATH || path.join(__dirname, '../app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, '../schema.sql');

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
} else {
  console.error('[DATABASE WARNING]: schema.sql not found at path:', schemaPath);
}

module.exports = db;
