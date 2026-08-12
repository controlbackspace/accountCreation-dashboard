const db = require('../config/database');
const bcrypt = require('bcrypt');

async function handlePaymentWebhook(req, res) {
  const payload = req.body;
  
  const paymentIntentId = payload?.data?.id;
  const userEmail = payload?.data?.attributes?.customer_email;
  const userName = payload?.data?.attributes?.customer_name;
  const temporaryPassword = payload?.data?.attributes?.temp_password || 'TempPass123!';

  if (!paymentIntentId) {
    return res.status(400).json({ error: 'Missing payment intent ID' });
  }

  const existingUser = db
    .prepare('SELECT id FROM users WHERE payment_intent_id = ?')
    .get(paymentIntentId);

  if (existingUser) {
    return res.status(200).json({ status: 'ignored', message: 'Account already provisioned' });
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

    return res.status(201).json({ status: 'success', message: 'User provisioned successfully' });

  } catch (error) {
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
          error.message || 'Unknown account creation failure'
        );
      });

      logFailureTransaction();

    } catch (loggingError) {
      console.error('[CRITICAL] Failed to write failure log to SQLite:', loggingError);
    }

    return res.status(500).json({
      status: 'error',
      message: 'Account creation failed. Logged for administrative recovery.'
    });
  }
}

module.exports = { handlePaymentWebhook };
