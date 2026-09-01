const users = require('../models/users');
const failedCreationLogs = require('../models/failedCreationLogs');
const statsCache = require('../models/statsCache');
const { LOG_STATUS } = require('../utils/constants');

function getLiveStats(req, res) {
  const cached = statsCache.getStats();

  if (cached) {
    const stats = {
      totalUsers: cached.total_users,
      totalFailures: cached.total_failures,
      reprovisioned: cached.reprovisioned,
      refunded: cached.refunded,
      timestamp: new Date(cached.updated_at).toLocaleTimeString()
    };
    return res.json({ success: true, stats, cached: true });
  }

  const totalUsers = users.countAll();
  const totalFailures = failedCreationLogs.countByStatus(LOG_STATUS.FAILED);
  const reprovisioned = failedCreationLogs.countByStatus(LOG_STATUS.REPROVISIONED);
  const refunded = failedCreationLogs.countByStatus(LOG_STATUS.REFUNDED);

  statsCache.upsertStats({ totalUsers, totalFailures, reprovisioned, refunded });

  const stats = {
    totalUsers,
    totalFailures,
    reprovisioned,
    refunded,
    timestamp: new Date().toLocaleTimeString()
  };
  res.json({ success: true, stats, cached: false });
}

function parseLimit(raw) {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 8;
  }
  return Math.min(parsed, 50);
}

function parseCursor(raw) {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
}

function buildPage(rows, limit) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  return {
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? last.id : null
    }
  };
}

function listUsers(req, res) {
  const limit = parseLimit(req.query.limit);
  const beforeId = parseCursor(req.query.cursor);
  const q = (req.query.q || '').trim() || null;
  const rows = users.findPage({ limit, beforeId, q });
  res.json(buildPage(rows, limit));
}

function listFailedLogs(req, res) {
  const limit = parseLimit(req.query.limit);
  const beforeId = parseCursor(req.query.cursor);
  const q = (req.query.q || '').trim() || null;
  const rows = failedCreationLogs.findPage({ limit, beforeId, q });
  res.json(buildPage(rows, limit));
}

module.exports = { listUsers, listFailedLogs, getLiveStats };
