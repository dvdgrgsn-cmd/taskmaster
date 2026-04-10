'use strict';

const { parseJsonBody } = require('./_shared');
const { getTasks, saveTasks, getMeta, saveMeta, getStorageType } = require('./_taskStore');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const tasks = await getTasks();
    const meta = await getMeta();
    return res.status(200).json({
      ok: true,
      tasks,
      count: tasks.length,
      updatedAt: meta.tasksUpdatedAt || null,
      storage: getStorageType()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseJsonBody(req);
  const tasks = Array.isArray(body.tasks) ? body.tasks : null;
  const updatedAt = body.updatedAt || new Date().toISOString();
  if (!tasks) {
    return res.status(400).json({ error: 'tasks must be an array' });
  }

  await saveTasks(tasks);
  const meta = await getMeta();
  await saveMeta({ ...meta, tasksUpdatedAt: updatedAt });
  return res.status(200).json({
    ok: true,
    tasks,
    count: tasks.length,
    updatedAt,
    storage: getStorageType()
  });
};
