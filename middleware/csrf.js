const crypto = require('crypto');

function generateCsrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function tokensMatch(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCsrf(req, res, next) {
  const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
  const sessionToken = req.session && req.session.csrfToken;

  if (!tokensMatch(token, sessionToken)) {
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }

  next();
}

module.exports = { generateCsrf, verifyCsrf };
