const express = require('express');

const router = express.Router();

const { createAdminSession, requireAdmin } = require('../middleware/auth');
const { generateCsrf, verifyCsrf } = require('../middleware/csrf');
const {
  getDashboard,
  retryProvisioning,
  markRefunded,
  getLoginForm,
  handleLogin,
  handleLogout
} = require('../controllers/adminController');

router.use(createAdminSession());

// open: login/logout, no auth yet
router.get('/login', generateCsrf, getLoginForm);
router.post('/login', verifyCsrf, handleLogin);
router.post('/logout', verifyCsrf, handleLogout);

// below here: everything needs a logged in admin
router.use(requireAdmin);
router.get('/dashboard', generateCsrf, getDashboard);
router.post('/re-provision/:id', verifyCsrf, retryProvisioning);
router.post('/mark-refunded/:id', verifyCsrf, markRefunded);

module.exports = router;
