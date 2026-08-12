const db = require('../config/database');
const bcrypt = require('bcrypt');
const { loginAdmin, logoutAdmin } = require('../middleware/auth');

function getLoginForm(req, res) {
  res.render('pages/login', {
    error: req.query.error || null,
    returnTo: req.query.returnTo || null
  });
}

function handleLogin(req, res) {
  const { username, password, returnTo } = req.body || {};

  if (!loginAdmin(req, username, password)) {
    const query = returnTo
      ? `?error=${encodeURIComponent('Invalid credentials.')}&returnTo=${encodeURIComponent(returnTo)}`
      : '?error=Invalid+credentials';
    return res.redirect('/admin/login' + query);
  }

  const target = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : '/admin/dashboard';
  return res.redirect(target);
}

function handleLogout(req, res) {
  logoutAdmin(req, () => res.redirect('/admin/login'));
}

function getDashboard(req, res) {
  try {
    const users = db
      .prepare('SELECT id, email, name, payment_intent_id, created_at FROM users ORDER BY created_at DESC')
      .all();

    const failedLogs = db
      .prepare('SELECT id, payment_intent_id, raw_payload, error_message, status, attempts, created_at, updated_at FROM failed_creation_logs ORDER BY created_at DESC')
      .all();

    const stats = {
      totalUsers: users.length,
      totalFailures: failedLogs.filter(f => f.status === 'FAILED').length,
      reprovisioned: failedLogs.filter(f => f.status === 'REPROVISIONED').length,
      refunded: failedLogs.filter(f => f.status === 'REFUNDED').length
    };

    res.render('templates/adminLayout', {
      title: 'Admin Dashboard - Account Provisioning',
      page: 'pages/dashboard.ejs',
      users,
      failedLogs,
      stats,
      query: req.query
    });
  } catch (error) {
    console.error('[ADMIN DASHBOARD ERROR]:', error);
    res.status(500).send('Error rendering admin dashboard');
  }
}

async function retryProvisioning(req, res) {
  const logId = req.params.id;

  const logEntry = db
    .prepare('SELECT * FROM failed_creation_logs WHERE id = ?')
    .get(logId);

  if (!logEntry) {
    return res.redirect('/admin/dashboard?error=Log+entry+not+found');
  }

  try {
    const payload = JSON.parse(logEntry.raw_payload);
    const paymentIntentId = logEntry.payment_intent_id;
    const userEmail = payload?.data?.attributes?.customer_email;
    const userName = payload?.data?.attributes?.customer_name;
    const temporaryPassword = payload?.data?.attributes?.temp_password || 'TempPass123!';

    if (!userEmail || !userName) {
      throw new Error('Payload missing required customer attributes');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    const retryTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (email, name, password_hash, payment_intent_id)
        VALUES (?, ?, ?, ?)
      `).run(userEmail, userName, passwordHash, paymentIntentId);

      db.prepare(`
        UPDATE failed_creation_logs
        SET status = 'REPROVISIONED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(logId);
    });

    retryTransaction();

    return res.redirect('/admin/dashboard?success=Account+successfully+re-provisioned');

  } catch (error) {
    db.prepare(`
      UPDATE failed_creation_logs
      SET attempts = attempts + 1, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(error.message, logId);

    return res.redirect(`/admin/dashboard?error=${encodeURIComponent('Retry failed: ' + error.message)}`);
  }
}

function markRefunded(req, res) {
  const logId = req.params.id;

  const logEntry = db
    .prepare('SELECT * FROM failed_creation_logs WHERE id = ?')
    .get(logId);

  if (!logEntry) {
    return res.redirect('/admin/dashboard?error=Log+entry+not+found');
  }

  db.prepare(`
    UPDATE failed_creation_logs
    SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(logId);

  return res.redirect('/admin/dashboard?success=Log+marked+as+refunded');
}

module.exports = {
  getDashboard,
  retryProvisioning,
  markRefunded,
  getLoginForm,
  handleLogin,
  handleLogout
};
