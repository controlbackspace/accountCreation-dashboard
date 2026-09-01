const emailLogs = require('../models/emailLogs');
const { DEFAULTS } = require('../utils/constants');

const TEMPLATE_TYPES = Object.freeze({
  WELCOME_CREDENTIALS: 'WELCOME_CREDENTIALS',
  PASSWORD_RESET: 'PASSWORD_RESET',
  REFUND_NOTICE: 'REFUND_NOTICE'
});

function buildWelcomeEmail({ email, name, tempPassword }) {
  return {
    subject: 'Your Account Credentials',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d2a3e; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #513761 0%, #6b3091 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 24px;">Welcome to Lilo</h1>
        </div>
        <div style="background: #fff; border: 1px solid #e3dcee; border-top: none; border-radius: 0 0 12px 12px; padding: 32px 24px;">
          <p style="font-size: 16px; margin-top: 0;">Hi ${escapeHtml(name)},</p>
          <p style="font-size: 16px;">Your account has been successfully provisioned. Here are your login credentials:</p>
          <div style="background: #f4f2f7; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;">
            <p style="margin: 8px 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${escapeHtml(tempPassword)}</code></p>
          </div>
          <p style="font-size: 14px; color: #842029; background: #f8d7da; border-radius: 6px; padding: 12px; border: 1px solid #f5c2c7;">
            <strong>Security Notice:</strong> Please log in and change your password immediately after your first login.
          </p>
          <hr style="border: none; border-top: 1px solid #e3dcee; margin: 24px 0;">
          <p style="font-size: 12px; color: #666; margin: 0;">If you didn't create this account, please contact support immediately.</p>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Lilo

Hi ${name},

Your account has been successfully provisioned. Here are your login credentials:

Email: ${email}
Temporary Password: ${tempPassword}

SECURITY NOTICE: Please log in and change your password immediately after your first login.

If you didn't create this account, please contact support immediately.
    `
  };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

async function sendProvisioningCredentials({ email, name, tempPassword }) {
  const emailData = buildWelcomeEmail({ email, name, tempPassword });

  try {
    await simulateEmailTransport(email, emailData);

    emailLogs.insert({
      recipientEmail: email,
      subject: emailData.subject,
      templateType: TEMPLATE_TYPES.WELCOME_CREDENTIALS,
      status: 'SENT',
      errorMessage: null
    });

    return { success: true };
  } catch (error) {
    emailLogs.insert({
      recipientEmail: email,
      subject: emailData.subject,
      templateType: TEMPLATE_TYPES.WELCOME_CREDENTIALS,
      status: 'FAILED',
      errorMessage: error.message
    });
    return { success: false, error: error.message };
  }
}

function simulateEmailTransport(to, emailData) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const shouldFail = process.env.EMAIL_SIMULATE_FAILURE === 'true';
      if (shouldFail) {
        reject(new Error('Simulated SMTP transport failure'));
      } else {
        console.log('[EMAIL SENT] To: ' + to + ' | Subject: ' + emailData.subject + ' | Template: ' + TEMPLATE_TYPES.WELCOME_CREDENTIALS);
        resolve();
      }
    }, 10);
  });
}

module.exports = { sendProvisioningCredentials, TEMPLATE_TYPES };