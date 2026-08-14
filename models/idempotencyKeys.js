const db = require('../config/database');

const idempotencyKeys = {
  findByEventId(eventId) {
    return db.prepare('SELECT response_status, response_payload FROM idempotency_keys WHERE event_id = ?').get(eventId);
  },

  insert({ eventId, eventType, paymentIntentId, responseStatus, responsePayload }) {
    return db.prepare(`
      INSERT INTO idempotency_keys (event_id, event_type, payment_intent_id, response_status, response_payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO NOTHING
    `).run(eventId, eventType, paymentIntentId, responseStatus, responsePayload);
  },

  countAll() {
    return db.prepare('SELECT COUNT(*) c FROM idempotency_keys').get().c;
  },

  clear() {
    return db.prepare('DELETE FROM idempotency_keys').run();
  }
};

module.exports = idempotencyKeys;