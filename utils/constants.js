const LOG_STATUS = Object.freeze({
  FAILED: 'FAILED',
  PROCESSING: 'PROCESSING',
  REPROVISIONED: 'REPROVISIONED',
  REFUNDED: 'REFUNDED'
});

const FAILED_LOG_STATUSES = Object.freeze([
  LOG_STATUS.FAILED,
  LOG_STATUS.PROCESSING,
  LOG_STATUS.REPROVISIONED,
  LOG_STATUS.REFUNDED
]);

const EVENT_TYPES = Object.freeze({
  PROVISION: Object.freeze(new Set([
    'payment.created',
    'payment.pending',
    'payment.paid',
    'payment.succeeded',
    'source.chargeable'
  ])),
  REFUND: Object.freeze(new Set([
    'refund.created',
    'refund.paid',
    'refund.succeeded'
  ])),
  CHARGEBACK: Object.freeze(new Set([
    'chargeback.created',
    'chargeback.updated'
  ]))
});

const DEFAULTS = Object.freeze({
  TEMP_PASSWORD: 'TempPass123!',
  BCRYPT_SALT_ROUNDS: 10
});

module.exports = { LOG_STATUS, FAILED_LOG_STATUSES, EVENT_TYPES, DEFAULTS };