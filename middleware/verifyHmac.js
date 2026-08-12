const crypto = require('crypto');

function verifyWebhookHmac(secretKey) {
  return (req, res, next) => {
    const signature = req.headers['x-signature'];

    if (!signature) {
      return res.status(401).json({ error: 'Missing HMAC signature header' });
    }

    if (!req.rawBody) {
      return res.status(500).json({ error: 'Raw body buffer missing on request' });
    }

    const computedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(req.rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const computedBuffer = Buffer.from(computedSignature, 'utf8');

    if (
      signatureBuffer.length !== computedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, computedBuffer)
    ) {
      return res.status(403).json({ error: 'Invalid HMAC signature' });
    }

    next();
  };
}

module.exports = { verifyWebhookHmac };
