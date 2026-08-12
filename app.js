const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. View Engine Setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. Raw Body Buffering for HMAC Signature Validation
// Captures the exact unparsed byte buffer into req.rawBody BEFORE express.json parses it
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Form payload parser for Admin EJS POST submissions
app.use(express.urlencoded({ extended: true }));

// 3. Static Asset Serving
app.use(express.static(path.join(__dirname, 'public')));

// 4. Route Imports
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');

// 5. Route Mounting
app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);

// Root entry redirect
app.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

// 6. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]:', err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});

// 7. Server Initialization
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[SERVER RUNNING]: Listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
