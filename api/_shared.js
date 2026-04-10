'use strict';

function isConfigured(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (v.startsWith('your_')) return false;
  return true;
}

function safeHeader(val) {
  return String(val || '').replace(/[\r\n]/g, '');
}

function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

module.exports = { isConfigured, safeHeader, parseJsonBody };
