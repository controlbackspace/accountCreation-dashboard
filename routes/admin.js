const express = require('express');

const router = express.Router();

const { createAdminSession, requireAdmin } = require('../middleware/auth');
const { generateCsrf, verifyCsrf } = require('../middleware/csrf');
const {
  getDashboard,
  getUsersPage,
  getFailedLogsPage,
  retryProvisioning,
  markRefunded,
  getLoginForm,
  handleLogin,
  handleLogout
} = require('../controllers/adminController');
const { listUsers, listFailedLogs } = require('../controllers/adminApiController');

router.use(createAdminSession());

// open: login/logout, no auth yet
router.get('/login', generateCsrf, getLoginForm);
router.post('/login', verifyCsrf, handleLogin);
router.post('/logout', verifyCsrf, handleLogout);

// below here: everything needs a logged in admin
router.use(requireAdmin);
router.get('/dashboard', generateCsrf, getDashboard);
router.get('/users', generateCsrf, getUsersPage);
router.get('/failed-logs', generateCsrf, getFailedLogsPage);
router.post('/re-provision/:id', verifyCsrf, retryProvisioning);
router.post('/mark-refunded/:id', verifyCsrf, markRefunded);

// JSON endpoints for lazy loading (GET-only, after the auth turnstile)
router.get('/api/users', listUsers);
router.get('/api/failed-logs', listFailedLogs);

module.exports = router;
