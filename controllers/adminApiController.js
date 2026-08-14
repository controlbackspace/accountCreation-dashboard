const users = require('../models/users');
const failedCreationLogs = require('../models/failedCreationLogs');

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
  const rows = users.findPage({ limit, beforeId });
  res.json(buildPage(rows, limit));
}

function listFailedLogs(req, res) {
  const limit = parseLimit(req.query.limit);
  const beforeId = parseCursor(req.query.cursor);
  const rows = failedCreationLogs.findPage({ limit, beforeId });
  res.json(buildPage(rows, limit));
}

module.exports = { listUsers, listFailedLogs };
