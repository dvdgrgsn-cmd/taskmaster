'use strict';

const { isConfigured, safeHeader, parseJsonBody } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseJsonBody(req);
  const { provider = 'claude', messages, systemPrompt, claudeKey, gptKey } = body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  try {
    if (provider === 'claude') {
      const localKey = safeHeader(claudeKey);
      const envKey = isConfigured(process.env.ANTHROPIC_API_KEY) ? String(process.env.ANTHROPIC_API_KEY).trim() : '';
      const apiKey = localKey || envKey;

      if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key not configured. Add ANTHROPIC_API_KEY in Vercel env or app settings.' });
      }

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: String(process.env.CLAUDE_MODEL || 'claude-opus-4-5').trim(),
          max_tokens: 1024,
          system: systemPrompt || '',
          messages
        })
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return res.status(claudeRes.status).json({ error: errText });
      }

      const data = await claudeRes.json();
      return res.status(200).json({ text: data.content.map(b => b.text || '').join('') });
    }

    if (provider === 'gpt') {
      const localKey = safeHeader(gptKey);
      const envKey = isConfigured(process.env.OPENAI_API_KEY) ? String(process.env.OPENAI_API_KEY).trim() : '';
      const apiKey = localKey || envKey;

      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY in Vercel env or app settings.' });
      }

      const gptMessages = [{ role: 'system', content: systemPrompt || '' }, ...messages];

      const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: String(process.env.OPENAI_MODEL || 'gpt-4o').trim(),
          max_tokens: 1024,
          messages: gptMessages
        })
      });

      if (!gptRes.ok) {
        const errText = await gptRes.text();
        return res.status(gptRes.status).json({ error: errText });
      }

      const data = await gptRes.json();
      return res.status(200).json({ text: data.choices?.[0]?.message?.content || '' });
    }

    return res.status(400).json({ error: 'Unknown provider. Use "claude" or "gpt".' });
  } catch (err) {
    console.error('[AI API error]', err.message);
    return res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
};
