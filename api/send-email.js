'use strict';

const nodemailer = require('nodemailer');
const { isConfigured, parseJsonBody } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseJsonBody(req);
  const { subject, body: textBody } = body;

  if (!subject || !textBody) {
    return res.status(400).json({ error: 'subject and body are required' });
  }

  const smtpUser = isConfigured(process.env.SMTP_USER) ? String(process.env.SMTP_USER).trim() : '';
  const smtpPass = isConfigured(process.env.SMTP_PASS) ? String(process.env.SMTP_PASS).trim() : '';
  const recipient = 'dvdgrgsn@gmail.com';

  if (!smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'SMTP not configured in Vercel env vars.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"TaskMaster" <${smtpUser}>`,
      to: recipient,
      subject: String(subject).replace(/[\r\n]/g, ''),
      text: String(textBody)
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Email API error]', err.message);
    return res.status(500).json({ error: err.message || 'Email send failed' });
  }
};
