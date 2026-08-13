Account provisioning microservice and administrative dashboard built to process online payment webhooks and automate user account creation.

**🚀 Quickstart & Setup**
Prerequisites

    Node.js v18.x or higher

    npm v9.x or higher

**Environment Configuration**

Create a .env file in the root directory based on .env.example:
```

PORT=3000
NODE_ENV=development
DB_PATH=./app.db

# Security Secrets (Must be at least 32 characters in production)
WEBHOOK_SECRET=whsec_lilo_development_secret_key_32bytes!
SESSION_SECRET=sess_lilo_development_secret_key_32bytes!

# Admin Credentials (Fail-closed: No hardcoded defaults allowed)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=lilo_secure_pass!

# Webhook Rate Limiting
WEBHOOK_RATE_LIMIT_WINDOW_MS=60000
WEBHOOK_RATE_LIMIT_MAX=60
```
**Run The APP**
```
# Development mode with Nodemon
npm run dev

# Production start
npm start
```
![System Demo](./assets/Demo2.gif)

