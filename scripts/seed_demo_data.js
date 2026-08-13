const db = require('../config/database');
const bcrypt = require('bcrypt');

(async () => {
  const reset = db.transaction(() => {
    db.prepare('DELETE FROM idempotency_keys').run();
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM failed_creation_logs').run();
    db.prepare('DELETE FROM users').run();
  });
  reset();

  const users = [
    ['maria.santos@gmail.com', 'Maria Santos', 'pi_live_1001', '2026-08-10 09:15:00'],
    ['jose.ramirez@gmail.com', 'Jose Ramirez', 'pi_live_1002', '2026-08-10 10:02:00'],
    ['ana.reyes@yahoo.com', 'Ana Reyes', 'pi_live_1003', '2026-08-11 11:30:00'],
    ['miguel.torres@outlook.com', 'Miguel Torres', 'pi_live_1004', '2026-08-11 14:45:00'],
    ['lucia.bautista@gmail.com', 'Lucia Bautista', 'pi_live_1005', '2026-08-12 08:20:00'],
    ['carlos.espino@yahoo.com', 'Carlos Espino', 'pi_live_1006', '2026-08-12 09:10:00'],
    ['bea.villamor@gmail.com', 'Bea Villamor', 'pi_live_1007', '2026-08-12 10:05:00'],
    ['renato.silva@outlook.com', 'Renato Silva', 'pi_live_1008', '2026-08-12 11:40:00']
  ];

  const insUser = db.prepare('INSERT INTO users (email, name, password_hash, payment_intent_id, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const [email, name, pi, created] of users) {
    const hash = await bcrypt.hash('TempPass123!', 10);
    insUser.run(email, name, hash, pi, created);
  }

  // Build a webhook payload; pass email/name as null to simulate missing attributes
  const mkPayload = (id, email, name, type) => {
    const attributes = {};
    if (email) attributes.customer_email = email;
    if (name) attributes.customer_name = name;
    attributes.temp_password = 'TempPass123!';
    return JSON.stringify({
      data: { id, type: type || 'payment.paid', attributes }
    });
  };

  const insLog = db.prepare([
    'INSERT INTO failed_creation_logs',
    '(payment_intent_id, raw_payload, error_message, status, attempts, created_at, updated_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  ].join(' '));

  // ===== FAILED (retryable transient) — valid payloads, Retry will succeed =====
  insLog.run('pi_fail_2001', mkPayload('pi_fail_2001', 'andres.villanueva@gmail.com', 'Andres Villanueva'),
    'Database write lock timeout during webhook execution', 'FAILED', 2, '2026-08-12 09:05:00', '2026-08-12 09:06:30');

  insLog.run('pi_fail_2003', mkPayload('pi_fail_2003', 'marco.delacruz@gmail.com', 'Marco Dela Cruz'),
    'Network timeout while waiting for payment gateway response', 'FAILED', 3, '2026-08-12 11:15:00', '2026-08-12 11:16:45');

  insLog.run('pi_fail_2004', mkPayload('pi_fail_2004', 'jenna.ramos@yahoo.com', 'Jenna Ramos'),
    'Temporary database connection reset', 'FAILED', 1, '2026-08-13 08:40:00', '2026-08-13 08:40:20');

  insLog.run('pi_fail_2005', mkPayload('pi_fail_2005', 'vince.ocampo@gmail.com', 'Vince Ocampo'),
    'bcrypt hashing resource exhaustion (server under load)', 'FAILED', 4, '2026-08-13 10:02:00', '2026-08-13 10:04:00');

  // ===== FAILED (unrecoverable) — Retry will keep failing; Mark Refunded is the path =====
  // Chargeback — money contested, admin must resolve
  insLog.run('pi_fail_2002', mkPayload('pi_fail_2002', 'karina.delossantos@gmail.com', 'Karina Delos Santos'),
    'Unrecoverable failure: chargeback detected on payment intent. Admin transition to REFUNDED required.', 'FAILED', 1, '2026-08-12 10:30:00', '2026-08-12 10:30:00');

  // Missing customer email in payload
  insLog.run('pi_fail_2006', mkPayload('pi_fail_2006', null, 'Nathaniel Cruz'),
    'Payload missing required customer attributes (email or name)', 'FAILED', 1, '2026-08-12 14:22:00', '2026-08-12 14:22:10');

  // Missing customer name in payload
  insLog.run('pi_fail_2007', mkPayload('pi_fail_2007', 'trisha.villanueva@gmail.com', null),
    'Payload missing required customer attributes (email or name)', 'FAILED', 2, '2026-08-13 09:10:00', '2026-08-13 09:12:00');

  // Duplicate email — UNIQUE constraint on users.email blocks insertion
  insLog.run('pi_fail_2008', mkPayload('pi_fail_2008', 'maria.santos@gmail.com', 'Maria Santos'),
    'SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: users.email', 'FAILED', 3, '2026-08-13 11:30:00', '2026-08-13 11:32:00');

  // Corrupted payload — raw_payload is not valid JSON, Retry will throw on parse
  insLog.run('pi_fail_2009', '{"data": {"id": "pi_fail_2009", "type": "payment.paid", "attributes": {"customer_email": "gabby.tan@gmail.com"',
    'Malformed payload: raw payload could not be parsed', 'FAILED', 1, '2026-08-13 12:00:00', '2026-08-13 12:00:05');

  // ===== REPROVISIONED - recovered via admin Retry =====
  insLog.run('pi_repro_3001', mkPayload('pi_repro_3001', 'ramon.aquino@gmail.com', 'Ramon Aquino'),
    'Simulated lock timeout during initial webhook execution', 'REPROVISIONED', 2, '2026-08-11 13:00:00', '2026-08-11 13:10:00');

  insLog.run('pi_repro_3002', mkPayload('pi_repro_3002', 'elena.mendoza@yahoo.com', 'Elena Mendoza'),
    'Payload missing required customer attributes', 'REPROVISIONED', 3, '2026-08-12 07:45:00', '2026-08-12 08:00:00');

  // ===== REFUNDED - terminal, money returned =====
  insLog.run('pi_refund_4001', mkPayload('pi_refund_4001', 'paolo.garcia@gmail.com', 'Paolo Garcia'),
    'Payload missing required customer attributes', 'REFUNDED', 3, '2026-08-10 16:20:00', '2026-08-10 17:05:00');

  insLog.run('pi_refund_4002', mkPayload('pi_refund_4002', 'sofia.navarro@outlook.com', 'Sofia Navarro'),
    'Payment refunded after repeated provisioning failures', 'REFUNDED', 5, '2026-08-11 15:50:00', '2026-08-11 16:40:00');

  console.log('users:', db.prepare('SELECT COUNT(*) c FROM users').get().c);
  console.log('failed logs:', db.prepare('SELECT COUNT(*) c FROM failed_creation_logs').get().c);
  console.log('status spread:', JSON.stringify(db.prepare('SELECT status, COUNT(*) c FROM failed_creation_logs GROUP BY status').all()));
  console.log('idempotency:', db.prepare('SELECT COUNT(*) c FROM idempotency_keys').get().c);
  console.log('sessions:', db.prepare('SELECT COUNT(*) c FROM sessions').get().c);
})();