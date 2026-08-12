const express = require('express');
const router = express.Router();

const rateLimit = require('express-rate-limit');

const { handlePaymentWebhook } = require('../controllers/webhookController');
const { verifyWebhookHmac } = require('../middleware/verifyHmac');
const { trackIdempotency } = require('../middleware/idempotency');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_test_secret_key_123';

const webhookLimiter = rateLimit({
  windowMs: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.WEBHOOK_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests, please retry later.' }
});

router.post(
  '/',
  webhookLimiter,
  verifyWebhookHmac(WEBHOOK_SECRET),
  trackIdempotency,
  handlePaymentWebhook
);

module.exports = router;
