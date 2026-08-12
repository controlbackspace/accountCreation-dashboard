const REQUIRED_ENV = ['WEBHOOK_SECRET', 'SESSION_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];

const KNOWN_INSECURE_VALUES = new Set([
  'whsec_test_secret_key_123',
  'dev-admin-session-secret',
  'lilo_admin_dev_secret_key_999',
  'change_me_to_a_long_random_string'
]);

const INSECURE_DEFAULTS = {
  WEBHOOK_SECRET: KNOWN_INSECURE_VALUES,
  SESSION_SECRET: KNOWN_INSECURE_VALUES,
  ADMIN_USERNAME: new Set(['admin']),
  ADMIN_PASSWORD: new Set(['admin123'])
};

const MIN_SECRET_LENGTH = 32;

function assertEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const violations = [];

  for (const key of REQUIRED_ENV) {
    const value = process.env[key];

    if (!value || value.trim() === '') {
      violations.push(`MISSING: ${key} is not set`);
      continue;
    }

    if (INSECURE_DEFAULTS[key] && INSECURE_DEFAULTS[key].has(value)) {
      violations.push(`INSECURE DEFAULT: ${key} is using a known dev fallback value`);
    }

    if (isProduction && key !== 'ADMIN_USERNAME' && key !== 'ADMIN_PASSWORD' && value.length < MIN_SECRET_LENGTH) {
      violations.push(`WEAK SECRET: ${key} is shorter than ${MIN_SECRET_LENGTH} characters`);
    }
  }

  if (violations.length === 0) {
    return;
  }

  console.error('[ENV GUARD] Environment assertion failed:');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }

  if (isProduction) {
    console.error('[ENV GUARD] Refusing to boot in production with insecure configuration. Halting startup.');
    process.exit(1);
  }

  console.warn('[ENV GUARD] Non-production environment: continuing, but resolve the above before deploying.');
}

module.exports = { assertEnvironment, REQUIRED_ENV, INSECURE_DEFAULTS };
