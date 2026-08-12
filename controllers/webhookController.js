const db = require('../config/database');
const bcrypt = require('bcrypt');
const { storeIdempotencyResult } = require('../middleware/idempotency');

const PROVISION_EVENTS = new Set([
  'payment.created',
  'payment.pending',
  'payment.paid',
  'payment.succeeded',
  'source.chargeable'
]);

const REFUND_EVENTS = new Set([
  'refund.created',
  'refund.paid',
  'refund.succeeded'
]);

const CHARGEBACK_EVENTS = new Set([
  'chargeback.created',
  'chargeback.updated'
]);

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
  const userEmail = payload?.data?.attributes?.customer_email;
  const userName = payload?.data?.attributes?.customer_name;
  const temporaryPassword = payload?.data?.attributes?.temp_password || 'TempPass123!';

  if (!paymentIntentId) {
    return respond(req, res, 400, { error: 'Missing payment intent ID' });
  }

  const existingUser = db
    .prepare('SELECT id FROM users WHERE payment_intent_id = ?')
    .get(paymentIntentId);

  if (existingUser) {
    return respond(req, res, 200, { status: 'ignored', message: 'Account already provisioned' });
  }

  try {
    if (!userEmail || !userName) {
      throw new Error('Payload missing required customer attributes (email or name)');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    const createAccountTransaction = db.transaction(() => {
      const insertUser = db.prepare(`
        INSERT INTO users (email, name, password_hash, payment_intent_id)
        VALUES (?, ?, ?, ?)
      `);
      return insertUser.run(userEmail, userName, passwordHash, paymentIntentId);
    });

    createAccountTransaction();

    return respond(req, res, 201, { status: 'success', message: 'User provisioned successfully' });

  } catch (error) {
    logChoiceBFailure(paymentIntentId, payload, error.message);
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

  const existingLog = db
    .prepare('SELECT id FROM failed_creation_logs WHERE payment_intent_id = ?')
    .get(paymentIntentId);

  if (!existingLog) {
    return respond(req, res, 200, { status: 'ignored', message: 'No pending Choice B recovery for this payment intent' });
  }

  db.prepare(`
    UPDATE failed_creation_logs
    SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
    WHERE payment_intent_id = ?
  `).run(paymentIntentId);

  return respond(req, res, 200, {
    status: 'refunded',
    message: 'Choice B recovery marked REFUNDED'
  });
}

function handleChargeback(payload, req, res) {
  const paymentIntentId = getPaymentIntentId(payload);

  if (!paymentIntentId) {
    return respond(req, res, 400, { error: 'Missing payment intent ID' });
  }

  const existingLog = db
    .prepare('SELECT id FROM failed_creation_logs WHERE payment_intent_id = ?')
    .get(paymentIntentId);

  if (existingLog) {
    return respond(req, res, 200, { status: 'ignored', message: 'Chargeback already recorded for this payment intent' });
  }

  logChoiceBFailure(
    paymentIntentId,
    payload,
    'Unrecoverable failure: chargeback detected on payment intent. Admin transition to REFUNDED required.'
  );

  return respond(req, res, 200, {
    status: 'recorded',
    message: 'Unrecoverable chargeback logged for administrative recovery'
  });
}

function logChoiceBFailure(paymentIntentId, payload, errorMessage) {
  try {
    const logFailureTransaction = db.transaction(() => {
      const upsertFailureLog = db.prepare(`
        INSERT INTO failed_creation_logs (payment_intent_id, raw_payload, error_message, status, attempts)
        VALUES (?, ?, ?, 'FAILED', 1)
        ON CONFLICT(payment_intent_id) DO UPDATE SET
          attempts = attempts + 1,
          error_message = excluded.error_message,
          updated_at = CURRENT_TIMESTAMP
      `);

      upsertFailureLog.run(
        paymentIntentId,
        JSON.stringify(payload),
        errorMessage || 'Unknown account creation failure'
      );
    });

    logFailureTransaction();
  } catch (loggingError) {
    console.error('[CRITICAL] Failed to write Choice B failure log to SQLite:', loggingError);
  }
}

function handlePaymentWebhook(req, res) {
  const payload = req.body;
  const eventType = getEventType(payload);

  if (!eventType || PROVISION_EVENTS.has(eventType)) {
    return handleProvision(payload, req, res);
  }

  if (REFUND_EVENTS.has(eventType)) {
    return handleRefund(payload, req, res);
  }

  if (CHARGEBACK_EVENTS.has(eventType)) {
    return handleChargeback(payload, req, res);
  }

  return respond(req, res, 200, {
    status: 'ignored',
    event: eventType,
    message: 'Event type not handled'
  });
}

module.exports = { handlePaymentWebhook };
