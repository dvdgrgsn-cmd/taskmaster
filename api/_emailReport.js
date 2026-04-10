'use strict';

function daysUntil(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((dt - t) / 86400000);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function buildEmail(tasks) {
  const PL = { 1:'Critical', 2:'High', 3:'Medium', 4:'Low' };
  const SL = { todo:'To Do', inprogress:'In Progress', blocked:'Blocked', done:'Done' };
  const nowDate = new Date();
  const isoToday = nowDate.toISOString().split('T')[0];

  const list = Array.isArray(tasks) ? tasks : [];
  const active = list.filter(x => x.status !== 'done');
  const overdue = active.filter(x => x.due && x.due < isoToday);
  const top = active
    .filter(x => x.priority <= 2)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (!a.due && b.due) return 1;
      if (a.due && !b.due) return -1;
      return (a.due || '').localeCompare(b.due || '');
    });

  let body = `TASKMASTER — DAILY TASK DIGEST\nGenerated: ${nowDate.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}\n${'─'.repeat(44)}\n\n`;

  if (overdue.length) {
    body += `OVERDUE (${overdue.length})\n${'─'.repeat(22)}\n`;
    overdue.forEach(x => {
      const overdueDays = Math.abs(daysUntil(x.due));
      body += `• ${x.title} (${overdueDays}d overdue)\n`;
      if (x.notes) body += `  ${x.notes}\n`;
    });
    body += '\n';
  }

  if (top.length) {
    body += `CRITICAL + HIGH (${top.length})\n${'─'.repeat(22)}\n`;
    top.forEach(x => {
      body += `• [${PL[x.priority] || 'Medium'}] ${x.title}\n`;
      if (x.due) body += `  Due: ${fmtDate(x.due)}\n`;
      if (x.status && x.status !== 'todo') body += `  Status: ${SL[x.status] || x.status}\n`;
      if (x.category) body += `  Category: ${x.category}\n`;
      if (x.notes) body += `  Notes: ${x.notes}\n`;
      body += '\n';
    });
  } else {
    body += 'No critical/high tasks currently outstanding.\n\n';
  }

  body += `ALL TASKS (${list.length})\n${'─'.repeat(22)}\n`;
  if (!list.length) {
    body += 'No tasks saved yet.\n';
  } else {
    list.forEach((x, i) => {
      body += `${i + 1}. ${x.title} [${SL[x.status] || x.status || 'todo'} | ${PL[x.priority] || 'Medium'}]`;
      if (x.due) body += ` (Due ${fmtDate(x.due)})`;
      body += '\n';
    });
  }

  body += `\n${'─'.repeat(44)}\nDone: ${list.filter(x => x.status === 'done').length} | Remaining: ${list.filter(x => x.status !== 'done').length}\n\nAuto-sent from TASKMASTER`;
  return body;
}

module.exports = { buildEmail };
