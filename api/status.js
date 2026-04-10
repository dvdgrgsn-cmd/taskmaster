'use strict';

const { isConfigured } = require('./_shared');
const { hasPostgres, hasKV } = require('./_taskStore');

module.exports = async function handler(_req, res) {
  const dbReady = hasPostgres();
  const kvReady = hasKV();
  const cloudReady = dbReady || kvReady;
  const smtpReady = isConfigured(process.env.SMTP_USER) && isConfigured(process.env.SMTP_PASS);
  res.status(200).json({
    claude: isConfigured(process.env.ANTHROPIC_API_KEY),
    gpt: isConfigured(process.env.OPENAI_API_KEY),
    email: smtpReady,
    scheduler: cloudReady && smtpReady,
    kv: kvReady,
    db: dbReady,
    cloud: cloudReady
  });
};
