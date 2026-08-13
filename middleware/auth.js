const crypto = require('crypto');
const session = require('express-session');
const SqliteStoreFactory = require('better-sqlite3-session-store');
const db = require('../config/database');

const SqliteStore = SqliteStoreFactory(session);

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a == null ? '' : a), 'utf8');
  const bufB = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createAdminSession(options = {}) {
  const secret = options.secret || process.env.SESSION_SECRET || 'dev-admin-session-secret';
  const store = new SqliteStore({
    client: db,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 }
  });
  return session({
    name: options.name || 'lilo.admin.sid',
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8
    }
  });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  if (req.xhr || String(req.headers.accept || '').includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const returnTo = encodeURIComponent(req.originalUrl);
  return res.redirect(`/admin/login?returnTo=${returnTo}`);
}

function loginAdmin(req, username, password) {
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return false;
  }

  if (!safeEqual(username, validUsername) || !safeEqual(password, validPassword)) {
    return false;
  }

  req.session.isAdmin = true;
  return true;
}

function logoutAdmin(req, callback) {
  req.session.destroy(callback || function noop() {});
}

module.exports = {
  createAdminSession,
  requireAdmin,
  loginAdmin,
  logoutAdmin
};
