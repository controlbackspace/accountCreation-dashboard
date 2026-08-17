const db = require('../config/database');
const bcrypt = require('bcrypt');
const users = require('../models/users');
const failedCreationLogs = require('../models/failedCreationLogs');
const { storeIdempotencyResult } = require('../middleware/idempotency');
const { EVENT_TYPES, DEFAULTS, LOG_STATUS } = require('../utils/constants');
const { MAX_LENGTHS, validateCustomerAttributes } = require('../utils/validation');

function getEventType(payload) {
  return payload && payload.data && payload.data.type;
}

function getPaymentIntentId(payload) {
  const data = payload && payload.data;
  if (!data) {
    return null;
  }
  return (data.attributes && data.attributes.payment_intent_id) || data.id;
}

function respond(req, res, status, body) {
  storeIdempotencyResult(req, status, body);
  res.status(status).json(body);
}

async function handleProvision(payload, req, res) {
  const paymentIntentId = getPaymentIntentId(payload);
  const attributes = payload?.data?.attributes || {};

  if (!paymentIntentId || paymentIntentId.length > MAX_LENGTHS.PAYMENT_INTENT_ID) {
    return respond(req, res, 400, { error: 'Missing or invalid payment intent ID' });
  }

  const existingUser = users.findPaymentIntent(paymentIntentId);

  if (existingUser) {
    return respond(req, res, 200, { status: 'ignored', message: 'Account already provisioned' });
  }

  try {
    const { email: userEmail, name: userName, temporaryPassword } = validateCustomerAttributes({
      email: attributes.customer_email,
      name: attributes.customer_name,
      temporaryPassword: attributes.temp_password
    });

    const saltRounds = DEFAULTS.BCRYPT_SALT_ROUNDS;
    const passwordHash = await bcrypt.hash(temporaryPassword || DEFAULTS.TEMP_PASSWORD, saltRounds);

    const createAccountTransaction = db.transaction(() => {
      users.insert({ email: userEmail, name: userName, passwordHash, paymentIntentId });
    });

    createAccountTransaction();

    return respond(req, res, 201, { status: 'success', message: 'User provisioned successfully' });

  } catch (error) {
    logProvisioningFailure(paymentIntentId, payload, error.message);
    return respond(req, res, 500, {
      status: 'error',
      message: 'Account creation failed. Logged for administrative recovery.'
    });
  }
}

function handleRefund(payload, req, res) {
  const paymentIntentId = getPaymentIntentId(payload);

  if (!paymentIntentId) {
    return respond(req, res, 400, { error: 'Missing payment intent ID' });
  }

  const existingLog = failedCreationLogs.findByPaymentIntent(paymentIntentId);

  if (!existingLog) {
    return respond(req, res, 200, { status: 'ignored', message: 'No pending recovery log for this payment intent' });
  }

  failedCreationLogs.setStatus(paymentIntentId, LOG_STATUS.REFUNDED);

  return respond(req, res, 200, {
    status: 'refunded',
    message: 'Recovery log marked REFUNDED'
  });
}

function handleChargeback(payload, req, res) {
  const paymentIntentId = getPaymentIntentId(payload);

  if (!paymentIntentId) {
    return respond(req, res, 400, { error: 'Missing payment intent ID' });
  }

  const existingLog = failedCreationLogs.findByPaymentIntent(paymentIntentId);

  if (existingLog) {
    return respond(req, res, 200, { status: 'ignored', message: 'Chargeback already recorded for this payment intent' });
  }

  logProvisioningFailure(
    paymentIntentId,
    payload,
    'Unrecoverable failure: chargeback detected on payment intent. Admin transition to REFUNDED required.'
  );

  return respond(req, res, 200, {
    status: 'recorded',
    message: 'Unrecoverable chargeback logged for administrative recovery'
  });
}

function logProvisioningFailure(paymentIntentId, payload, errorMessage) {
  try {
    const logFailureTransaction = db.transaction(() => {
      failedCreationLogs.insert({
        paymentIntentId,
        rawPayload: JSON.stringify(payload),
        errorMessage: errorMessage || 'Unknown account creation failure'
      });
    });

    logFailureTransaction();
  } catch (loggingError) {
    console.error('[CRITICAL] Failed to write recovery log to SQLite:', loggingError);
  }
}

function handlePaymentWebhook(req, res) {
  const payload = req.body;
  const eventType = getEventType(payload);

  if (!eventType || EVENT_TYPES.PROVISION.has(eventType)) {
    return handleProvision(payload, req, res);
  }

  if (EVENT_TYPES.REFUND.has(eventType)) {
    return handleRefund(payload, req, res);
  }

  if (EVENT_TYPES.CHARGEBACK.has(eventType)) {
    return handleChargeback(payload, req, res);
  }

  return respond(req, res, 200, {
    status: 'ignored',
    event: eventType,
    message: 'Event type not handled'
  });
}

module.exports = { handlePaymentWebhook };
