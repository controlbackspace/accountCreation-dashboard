const users = require('../models/users');
const failedCreationLogs = require('../models/failedCreationLogs');
const statsCache = require('../models/statsCache');
const { LOG_STATUS } = require('../utils/constants');

function runTelemetryTick() {
  const start = Date.now();

  const totalUsers = users.countAll();
  const totalFailures = failedCreationLogs.countByStatus(LOG_STATUS.FAILED);
  const reprovisioned = failedCreationLogs.countByStatus(LOG_STATUS.REPROVISIONED);
  const refunded = failedCreationLogs.countByStatus(LOG_STATUS.REFUNDED);

  statsCache.upsertStats({ totalUsers, totalFailures, reprovisioned, refunded });

  const elapsed = Date.now() - start;
  const timestamp = new Date().toISOString();
  console.log(`[CRON 5-MIN RUN ${timestamp}] Active Users: ${totalUsers} | Active Failures: ${totalFailures} | Reprovisioned: ${reprovisioned} | Refunded: ${refunded} | took ${elapsed}ms`);
}

module.exports = { runTelemetryTick };