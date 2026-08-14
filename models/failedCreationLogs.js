const db = require('../config/database');

const failedCreationLogs = {
  findAll() {
    return db
      .prepare('SELECT id, payment_intent_id, raw_payload, error_message, status, attempts, created_at, updated_at FROM failed_creation_logs ORDER BY created_at DESC')
      .all();
  },

  findPage({ limit = 8, beforeId = null } = {}) {
    if (beforeId) {
      return db
        .prepare('SELECT id, payment_intent_id, raw_payload, error_message, status, attempts, created_at, updated_at FROM failed_creation_logs WHERE id < ? ORDER BY id DESC LIMIT ?')
        .all(beforeId, limit + 1);
    }
    return db
      .prepare('SELECT id, payment_intent_id, raw_payload, error_message, status, attempts, created_at, updated_at FROM failed_creation_logs ORDER BY id DESC LIMIT ?')
      .all(limit + 1);
  },

  findById(id) {
    return db.prepare('SELECT * FROM failed_creation_logs WHERE id = ?').get(id);
  },

  findByPaymentIntent(paymentIntentId) {
    return db.prepare('SELECT id FROM failed_creation_logs WHERE payment_intent_id = ?').get(paymentIntentId);
  },

  insert({ paymentIntentId, rawPayload, errorMessage }) {
    return db.prepare(`
      INSERT INTO failed_creation_logs (payment_intent_id, raw_payload, error_message, status, attempts)
      VALUES (?, ?, ?, 'FAILED', 1)
      ON CONFLICT(payment_intent_id) DO UPDATE SET
        attempts = attempts + 1,
        error_message = excluded.error_message,
        updated_at = CURRENT_TIMESTAMP
    `).run(paymentIntentId, rawPayload, errorMessage);
  },

  insertSeed({ paymentIntentId, rawPayload, errorMessage, status, attempts, createdAt, updatedAt }) {
    return db.prepare(`
      INSERT INTO failed_creation_logs
      (payment_intent_id, raw_payload, error_message, status, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(paymentIntentId, rawPayload, errorMessage, status, attempts, createdAt, updatedAt);
  },

  setStatus(paymentIntentId, status) {
    return db.prepare(`
      UPDATE failed_creation_logs
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE payment_intent_id = ?
    `).run(status, paymentIntentId);
  },

  markReprovisioned(id) {
    return db.prepare(`
      UPDATE failed_creation_logs
      SET status = 'REPROVISIONED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
  },

  incrementAttemptsAndUpdateMessage(id, errorMessage) {
    return db.prepare(`
      UPDATE failed_creation_logs
      SET attempts = attempts + 1, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(errorMessage, id);
  },

  countByStatus(status) {
    return db.prepare('SELECT COUNT(*) c FROM failed_creation_logs WHERE status = ?').get(status).c;
  },

  countAll() {
    return db.prepare('SELECT COUNT(*) c FROM failed_creation_logs').get().c;
  },

  statusSpread() {
    return db.prepare('SELECT status, COUNT(*) c FROM failed_creation_logs GROUP BY status').all();
  },

  clear() {
    return db.prepare('DELETE FROM failed_creation_logs').run();
  }
};

module.exports = failedCreationLogs;