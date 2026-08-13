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

// Public Admin Auth Routes
router.get('/login', generateCsrf, getLoginForm);
router.post('/login', verifyCsrf, handleLogin);
router.post('/logout', verifyCsrf, handleLogout);

// Protected Admin Routes
router.use(requireAdmin);
router.get('/dashboard', generateCsrf, getDashboard);
router.post('/re-provision/:id', verifyCsrf, retryProvisioning);
router.post('/mark-refunded/:id', verifyCsrf, markRefunded);

module.exports = router;
