'use strict';

const { kv } = require('@vercel/kv');
const { Pool } = require('pg');

const TASKS_KEY = 'taskmaster:tasks';
const META_KEY = 'taskmaster:meta';
const PG_ROW_ID = 'global';

function hasPostgres() {
  return !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

function getPgPool() {
  if (!hasPostgres()) return null;
  if (!global.__taskmasterPgPool) {
    global.__taskmasterPgPool = new Pool({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return global.__taskmasterPgPool;
}

async function ensurePgSchema() {
  const pool = getPgPool();
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS taskmaster_state (
      id TEXT PRIMARY KEY,
      tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `INSERT INTO taskmaster_state (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [PG_ROW_ID]
  );
}

function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getStorageType() {
  if (hasPostgres()) return 'postgres';
  if (hasKV()) return 'vercel-kv';
  return 'memory-fallback';
}

function getFallbackStore() {
  if (!global.__taskmasterFallbackStore) {
    global.__taskmasterFallbackStore = { tasks: [], meta: {} };
  }
  return global.__taskmasterFallbackStore;
}

async function getTasks() {
  if (hasPostgres()) {
    await ensurePgSchema();
    const pool = getPgPool();
    const rs = await pool.query(`SELECT tasks FROM taskmaster_state WHERE id = $1`, [PG_ROW_ID]);
    const tasks = rs.rows?.[0]?.tasks;
    return Array.isArray(tasks) ? tasks : [];
  }
  if (hasKV()) {
    const tasks = await kv.get(TASKS_KEY);
    return Array.isArray(tasks) ? tasks : [];
  }
  return getFallbackStore().tasks;
}

async function saveTasks(tasks) {
  const clean = Array.isArray(tasks) ? tasks : [];
  if (hasPostgres()) {
    await ensurePgSchema();
    const pool = getPgPool();
    await pool.query(
      `UPDATE taskmaster_state SET tasks = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(clean), PG_ROW_ID]
    );
    return;
  }
  if (hasKV()) {
    await kv.set(TASKS_KEY, clean);
    return;
  }
  getFallbackStore().tasks = clean;
}

async function getMeta() {
  if (hasPostgres()) {
    await ensurePgSchema();
    const pool = getPgPool();
    const rs = await pool.query(`SELECT meta FROM taskmaster_state WHERE id = $1`, [PG_ROW_ID]);
    const meta = rs.rows?.[0]?.meta;
    return meta && typeof meta === 'object' ? meta : {};
  }
  if (hasKV()) {
    const meta = await kv.get(META_KEY);
    return meta && typeof meta === 'object' ? meta : {};
  }
  return getFallbackStore().meta;
}

async function saveMeta(meta) {
  const clean = meta && typeof meta === 'object' ? meta : {};
  if (hasPostgres()) {
    await ensurePgSchema();
    const pool = getPgPool();
    await pool.query(
      `UPDATE taskmaster_state SET meta = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(clean), PG_ROW_ID]
    );
    return;
  }
  if (hasKV()) {
    await kv.set(META_KEY, clean);
    return;
  }
  getFallbackStore().meta = clean;
}

module.exports = { hasPostgres, hasKV, getStorageType, getTasks, saveTasks, getMeta, saveMeta };
