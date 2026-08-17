const express = require('express');
const path = require('path');
require('dotenv').config();

const { assertEnvironment } = require('./config/envCheck');
assertEnvironment();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// view engine: ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// keep the raw body BEFORE express.json parses it — HMAC needs the exact bytes
// connect this to verifyHmac middleware
app.use(
  express.json({
    limit: '32kb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// admin forms are urlencoded
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

// static assets
app.use(express.static(path.join(__dirname, 'public')));

const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');

// connect the routes here
app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);

// land people on the dashboard
app.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

// catch any error that escapes above
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]:', err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});

// start server only when run directly (not when imported in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[SERVER RUNNING]: Listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
