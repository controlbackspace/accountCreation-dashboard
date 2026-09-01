const db = require('../config/database');

const emailLogs = {
  findAll() {
    return db
      .prepare('SELECT id, recipient_email, subject, template_type, status, error_message, created_at FROM email_logs ORDER BY created_at DESC')
      .all();
  },

  findPage({ limit = 20, beforeId = null } = {}) {
    if (beforeId) {
      return db
        .prepare('SELECT id, recipient_email, subject, template_type, status, error_message, created_at FROM email_logs WHERE id < ? ORDER BY id DESC LIMIT ?')
        .all(beforeId, limit + 1);
    }
    return db
      .prepare('SELECT id, recipient_email, subject, template_type, status, error_message, created_at FROM email_logs ORDER BY id DESC LIMIT ?')
      .all(limit + 1);
  },

  findById(id) {
    return db.prepare('SELECT * FROM email_logs WHERE id = ?').get(id);
  },

  insert({ recipientEmail, subject, templateType, status = 'PENDING', errorMessage = null }) {
    return db.prepare(`
      INSERT INTO email_logs (recipient_email, subject, template_type, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(recipientEmail, subject, templateType, status, errorMessage);
  },

  insertSeed({ recipientEmail, subject, templateType, status, errorMessage, createdAt }) {
    return db.prepare(`
      INSERT INTO email_logs (recipient_email, subject, template_type, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recipientEmail, subject, templateType, status, errorMessage, createdAt);
  },

  countByStatus(status) {
    return db.prepare('SELECT COUNT(*) c FROM email_logs WHERE status = ?').get(status).c;
  },

  countAll() {
    return db.prepare('SELECT COUNT(*) c FROM email_logs').get().c;
  },

  clear() {
    return db.prepare('DELETE FROM email_logs').run();
  }
};

module.exports = emailLogs;