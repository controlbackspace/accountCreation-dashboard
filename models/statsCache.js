const db = require('../config/database');

const statsCache = {
  getStats() {
    return db.prepare('SELECT total_users, total_failures, reprovisioned, refunded, updated_at FROM stats_cache WHERE id = 1').get();
  },

  upsertStats({ totalUsers, totalFailures, reprovisioned, refunded }) {
    return db.prepare(`
      INSERT INTO stats_cache (id, total_users, total_failures, reprovisioned, refunded, updated_at)
      VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        total_users = excluded.total_users,
        total_failures = excluded.total_failures,
        reprovisioned = excluded.reprovisioned,
        refunded = excluded.refunded,
        updated_at = CURRENT_TIMESTAMP
    `).run(totalUsers, totalFailures, reprovisioned, refunded);
  },

  clear() {
    return db.prepare('DELETE FROM stats_cache').run();
  }
};

module.exports = statsCache;