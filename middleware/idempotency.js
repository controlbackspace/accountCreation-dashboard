const idempotencyKeys = require('../models/idempotencyKeys');

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

  const existing = idempotencyKeys.findByEventId(key);

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

  idempotencyKeys.insert({
    eventId: req.idempotency.key,
    eventType,
    paymentIntentId,
    responseStatus: status,
    responsePayload: JSON.stringify(body)
  });
}

module.exports = { trackIdempotency, storeIdempotencyResult, resolveIdempotencyKey };