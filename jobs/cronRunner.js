const cron = require('node-cron');
const { runTelemetryTick } = require('./telemetryJob');

function startTelemetryCron() {
  runTelemetryTick();

  cron.schedule('*/5 * * * *', () => {
    runTelemetryTick();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[CRON RUNNER] Telemetry job scheduled every 5 minutes (UTC), initial tick executed');
}

module.exports = { startTelemetryCron };