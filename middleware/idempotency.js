const db = require('../config/database');

function resolveIdempotencyKey(req, payload) {
  const headerKey = req.get && req.get('Idempotency-Key');
  if (headerKey) {
    return `header:${headerKey}`;
  }

  if (payload && payload.id) {
    return `event:${payload.id}`;
  }

  const data = payload && payload.data;
  if (!data) {
    return null;
  }

  const eventType = data.type;
  const resourceId = data.id;

  if (eventType && resourceId) {
    return `type:${eventType}:${resourceId}`;
  }

  if (resourceId) {
    return `data:${resourceId}`;
  }

  return null;
}

function trackIdempotency(req, res, next) {
  const key = resolveIdempotencyKey(req, req.body);
  if (!key) {
    return next();
  }

  const existing = db
    .prepare('SELECT response_status, response_payload FROM idempotency_keys WHERE event_id = ?')
    .get(key);

  if (!existing) {
    req.idempotency = { key };
    return next();
  }

  try {
    res.status(existing.response_status).json(JSON.parse(existing.response_payload));
  } catch (parseError) {
    res.status(existing.response_status).send(existing.response_payload);
  }
}

function storeIdempotencyResult(req, status, body) {
  if (!req.idempotency) {
    return;
  }

  const payload = req.body || {};
  const data = payload.data || {};
  const eventType = data.type || payload.type || null;
  const paymentIntentId =
    (data.attributes && data.attributes.payment_intent_id) || data.id || payload.id || null;

  db.prepare(`
    INSERT INTO idempotency_keys (event_id, event_type, payment_intent_id, response_status, response_payload)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(event_id) DO NOTHING
  `).run(req.idempotency.key, eventType, paymentIntentId, status, JSON.stringify(body));
}

module.exports = { trackIdempotency, storeIdempotencyResult, resolveIdempotencyKey };
