const MAX_LENGTHS = Object.freeze({
  EMAIL: 254,
  NAME: 100,
  PAYMENT_INTENT_ID: 64,
  TEMP_PASSWORD: 72,
  USERNAME: 64,
  PASSWORD: 128,
  SEARCH: 100,
  RETURN_TO: 512
});

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function cleanText(value, options = {}) {
  const maxLength = options.maxLength;
  const required = options.required || false;
  const trim = options.trim !== false;

  let s = value == null ? '' : String(value);
  s = s.replace(/[\u0000-\u001F\u007F]/g, '');
  if (trim) s = s.trim();

  if (required && s.length === 0) return null;
  if (maxLength && s.length > maxLength) return null;
  return s;
}

function cleanPassword(value) {
  if (value == null) return '';
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, MAX_LENGTHS.TEMP_PASSWORD);
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= MAX_LENGTHS.EMAIL && EMAIL_RE.test(email);
}

function validateCustomerAttributes({ email, name, temporaryPassword } = {}) {
  if (email == null || String(email).trim() === '') {
    throw new Error('Payload missing required customer attributes (email or name)');
  }
  const cleanEmail = cleanText(email, { maxLength: MAX_LENGTHS.EMAIL });
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    throw new Error('Invalid customer email format in payload');
  }

  if (name == null || String(name).trim() === '') {
    throw new Error('Payload missing required customer attributes (email or name)');
  }
  const cleanName = cleanText(name, { maxLength: MAX_LENGTHS.NAME });
  if (!cleanName) {
    throw new Error('Invalid customer name in payload');
  }

  return {
    email: cleanEmail,
    name: cleanName,
    temporaryPassword: cleanPassword(temporaryPassword)
  };
}

function escapeLike(searchTerm) {
  return String(searchTerm).replace(/[\\%_]/g, (m) => '\\' + m);
}

function safeReturnTo(target) {
  if (typeof target !== 'string' || !target || target.length > MAX_LENGTHS.RETURN_TO) {
    return null;
  }
  if (target[0] !== '/' || target.startsWith('//') || target.includes('\\')) {
    return null;
  }
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  if (decoded[0] !== '/' || decoded.startsWith('//') || decoded.includes('\\')) {
    return null;
  }
  return decoded;
}

module.exports = {
  MAX_LENGTHS,
  cleanText,
  cleanPassword,
  isValidEmail,
  validateCustomerAttributes,
  escapeLike,
  safeReturnTo
};