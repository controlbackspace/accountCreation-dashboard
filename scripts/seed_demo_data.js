const db = require('../config/database');
const bcrypt = require('bcrypt');
const users = require('../models/users');
const failedCreationLogs = require('../models/failedCreationLogs');
const idempotencyKeys = require('../models/idempotencyKeys');
const { DEFAULTS, LOG_STATUS } = require('../utils/constants');

(async () => {
  // sessions table is owned by better-sqlite3-session-store, so it stays direct here
  const reset = db.transaction(() => {
    idempotencyKeys.clear();
    db.prepare('DELETE FROM sessions').run();
    failedCreationLogs.clear();
    users.clear();
  });
  reset();

  const seedUsers = [
    ['maria.santos@gmail.com', 'Maria Santos', 'pi_live_1001', '2026-08-10 09:15:00'],
    ['jose.ramirez@gmail.com', 'Jose Ramirez', 'pi_live_1002', '2026-08-10 10:02:00'],
    ['ana.reyes@yahoo.com', 'Ana Reyes', 'pi_live_1003', '2026-08-11 11:30:00'],
    ['miguel.torres@outlook.com', 'Miguel Torres', 'pi_live_1004', '2026-08-11 14:45:00'],
    ['lucia.bautista@gmail.com', 'Lucia Bautista', 'pi_live_1005', '2026-08-12 08:20:00'],
    ['carlos.espino@yahoo.com', 'Carlos Espino', 'pi_live_1006', '2026-08-12 09:10:00'],
    ['bea.villamor@gmail.com', 'Bea Villamor', 'pi_live_1007', '2026-08-12 10:05:00'],
    ['renato.silva@outlook.com', 'Renato Silva', 'pi_live_1008', '2026-08-12 11:40:00']
  ];

  for (const [email, name, pi, created] of seedUsers) {
    const hash = await bcrypt.hash(DEFAULTS.TEMP_PASSWORD, DEFAULTS.BCRYPT_SALT_ROUNDS);
    users.insertSeed({ email, name, passwordHash: hash, paymentIntentId: pi, createdAt: created });
  }

  // Build a webhook payload; pass email/name as null to simulate missing attributes
  const mkPayload = (id, email, name, type) => {
    const attributes = {};
    if (email) attributes.customer_email = email;
    if (name) attributes.customer_name = name;
    attributes.temp_password = DEFAULTS.TEMP_PASSWORD;
    return JSON.stringify({
      data: { id, type: type || 'payment.paid', attributes }
    });
  };

  const failures = [
    // ===== FAILED (retryable transient) — valid payloads, Retry will succeed =====
    { pi: 'pi_fail_2001', email: 'andres.villanueva@gmail.com', name: 'Andres Villanueva', err: 'Database write lock timeout during webhook execution', status: LOG_STATUS.FAILED, attempts: 2, created: '2026-08-12 09:05:00', updated: '2026-08-12 09:06:30' },
    { pi: 'pi_fail_2003', email: 'marco.delacruz@gmail.com', name: 'Marco Dela Cruz', err: 'Network timeout while waiting for payment gateway response', status: LOG_STATUS.FAILED, attempts: 3, created: '2026-08-12 11:15:00', updated: '2026-08-12 11:16:45' },
    { pi: 'pi_fail_2004', email: 'jenna.ramos@yahoo.com', name: 'Jenna Ramos', err: 'Temporary database connection reset', status: LOG_STATUS.FAILED, attempts: 1, created: '2026-08-13 08:40:00', updated: '2026-08-13 08:40:20' },
    { pi: 'pi_fail_2005', email: 'vince.ocampo@gmail.com', name: 'Vince Ocampo', err: 'bcrypt hashing resource exhaustion (server under load)', status: LOG_STATUS.FAILED, attempts: 4, created: '2026-08-13 10:02:00', updated: '2026-08-13 10:04:00' },
    // Provider returned HTTP 503 (temporary), payload is valid so Retry succeeds
    { pi: 'pi_fail_2010', email: 'isabel.flores@yahoo.com', name: 'Isabel Flores', err: 'Payment gateway responded with HTTP 503 Service Unavailable', status: LOG_STATUS.FAILED, attempts: 2, created: '2026-08-13 13:10:00', updated: '2026-08-13 13:11:20' },
    // Upstream webhook worker crashed mid-transaction
    { pi: 'pi_fail_2011', email: 'andrea.salazar@gmail.com', name: 'Andrea Salazar', err: 'Webhook worker crashed mid-transaction, no commit was made', status: LOG_STATUS.FAILED, attempts: 1, created: '2026-08-13 14:25:00', updated: '2026-08-13 14:25:05' },
    // Slow third-party integration call timed out
    { pi: 'pi_fail_2012', email: 'kyle.manalo@outlook.com', name: 'Kyle Manalo', err: 'Timed out calling external ID verification service', status: LOG_STATUS.FAILED, attempts: 3, created: '2026-08-13 15:00:00', updated: '2026-08-13 15:03:30' },

    // ===== FAILED (unrecoverable) — Retry will keep failing; Mark Refunded is the path =====
    // Chargeback — money contested, admin must resolve
    { pi: 'pi_fail_2002', email: 'karina.delossantos@gmail.com', name: 'Karina Delos Santos', err: 'Unrecoverable failure: chargeback detected on payment intent. Admin transition to REFUNDED required.', status: LOG_STATUS.FAILED, attempts: 1, created: '2026-08-12 10:30:00', updated: '2026-08-12 10:30:00' },
    // Missing customer email in payload
    { pi: 'pi_fail_2006', email: null, name: 'Nathaniel Cruz', err: 'Payload missing required customer attributes (email or name)', status: LOG_STATUS.FAILED, attempts: 1, created: '2026-08-12 14:22:00', updated: '2026-08-12 14:22:10' },
    // Missing customer name in payload
    { pi: 'pi_fail_2007', email: 'trisha.villanueva@gmail.com', name: null, err: 'Payload missing required customer attributes (email or name)', status: LOG_STATUS.FAILED, attempts: 2, created: '2026-08-13 09:10:00', updated: '2026-08-13 09:12:00' },
    // Duplicate email — UNIQUE constraint on users.email blocks insertion
    { pi: 'pi_fail_2008', email: 'maria.santos@gmail.com', name: 'Maria Santos', err: 'SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: users.email', status: LOG_STATUS.FAILED, attempts: 3, created: '2026-08-13 11:30:00', updated: '2026-08-13 11:32:00' },
    // Corrupted payload — raw_payload is not valid JSON, Retry will throw on parse
    { pi: 'pi_fail_2009', raw: '{"data": {"id": "pi_fail_2009", "type": "payment.paid", "attributes": {"customer_email": "gabby.tan@gmail.com"', err: 'Malformed payload: raw payload could not be parsed', status: LOG_STATUS.FAILED, attempts: 1, created: '2026-08-13 12:00:00', updated: '2026-08-13 12:00:05' },
    // Invalid email format — fails validation, Retry keeps failing
    { pi: 'pi_fail_2013', email: 'not-an-email', name: 'Paolo Villanueva', err: 'Invalid customer email format in payload', status: LOG_STATUS.FAILED, attempts: 2, created: '2026-08-13 16:10:00', updated: '2026-08-13 16:12:00' },
    // Payment intent already expired/voided at the gateway while stuck in FAILED
    { pi: 'pi_fail_2014', email: 'cristina.abad@gmail.com', name: 'Cristina Abad', err: 'Unrecoverable failure: payment intent expired. Admin transition to REFUNDED required.', status: LOG_STATUS.FAILED, attempts: 1, created: '2026-08-13 17:30:00', updated: '2026-08-13 17:30:40' },

    // ===== REPROVISIONED - recovered via admin Retry =====
    { pi: 'pi_repro_3001', email: 'ramon.aquino@gmail.com', name: 'Ramon Aquino', err: 'Simulated lock timeout during initial webhook execution', status: LOG_STATUS.REPROVISIONED, attempts: 2, created: '2026-08-11 13:00:00', updated: '2026-08-11 13:10:00' },
    { pi: 'pi_repro_3002', email: 'elena.mendoza@yahoo.com', name: 'Elena Mendoza', err: 'Payload missing required customer attributes', status: LOG_STATUS.REPROVISIONED, attempts: 3, created: '2026-08-12 07:45:00', updated: '2026-08-12 08:00:00' },
    // Was stuck in FAILED, then a gateway retry succeeded on its own
    { pi: 'pi_repro_3003', email: 'daryl.castillo@gmail.com', name: 'Daryl Castillo', err: 'Gateway retried delivery automatically after transient failure', status: LOG_STATUS.REPROVISIONED, attempts: 4, created: '2026-08-12 16:30:00', updated: '2026-08-12 16:45:00' },
    { pi: 'pi_repro_3004', email: 'camille.roa@outlook.com', name: 'Camille Roa', err: 'Database write lock timeout during webhook execution', status: LOG_STATUS.REPROVISIONED, attempts: 2, created: '2026-08-13 06:20:00', updated: '2026-08-13 06:25:00' },

    // ===== REFUNDED - terminal, money returned =====
    { pi: 'pi_refund_4001', email: 'paolo.garcia@gmail.com', name: 'Paolo Garcia', err: 'Payload missing required customer attributes', status: LOG_STATUS.REFUNDED, attempts: 3, created: '2026-08-10 16:20:00', updated: '2026-08-10 17:05:00' },
    { pi: 'pi_refund_4002', email: 'sofia.navarro@outlook.com', name: 'Sofia Navarro', err: 'Payment refunded after repeated provisioning failures', status: LOG_STATUS.REFUNDED, attempts: 5, created: '2026-08-11 15:50:00', updated: '2026-08-11 16:40:00' },
    { pi: 'pi_refund_4003', email: 'julian.mercado@gmail.com', name: 'Julian Mercado', err: 'Customer requested cancellation, money returned', status: LOG_STATUS.REFUNDED, attempts: 4, created: '2026-08-13 18:20:00', updated: '2026-08-13 18:50:00' }
  ];

  for (const f of failures) {
    const rawPayload = f.raw || mkPayload(f.pi, f.email, f.name);
    failedCreationLogs.insertSeed({
      paymentIntentId: f.pi,
      rawPayload,
      errorMessage: f.err,
      status: f.status,
      attempts: f.attempts,
      createdAt: f.created,
      updatedAt: f.updated
    });
  }

  console.log('users:', users.countAll());
  console.log('failed logs:', failedCreationLogs.countAll());
  console.log('status spread:', JSON.stringify(failedCreationLogs.statusSpread()));
  console.log('idempotency:', idempotencyKeys.countAll ? idempotencyKeys.countAll() : 0);
  console.log('sessions:', db.prepare('SELECT COUNT(*) c FROM sessions').get().c);
})();