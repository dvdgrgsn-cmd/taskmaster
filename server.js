'use strict';

require('dotenv').config();
const express = require('express');
const path    = require('path');
const nodemailer = require('nodemailer');

const app  = express();
const DEFAULT_PORT = Number(process.env.PORT || 3002);

function isConfigured(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (v.startsWith('your_')) return false;
  return true;
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: sanitise a string so it can't be used for header injection ────────
function safeHeader(val) {
  return String(val || '').replace(/[\r\n]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai
// Body: { provider: 'claude'|'gpt', messages, systemPrompt, claudeKey?, gptKey? }
// Returns: { text: string }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  const { provider = 'claude', messages, systemPrompt, claudeKey, gptKey } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  try {
    // ── Claude ──────────────────────────────────────────────────────────────
    if (provider === 'claude') {
      const localKey = safeHeader(claudeKey);
      const envKey = isConfigured(process.env.ANTHROPIC_API_KEY) ? process.env.ANTHROPIC_API_KEY : '';
      const apiKey = localKey || envKey;
      if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key not configured. Add ANTHROPIC_API_KEY to .env or enter it in Settings.' });
      }

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model:      process.env.CLAUDE_MODEL || 'claude-opus-4-5',
          max_tokens: 1024,
          system:     systemPrompt || '',
          messages
        })
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return res.status(claudeRes.status).json({ error: errText });
      }

      const data = await claudeRes.json();
      return res.json({ text: data.content.map(b => b.text || '').join('') });
    }

    // ── OpenAI/GPT ──────────────────────────────────────────────────────────
    if (provider === 'gpt') {
      const localKey = safeHeader(gptKey);
      const envKey = isConfigured(process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY : '';
      const apiKey = localKey || envKey;
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env or enter it in Settings.' });
      }

      const gptMessages = [
        { role: 'system', content: systemPrompt || '' },
        ...messages
      ];

      const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model:      process.env.OPENAI_MODEL || 'gpt-4o',
          max_tokens: 1024,
          messages:   gptMessages
        })
      });

      if (!gptRes.ok) {
        const errText = await gptRes.text();
        return res.status(gptRes.status).json({ error: errText });
      }

      const data = await gptRes.json();
      return res.json({ text: data.choices[0].message.content });
    }

    return res.status(400).json({ error: 'Unknown provider. Use "claude" or "gpt".' });

  } catch (err) {
    console.error('[AI proxy error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/send-email
// Body: { subject: string, body: string }
// Sends to hardcoded recipient dvdgrgsn@gmail.com via SMTP configured in .env
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/send-email', async (req, res) => {
  const { subject, body } = req.body;

  if (!subject || !body) {
    return res.status(400).json({ error: 'subject and body are required' });
  }

  const smtpUser = isConfigured(process.env.SMTP_USER) ? process.env.SMTP_USER : '';
  const smtpPass = isConfigured(process.env.SMTP_PASS) ? process.env.SMTP_PASS : '';
  const recipient = 'dvdgrgsn@gmail.com';

  if (!smtpUser || !smtpPass) {
    return res.status(400).json({
      error: 'SMTP not configured. Add SMTP_USER and SMTP_PASS to your .env file.'
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   587,
      secure: false,
      auth:   { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from:    `"TaskMaster" <${smtpUser}>`,
      to:      recipient,
      subject: subject.replace(/[\r\n]/g, ''),   // prevent header injection
      text:    body
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Email error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/status
// Returns which integrations are configured server-side
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({
    claude: isConfigured(process.env.ANTHROPIC_API_KEY),
    gpt:    isConfigured(process.env.OPENAI_API_KEY),
    email:  isConfigured(process.env.SMTP_USER) && isConfigured(process.env.SMTP_PASS)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
function startServer(port, attemptsLeft = 20) {
  const server = app.listen(port, () => {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║         🧠  TASKMASTER  🧠            ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`\n  Running at:  http://localhost:${port}\n`);
    console.log('  Claude API:  ' + (isConfigured(process.env.ANTHROPIC_API_KEY) ? '✅ configured' : '⚠️  not set (add ANTHROPIC_API_KEY to .env)'));
    console.log('  OpenAI API:  ' + (isConfigured(process.env.OPENAI_API_KEY)    ? '✅ configured' : '⚠️  not set (add OPENAI_API_KEY to .env)'));
    console.log('  SMTP Email:  ' + (isConfigured(process.env.SMTP_USER) && isConfigured(process.env.SMTP_PASS) ? '✅ configured' : '⚠️  not set (mailto: fallback will be used)'));
    console.log('\n  Press Ctrl+C to stop.\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy, retrying on ${nextPort}...`);
      startServer(nextPort, attemptsLeft - 1);
      return;
    }
    throw err;
  });
}

startServer(DEFAULT_PORT);
