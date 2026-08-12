const express = require('express');

const router = express.Router();

const { createAdminSession, requireAdmin } = require('../middleware/auth');
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
router.get('/login', getLoginForm);
router.post('/login', handleLogin);
router.post('/logout', handleLogout);

// Protected Admin Routes
router.use(requireAdmin);
router.get('/dashboard', getDashboard);
router.post('/re-provision/:id', retryProvisioning);
router.post('/mark-refunded/:id', markRefunded);

module.exports = router;