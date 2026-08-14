(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
    return escapeHtml(date.toLocaleString());
  }

  function badgeClass(status) {
    if (status === 'REPROVISIONED') return 'badge-success';
    if (status === 'REFUNDED') return 'badge-refunded';
    return 'badge-failed';
  }

  const renderers = {
    users(row, csrf) {
      return '<tr>' +
        '<td>#' + escapeHtml(row.id) + '</td>' +
        '<td>' + escapeHtml(row.name) + '</td>' +
        '<td>' + escapeHtml(row.email) + '</td>' +
        '<td><code>' + escapeHtml(row.payment_intent_id) + '</code></td>' +
        '<td class="nowrap">' + formatDate(row.created_at) + '</td>' +
        '</tr>';
    },

    'failed-logs': function (row, csrf) {
      let actions = '<span style="color:#6c757d; font-size:12px;">Resolved</span>';
      if (row.status === 'FAILED') {
        actions =
          '<div class="action-group">' +
          '<form action="/admin/re-provision/' + escapeHtml(row.id) + '" method="POST" style="margin:0;">' +
          '<input type="hidden" name="_csrf" value="' + escapeHtml(csrf) + '">' +
          '<button type="submit" class="btn btn-retry" title="Re-attempt provisioning from the stored payload">Retry</button>' +
          '</form>' +
          '<form action="/admin/mark-refunded/' + escapeHtml(row.id) + '" method="POST" style="margin:0;">' +
          '<input type="hidden" name="_csrf" value="' + escapeHtml(csrf) + '">' +
          '<button type="submit" class="btn btn-refund" title="Mark this failed transaction as refunded">Mark Refunded</button>' +
          '</form>' +
          '</div>';
      } else if (row.status === 'REFUNDED') {
        actions = '<span style="color:#6c757d; font-size:12px;">Refunded</span>';
      }
      return '<tr>' +
        '<td><code>' + escapeHtml(row.payment_intent_id) + '</code></td>' +
        '<td style="color:#d81b60;">' + escapeHtml(row.error_message) + '</td>' +
        '<td><span class="badge ' + badgeClass(row.status) + '">' + escapeHtml(row.status) + '</span></td>' +
        '<td>' + escapeHtml(row.attempts) + '</td>' +
        '<td class="nowrap">' + formatDate(row.created_at) + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }
  };

  function removeSkeletons(tbody) {
    tbody.querySelectorAll('tr.skeleton-row').forEach(function (row) {
      row.remove();
    });
  }

  function initTable(table, options) {
    options = options || {};
    if (table.dataset.init === 'true') return;
    if (table.hasAttribute('data-lazy') && !options.force) return;

    table.dataset.init = 'true';

    const tbody = table.querySelector('tbody[data-load-table]');
    const scope = table.closest('[data-tab-pane], .card') || table.parentElement;
    const button = scope ? scope.querySelector('button[data-load-more]') : null;
    const endpoint = table.getAttribute('data-endpoint');
    const pageSize = parseInt(table.getAttribute('data-page-size') || '8', 10);
    const csrf = table.getAttribute('data-csrf') || '';
    const kind = table.getAttribute('data-table-kind');
    const render = renderers[kind] || renderers.users;

    let cursor = null;
    let loading = false;

    function showMessage(message, isError) {
      removeSkeletons(tbody);
      tbody.innerHTML = '';
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="99" style="text-align:center;color:' + (isError ? '#d81b60' : '#666') + ';padding:24px;">' +
        escapeHtml(message) + '</td>';
      tbody.appendChild(row);
    }

    function appendRows(rows) {
      rows.forEach(function (row) {
        const holder = document.createElement('tbody');
        holder.innerHTML = render(row, csrf);
        while (holder.firstChild) {
          tbody.appendChild(holder.firstChild);
        }
      });
    }

    function loadMore() {
      if (loading) return;
      loading = true;
      if (button) button.disabled = true;

      let url = endpoint + '?limit=' + pageSize;
      if (cursor) url += '&cursor=' + cursor;

      fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(function (res) {
          if (res.status === 401) {
            throw new Error('Session expired. Redirecting to login...');
          }
          if (!res.ok) {
            throw new Error('Request failed (' + res.status + ')');
          }
          return res.json();
        })
        .then(function (payload) {
          removeSkeletons(tbody);
          const rows = payload.data || [];
          if (rows.length === 0 && !cursor) {
            showMessage('No records to display.');
          } else {
            appendRows(rows);
          }
          cursor = payload.pagination.nextCursor;
          if (button) {
            button.hidden = !payload.pagination.hasMore;
            button.disabled = false;
          }
        })
        .catch(function (err) {
          showMessage(err.message || 'Failed to load data.', true);
          if (button) button.hidden = true;
          if (/Session expired/.test(err.message || '')) {
            setTimeout(function () {
              window.location.href = '/admin/login';
            }, 1200);
          }
        })
        .then(function () {
          loading = false;
        });
    }

    if (button) {
      button.addEventListener('click', loadMore);
    }

    loadMore();
  }

  function wireTabs() {
    document.querySelectorAll('[data-tab-group]').forEach(function (group) {
      const triggers = group.querySelectorAll('[data-tab-trigger]');
      const panes = group.querySelector('[data-tab-panes]');

      function closeAll() {
        triggers.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        group.querySelectorAll('[data-tab-pane]').forEach(function (p) {
          p.classList.remove('active');
          p.setAttribute('aria-hidden', 'true');
        });
        if (panes) panes.classList.remove('has-open');
      }

      triggers.forEach(function (btn) {
        btn.addEventListener('click', function () {
          const target = btn.getAttribute('data-tab-trigger');

          if (btn.classList.contains('active')) {
            // clicking the active pill collapses the panel back to pills-only
            closeAll();
            return;
          }

          closeAll();
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');

          const pane = group.querySelector('[data-tab-pane="' + target + '"]');
          if (pane) {
            pane.classList.add('active');
            pane.setAttribute('aria-hidden', 'false');
            const table = pane.querySelector('table[data-endpoint]');
            if (table) initTable(table, { force: true });
          }
          if (panes) panes.classList.add('has-open');
        });
      });

      // default state: collapsed (pills only, no panel)
      closeAll();
    });
  }

  // auto-init standalone pages (tables NOT wrapped in lazy tab panes)
  document.querySelectorAll('table[data-endpoint]:not([data-lazy])').forEach(function (t) {
    initTable(t, { force: true });
  });

  wireTabs();
})();
