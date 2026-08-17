const db = require('../config/database');
const { MAX_LENGTHS, escapeLike } = require('../utils/validation');

const users = {
  findAll() {
    return db
      .prepare('SELECT id, email, name, payment_intent_id, created_at FROM users ORDER BY created_at DESC')
      .all();
  },

  findPage({ limit = 8, beforeId = null, q = null } = {}) {
    const columns = 'id, email, name, payment_intent_id, created_at';
    const cleanQ = q ? escapeLike(q.trim()).slice(0, MAX_LENGTHS.SEARCH) : null;
    const where = cleanQ ? " WHERE (email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')" : '';
    const search = cleanQ ? [`%${cleanQ}%`, `%${cleanQ}%`] : [];
    if (beforeId) {
      return db
        .prepare(`SELECT ${columns} FROM users${where}${where ? ' AND' : ' WHERE'} id < ? ORDER BY id DESC LIMIT ?`)
        .all(...search, beforeId, limit + 1);
    }
    return db
      .prepare(`SELECT ${columns} FROM users${where} ORDER BY id DESC LIMIT ?`)
      .all(...search, limit + 1);
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findPaymentIntent(paymentIntentId) {
    return db.prepare('SELECT id FROM users WHERE payment_intent_id = ?').get(paymentIntentId);
  },

  insert({ email, name, passwordHash, paymentIntentId }) {
    return db.prepare(`
      INSERT INTO users (email, name, password_hash, payment_intent_id)
      VALUES (?, ?, ?, ?)
    `).run(email, name, passwordHash, paymentIntentId);
  },

  insertSeed({ email, name, passwordHash, paymentIntentId, createdAt }) {
    return db.prepare(`
      INSERT INTO users (email, name, password_hash, payment_intent_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, name, passwordHash, paymentIntentId, createdAt);
  },

  countAll() {
    return db.prepare('SELECT COUNT(*) c FROM users').get().c;
  },

  clear() {
    return db.prepare('DELETE FROM users').run();
  }
};

module.exports = users;