const db = require('../config/database');
const bcrypt = require('bcrypt');
const users = require('../models/users');
const failedCreationLogs = require('../models/failedCreationLogs');
const { loginAdmin, logoutAdmin } = require('../middleware/auth');
const { DEFAULTS, LOG_STATUS } = require('../utils/constants');
const { MAX_LENGTHS, cleanText, safeReturnTo, validateCustomerAttributes } = require('../utils/validation');

function getLoginForm(req, res) {
  res.render('pages/login', {
    error: req.query.error || null,
    returnTo: req.query.returnTo || null
  });
}

function handleLogin(req, res) {
  const { username, password, returnTo } = req.body || {};

  const cleanUsername = cleanText(username, { maxLength: MAX_LENGTHS.USERNAME, required: true });
  const cleanPassword = cleanText(password, { maxLength: MAX_LENGTHS.PASSWORD, required: true, trim: false });

  if (!cleanUsername || !cleanPassword || !loginAdmin(req, cleanUsername, cleanPassword)) {
    const safeTarget = safeReturnTo(returnTo);
    const query = safeTarget
      ? `?error=${encodeURIComponent('Invalid credentials.')}&returnTo=${encodeURIComponent(safeTarget)}`
      : '?error=Invalid+credentials';
    return res.redirect('/admin/login' + query);
  }

  return res.redirect(safeReturnTo(returnTo) || '/admin/dashboard');
}

function handleLogout(req, res) {
  logoutAdmin(req, () => res.redirect('/admin/login'));
}

function getDashboard(req, res) {
  try {
    const stats = {
      totalUsers: users.countAll(),
      totalFailures: failedCreationLogs.countByStatus(LOG_STATUS.FAILED),
      reprovisioned: failedCreationLogs.countByStatus(LOG_STATUS.REPROVISIONED),
      refunded: failedCreationLogs.countByStatus(LOG_STATUS.REFUNDED)
    };
    const recentAlerts = failedCreationLogs.findRecentFailures(5);

    res.render('templates/adminLayout', {
      title: 'Admin Dashboard - Account Provisioning',
      page: 'pages/dashboard.ejs',
      nav: 'dashboard',
      stats,
      recentAlerts,
      query: req.query
    });
  } catch (error) {
    console.error('[ADMIN DASHBOARD ERROR]:', error);
    res.status(500).send('Error rendering admin dashboard');
  }
}

function getUsersPage(req, res) {
  res.render('templates/adminLayout', {
    title: 'Users - Account Provisioning',
    page: 'pages/users.ejs',
    nav: 'users',
    query: req.query
  });
}

function getFailedLogsPage(req, res) {
  res.render('templates/adminLayout', {
    title: 'Recovery Log - Account Provisioning',
    page: 'pages/failedLogs.ejs',
    nav: 'failed-logs',
    query: req.query
  });
}

async function retryProvisioning(req, res) {
  const logId = req.params.id;

  const logEntry = failedCreationLogs.findById(logId);

  if (!logEntry) {
    return res.redirect('/admin/dashboard?error=Log+entry+not+found');
  }

  try {
    const payload = JSON.parse(logEntry.raw_payload);
    const paymentIntentId = logEntry.payment_intent_id;
    const attributes = payload?.data?.attributes || {};

    const { email: userEmail, name: userName, temporaryPassword } = validateCustomerAttributes({
      email: attributes.customer_email,
      name: attributes.customer_name,
      temporaryPassword: attributes.temp_password
    });

    const saltRounds = DEFAULTS.BCRYPT_SALT_ROUNDS;
    const passwordHash = await bcrypt.hash(temporaryPassword || DEFAULTS.TEMP_PASSWORD, saltRounds);

    const retryTransaction = db.transaction(() => {
      users.insert({ email: userEmail, name: userName, passwordHash, paymentIntentId });
      failedCreationLogs.markReprovisioned(logId);
    });

    retryTransaction();

    return res.redirect('/admin/dashboard?success=Account+successfully+re-provisioned');

  } catch (error) {
    failedCreationLogs.incrementAttemptsAndUpdateMessage(logId, error.message);

    return res.redirect(`/admin/dashboard?error=${encodeURIComponent('Retry failed: ' + error.message)}`);
  }
}

function markRefunded(req, res) {
  const logId = req.params.id;

  const logEntry = failedCreationLogs.findById(logId);

  if (!logEntry) {
    return res.redirect('/admin/dashboard?error=Log+entry+not+found');
  }

  failedCreationLogs.setStatus(logEntry.payment_intent_id, LOG_STATUS.REFUNDED);

  return res.redirect('/admin/dashboard?success=Log+marked+as+refunded');
}

module.exports = {
  getDashboard,
  getUsersPage,
  getFailedLogsPage,
  retryProvisioning,
  markRefunded,
  getLoginForm,
  handleLogin,
  handleLogout
};
