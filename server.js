const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth Middleware
const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const configuredKey = process.env.MAIL_API_KEY;

  if (!configuredKey) {
    console.error('MAIL_API_KEY is not set in environment variables.');
    return res.status(500).json({ ok: false, error: 'Server misconfiguration' });
  }

  if (apiKey !== configuredKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
};

// Health Check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Helper: Sanitize SMTP config for logging (hide password)
const sanitizeSmtpForLog = (smtp) => {
  if (!smtp) return null;
  const { pass, ...rest } = smtp;
  return { ...rest, pass: '******' };
};

// Send Mail Endpoint
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { smtp, mail, idempotencyKey } = req.body;

    // 1. Validation
    if (!smtp || !mail) {
      return res.status(400).json({ ok: false, error: 'Missing smtp or mail configuration in body' });
    }

    if (!smtp.host || !smtp.port) { // Minimal SMTP validation
       return res.status(400).json({ ok: false, error: 'Missing smtp.host or smtp.port' });
    }

    if (!mail.from || !mail.to || !mail.subject) {
        return res.status(400).json({ ok: false, error: 'Missing mail.from, mail.to, or mail.subject' });
    }

    // 2. Allowlist Security Checks
    const hostAllowlist = process.env.SMTP_HOST_ALLOWLIST ? process.env.SMTP_HOST_ALLOWLIST.split(',') : null;
    const portAllowlist = process.env.SMTP_PORT_ALLOWLIST ? process.env.SMTP_PORT_ALLOWLIST.split(',') : null;

    if (hostAllowlist && !hostAllowlist.includes(smtp.host)) {
      return res.status(403).json({ ok: false, error: 'SMTP host not allowed' });
    }
    
    // cast port to string for comparison or int
    if (portAllowlist && !portAllowlist.includes(String(smtp.port))) {
      return res.status(403).json({ ok: false, error: 'SMTP port not allowed' });
    }

    // 3. Create Transport
    const transportConfig = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure !== undefined ? smtp.secure : (smtp.port === 465), // Default secure true for 465 if not specified
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      tls: {
          rejectUnauthorized: smtp.requireTLS !== false // Default to true unless explicitly unchecked in concept
      },
      connectionTimeout: 20000,
      socketTimeout: 30000,
      ...smtp // Allow other smtp overrides if needed but careful with security
    };
    
    // Explicitly delete unwanted overrides just in case
    // (Though spread operator above puts smtp last, we want to ensure our timeouts stick if we wanted to enforce them strictly. 
    // Actually, spreading smtp LAST allows user to override timeouts. 
    // Requirement said: "Timeouts: connectionTimeout 20000, socketTimeout 30000".
    // I will force them by spreading them AFTER smtp.)
    
    const finalTransportConfig = {
        ...smtp, // Base from user
        connectionTimeout: 20000,
        socketTimeout: 30000
    };

    const transporter = nodemailer.createTransport(finalTransportConfig);

    // 4. Send Mail
    // Construct mail object
    const mailOptions = {
      from: mail.from,
      to: mail.to,
      cc: mail.cc,
      bcc: mail.bcc,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
      headers: mail.headers,
    };

    const info = await transporter.sendMail(mailOptions);

    // 5. Response
    // "Réponse: ok/messageId/accepted/rejected/smtpHost/idempotencyKey"
    res.json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      smtpHost: smtp.host,
      idempotencyKey: idempotencyKey || null
    });

  } catch (error) {
    console.error('Send Error:', error.message); 
    // Be careful not to log sensitive info here if error object contains it, 
    // though nodemailer errors usually safe-ish. 
    // Just returning message generally safe.
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
