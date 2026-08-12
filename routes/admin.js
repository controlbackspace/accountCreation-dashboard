const express = require('express');

const router = express.Router();

const { getDashboard, retryProvisioning, markRefunded } = require('../controllers/adminController');
router.get('/dashboard', getDashboard);
router.post('/re-provision/:id', retryProvisioning);
router.post('/mark-refunded/:id', markRefunded);

module.exports = router;
