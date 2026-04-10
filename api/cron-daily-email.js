'use strict';

const nodemailer = require('nodemailer');
const { isConfigured } = require('./_shared');
const { buildEmail } = require('./_emailReport');
const { hasKV, getTasks, getMeta, saveMeta } = require('./_taskStore');

function isAuthorizedCron(req) {
  const fromVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const auth = req.headers.authorization || '';
  const hasSecretMatch = cronSecret && auth === `Bearer ${cronSecret}`;
  return fromVercelCron || !!hasSecretMatch;
}

function utcDateKey() {
  return new Date().toISOString().split('T')[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized cron invocation' });
  }

  const smtpUser = isConfigured(process.env.SMTP_USER) ? String(process.env.SMTP_USER).trim() : '';
  const smtpPass = isConfigured(process.env.SMTP_PASS) ? String(process.env.SMTP_PASS).trim() : '';
  if (!smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'SMTP_USER/SMTP_PASS missing' });
  }

  const meta = await getMeta();
  const dateKey = utcDateKey();
  if (meta.lastSentDate === dateKey) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'already_sent_today',
      date: dateKey
    });
  }

  const tasks = await getTasks();
  const recipient = 'dvdgrgsn@gmail.com';
  const subject = `Taskmaster Daily Digest — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const text = buildEmail(tasks);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });

  await transporter.sendMail({
    from: `"TaskMaster" <${smtpUser}>`,
    to: recipient,
    subject: subject.replace(/[\r\n]/g, ''),
    text
  });

  await saveMeta({
    ...meta,
    lastSentDate: dateKey,
    lastSentAt: new Date().toISOString(),
    storage: hasKV() ? 'vercel-kv' : 'memory-fallback',
    lastCount: tasks.length
  });

  return res.status(200).json({
    ok: true,
    sent: true,
    date: dateKey,
    timezone: 'UTC',
    count: tasks.length,
    storage: hasKV() ? 'vercel-kv' : 'memory-fallback'
  });
};
