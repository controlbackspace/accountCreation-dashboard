const express = require('express');
const router = express.Router();

const { handlePaymentWebhook } = require('../controllers/webhookController');
const { verifyWebhookHmac } = require('../middleware/verifyHmac');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_test_secret_key_123';

router.post('/', verifyWebhookHmac(WEBHOOK_SECRET), handlePaymentWebhook);

module.exports = router;
