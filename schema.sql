PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE CHECK(length(email) <= 254),
    name TEXT NOT NULL CHECK(length(name) <= 100),
    password_hash TEXT NOT NULL,
    payment_intent_id TEXT NOT NULL UNIQUE CHECK(length(payment_intent_id) <= 64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS failed_creation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_intent_id TEXT NOT NULL UNIQUE CHECK(length(payment_intent_id) <= 64),
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

CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('SENT', 'FAILED', 'PENDING')) DEFAULT 'PENDING',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stats_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_users INTEGER NOT NULL DEFAULT 0,
    total_failures INTEGER NOT NULL DEFAULT 0,
    reprovisioned INTEGER NOT NULL DEFAULT 0,
    refunded INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
