(function () {
  'use strict';

  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

  async function updateDashboardMetrics() {
    try {
      const response = await fetch('/admin/api/stats', {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[Stats Poller] Session expired');
        }
        return;
      }

      const { stats } = await response.json();

      updateStatText('[data-stat="totalUsers"]', stats.totalUsers);
      updateStatText('[data-stat="totalFailures"]', stats.totalFailures);
      updateStatText('[data-stat="reprovisioned"]', stats.reprovisioned);
      updateStatText('[data-stat="refunded"]', stats.refunded);

      updateStatText('[data-pill-count="users"]', stats.totalUsers);
      updateStatText('[data-pill-count="failed"]', stats.totalFailures);

      const timestampEl = document.querySelector('#stats-last-updated');
      if (timestampEl) {
        timestampEl.textContent = 'Last synchronized: ' + stats.timestamp;
      }
    } catch (err) {
      console.warn('[Stats Poller] Background sync failed:', err.message);
    }
  }

  function updateStatText(selector, value) {
    const el = document.querySelector(selector);
    if (el && el.textContent !== String(value)) {
      el.textContent = value;
      el.classList.add('stat-value-updated');
      setTimeout(function () {
        el.classList.remove('stat-value-updated');
      }, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    updateDashboardMetrics();
    setInterval(updateDashboardMetrics, REFRESH_INTERVAL_MS);
  }
})();