PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    payment_intent_id TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS failed_creation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_intent_id TEXT NOT NULL UNIQUE,
    raw_payload TEXT NOT NULL,
    error_message TEXT NOT NULL,
    status TEXT CHECK(status IN ('FAILED', 'PROCESSING', 'REPROVISIONED', 'REFUNDED')) DEFAULT 'FAILED',
    attempts INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT,
    payment_intent_id TEXT,
    response_status INTEGER NOT NULL,
    response_payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TEXT NOT NULL
);
