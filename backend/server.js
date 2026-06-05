/*
  CEO Office AI Coordinator backend
  Dependency-free Node.js MVP.
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4188);
const DATA_FILE = path.resolve(__dirname, process.env.DATA_FILE || 'data.json');
const PUBLIC_FRONTEND_PATH = path.resolve(__dirname, process.env.PUBLIC_FRONTEND_PATH || '..');
const IRAN_TZ = 'Asia/Tehran';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { settings: { ai: {}, bale: {} }, users: [], groups: [], tasks: [], recurringTasks: [], meetings: [], messages: [], notifications: [], auditLogs: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
  const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  parsed.settings ||= {};
  parsed.settings.ai ||= {};
  parsed.settings.bale ||= {};
  parsed.users ||= [];
  parsed.groups ||= [];
  parsed.tasks ||= [];
  parsed.recurringTasks ||= [];
  parsed.meetings ||= [];
  parsed.messages ||= [];
  parsed.notifications ||= [];
  parsed.auditLogs ||= [];
  return parsed;
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeUser(user) {
  if (!user) return null;
  const copy = clone(user);
  return copy;
}

function getActor(data, req, explicitActorId) {
  const actorId = explicitActorId || req.headers['x-actor-id'] || req.headers['x-user-id'] || data.settings?.bale?.defaultActorId || 'u2';
  return data.users.find((u) => u.id === actorId && u.active !== false) || data.users.find((u) => u.id === 'u2') || data.users[0] || { id: 'system', name: 'سیستم', role: 'system', accessLevel: 'system', groupIds: [] };
}

function isCeo(actor) {
  return actor?.accessLevel === 'ceo' || actor?.role === 'ceo';
}

function isAdmin(actor) {
  return actor?.accessLevel === 'admin' || actor?.role === 'admin';
}

function intersects(a = [], b = []) {
  return a.some((x) => b.includes(x));
}

function canSeeItem(item, actor) {
  if (!actor) return false;
  if (isCeo(actor)) return true;
  if (item.visibility === 'ceo_private') return item.createdBy === actor.id || item.assigneeIds?.includes(actor.id) || item.memberIds?.includes(actor.id);
  if (isAdmin(actor)) return true;
  return item.createdBy === actor.id || item.assigneeIds?.includes(actor.id) || item.memberIds?.includes(actor.id) || intersects(item.groupIds || [], actor.groupIds || []);
}

function canWriteItem(item, actor) {
  if (!actor) return false;
  if (isCeo(actor) || isAdmin(actor)) return true;
  return item.createdBy === actor.id || item.assigneeIds?.includes(actor.id) || item.memberIds?.includes(actor.id);
}

function logAudit(data, actor, action, entityType, entityId, meta = {}) {
  data.auditLogs.push({
    id: makeId('a'),
    actorId: actor?.id || 'system',
    actorName: actor?.name || 'سیستم',
    action,
    entityType,
    entityId,
    meta,
    createdAt: nowIso()
  });
}

function notify(data, userIds, title, body, entityType, entityId) {
  [...new Set(userIds || [])].filter(Boolean).forEach((userId) => {
    data.notifications.push({
      id: makeId('n'),
      userId,
      title,
      body,
      entityType,
      entityId,
      read: false,
      createdAt: nowIso()
    });
  });
}

function sendJson(res, status, value) {
  const payload = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Actor-Id, X-Bale-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  res.end(payload);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Actor-Id, X-Bale-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  res.end(text);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sameDateInTehran(iso, dateOnly) {
  if (!iso || !dateOnly) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: IRAN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d) === dateOnly;
}

function startEndOfWeekTehran(reference = new Date()) {
  // JS day: 0 Sun ... 6 Sat. Iran week: Saturday to Friday.
  const tehran = new Date(reference.toLocaleString('en-US', { timeZone: IRAN_TZ }));
  const day = tehran.getDay();
  const diffToSaturday = (day + 1) % 7;
  const start = new Date(tehran);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToSaturday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function inDateRange(iso, start, end) {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= start && d < end;
}

function scopedDataForAI(data, actor) {
  const tasks = data.tasks.filter((task) => canSeeItem(task, actor));
  const recurringTasks = data.recurringTasks.filter((task) => canSeeItem(task, actor));
  const meetings = data.meetings.filter((meeting) => canSeeItem(meeting, actor));
  const { start, end } = startEndOfWeekTehran();
  return {
    actor: sanitizeUser(actor),
    accessLevel: actor.accessLevel || actor.role,
    timezone: IRAN_TZ,
    now: nowIso(),
    weekRange: { start: start.toISOString(), end: end.toISOString() },
    tasks,
    scheduledTasks: tasks.filter((t) => t.type !== 'long_term'),
    longTermTasks: tasks.filter((t) => t.type === 'long_term'),
    tasksThisWeek: tasks.filter((t) => inDateRange(t.dueAt || t.scheduledAt, start, end)),
    recurringTasks,
    meetings,
    meetingsThisWeek: meetings.filter((m) => inDateRange(m.startAt, start, end)),
    users: data.users.map((u) => ({ id: u.id, name: u.name, role: u.role, accessLevel: u.accessLevel, groupIds: u.groupIds })),
    groups: data.groups
  };
}

function aiSettings(data) {
  const saved = data.settings?.ai || {};
  return {
    provider: process.env.AI_PROVIDER || saved.provider || 'disabled',
    model: process.env.AI_MODEL || saved.model || 'gpt-5.4-mini',
    baseUrl: process.env.AI_BASE_URL || saved.baseUrl || 'https://api.openai.com',
    apiKey: process.env.AI_API_KEY || saved.apiKey || '',
    temperature: Number(process.env.AI_TEMPERATURE || saved.temperature || 0.2)
  };
}

function extractOpenAIResponseText(payload) {
  if (!payload) return '';
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (Array.isArray(payload.output)) {
    const parts = [];
    for (const item of payload.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c.text === 'string') parts.push(c.text);
          if (typeof c.output_text === 'string') parts.push(c.output_text);
        }
      }
    }
    return parts.join('\n').trim();
  }
  if (payload.choices?.[0]?.message?.content) return payload.choices[0].message.content;
  return '';
}

async function callAI(data, messages, options = {}) {
  const settings = aiSettings(data);
  if (settings.provider === 'disabled') {
    throw new Error('AI_PROVIDER is disabled. Configure AI_PROVIDER and AI_API_KEY or an offline adapter before using messenger AI responses.');
  }

  if (settings.provider === 'offline') {
    const url = settings.baseUrl || 'http://127.0.0.1:8181/intent';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, schema: options.schema || null, locale: 'fa-IR', timezone: IRAN_TZ })
    });
    if (!res.ok) throw new Error(`Offline AI adapter failed: ${res.status}`);
    const json = await res.json();
    return typeof json === 'string' ? json : JSON.stringify(json);
  }

  if (!settings.apiKey) {
    throw new Error('AI_API_KEY is missing. Messenger general answers must be generated by AI, so a model key or offline adapter is required.');
  }

  if (settings.provider === 'openai-chat-compatible') {
    const url = `${settings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature,
        response_format: options.json ? { type: 'json_object' } : undefined
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AI provider failed: ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
    return extractOpenAIResponseText(json);
  }

  if (settings.provider === 'openai') {
    const url = `${settings.baseUrl.replace(/\/$/, '')}/v1/responses`;
    const input = messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user', content: m.content }));
    const body = {
      model: settings.model,
      input,
      temperature: settings.temperature
    };
    if (options.json) {
      body.text = { format: { type: 'json_object' } };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`OpenAI Responses API failed: ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
    return extractOpenAIResponseText(json);
  }

  throw new Error(`Unsupported AI_PROVIDER: ${settings.provider}`);
}

function parseJsonFromText(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch (_) {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return null;
}

function normalizeIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(',').map((x) => x.trim()).filter(Boolean);
}

function cleanTaskPayload(body, actor, typeOverride) {
  const now = nowIso();
  return {
    id: body.id || makeId('t'),
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    type: typeOverride || body.type || 'scheduled',
    status: body.status || 'todo',
    priority: body.priority || 'medium',
    scheduledAt: body.scheduledAt || body.dueAt || null,
    dueAt: body.dueAt || body.scheduledAt || null,
    createdBy: body.createdBy || actor.id,
    assigneeIds: normalizeIds(body.assigneeIds || body.assignees),
    groupIds: normalizeIds(body.groupIds || body.groups),
    visibility: body.visibility || 'normal',
    recurringTemplateId: body.recurringTemplateId || null,
    features: body.features || {
      acceptReject: true,
      comments: true,
      attachments: false,
      messengerActions: true
    },
    history: body.history || [],
    createdAt: body.createdAt || now,
    updatedAt: now
  };
}

function transferTaskToLongTerm(data, actor, taskId, source = 'ui') {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found' };
  if (!canWriteItem(task, actor)) return { ok: false, status: 403, error: 'Forbidden' };
  const before = { type: task.type, scheduledAt: task.scheduledAt, dueAt: task.dueAt };
  task.type = 'long_term';
  task.scheduledAt = null;
  task.dueAt = null;
  task.recurrence = null;
  task.updatedAt = nowIso();
  task.history ||= [];
  task.history.push({ at: nowIso(), actorId: actor.id, action: 'transfer_to_long_term', before, source });
  logAudit(data, actor, 'transfer_to_long_term', 'task', task.id, { source, before });
  notify(data, task.assigneeIds, 'انتقال به وظایف بلندمدت', `وظیفه «${task.title}» بدون زمان‌بندی به بخش بلندمدت منتقل شد.`, 'task', task.id);
  return { ok: true, task };
}

function recurrenceNextRun(template, from = new Date()) {
  const baseDate = template.nextRunAt ? new Date(template.nextRunAt) : new Date(`${template.startDate || new Date().toISOString().slice(0, 10)}T${template.time || '09:00'}:00+03:30`);
  let next = new Date(baseDate);
  const interval = Math.max(1, Number(template.interval || 1));
  if (template.cycle === 'daily') {
    next.setDate(next.getDate() + interval);
  } else if (template.cycle === 'weekly') {
    const days = Array.isArray(template.daysOfWeek) && template.daysOfWeek.length ? template.daysOfWeek.map(Number).sort((a, b) => a - b) : [next.getDay()];
    const currentDay = next.getDay();
    let offset = days.find((day) => day > currentDay);
    if (offset == null) {
      offset = days[0] + 7 * interval;
    }
    next.setDate(next.getDate() + (offset - currentDay));
  } else if (template.cycle === 'monthly') {
    next.setMonth(next.getMonth() + interval);
    if (template.dayOfMonth) next.setDate(Math.min(Number(template.dayOfMonth), 28));
  } else {
    next.setDate(next.getDate() + interval);
  }
  if (template.endDate && next > new Date(`${template.endDate}T23:59:59+03:30`)) return null;
  return next.toISOString();
}

function createTaskFromRecurring(data, actor, templateId) {
  const template = data.recurringTasks.find((r) => r.id === templateId);
  if (!template) return { ok: false, status: 404, error: 'Recurring task not found' };
  if (!canWriteItem(template, actor)) return { ok: false, status: 403, error: 'Forbidden' };
  const runAt = template.nextRunAt || new Date(`${template.startDate || new Date().toISOString().slice(0, 10)}T${template.time || '09:00'}:00+03:30`).toISOString();
  const task = cleanTaskPayload({
    title: template.title,
    description: `${template.description || ''}\n\nایجادشده از چرخه تکرارشونده: ${template.cycle}`.trim(),
    type: 'scheduled',
    status: 'todo',
    priority: template.priority || 'medium',
    scheduledAt: runAt,
    dueAt: runAt,
    createdBy: actor.id,
    assigneeIds: template.assigneeIds,
    groupIds: template.groupIds,
    visibility: template.visibility,
    recurringTemplateId: template.id
  }, actor);
  data.tasks.push(task);
  template.lastGeneratedTaskId = task.id;
  template.nextRunAt = recurrenceNextRun(template, new Date(runAt));
  template.updatedAt = nowIso();
  logAudit(data, actor, 'generate_recurring_task_instance', 'recurringTask', template.id, { taskId: task.id });
  notify(data, task.assigneeIds, 'وظیفه تکرارشونده جدید', `وظیفه «${task.title}» از الگوی تکرارشونده ایجاد شد.`, 'task', task.id);
  return { ok: true, task, recurringTask: template };
}

async function inferMessengerIntentWithAI(data, actor, text) {
  const scoped = scopedDataForAI(data, actor);
  const system = [
    'You are the AI brain behind CEOOfficeAI messenger.',
    'Language: Persian by default, concise and helpful, RTL-friendly.',
    'You MUST use only the scoped JSON data supplied to you. The user may only see data allowed by accessLevel.',
    'For general messages such as existing tasks, this week tasks, specific date tasks/meetings, summarize based on scoped data.',
    'For executable actions, return a JSON object only. Do not include markdown.',
    'Schema: {"responseText":"AI generated Persian response","action":"none|list_tasks|list_week_tasks|list_date|create_task|create_recurring_task|transfer_task_to_long_term|mark_task_done","params":{}}.',
    'Use action none for pure questions or when no write action is needed.',
    'For transfer, params may include taskId or titleQuery. For date queries use params.date as YYYY-MM-DD Gregorian if possible.',
    'Never invent hidden data; if data is absent, say it is not visible or not found.'
  ].join('\n');
  const user = `User message:\n${text}\n\nScoped JSON data:\n${JSON.stringify(scoped).slice(0, 45000)}`;
  const raw = await callAI(data, [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], { json: true });
  const parsed = parseJsonFromText(raw);
  if (!parsed) {
    return { responseText: raw, action: 'none', params: {} };
  }
  return {
    responseText: parsed.responseText || '',
    action: parsed.action || 'none',
    params: parsed.params || {}
  };
}

function findTaskForAction(data, actor, params = {}) {
  const visible = data.tasks.filter((t) => canSeeItem(t, actor));
  if (params.taskId) return visible.find((t) => t.id === params.taskId);
  const q = String(params.titleQuery || params.title || '').trim().toLowerCase();
  if (!q) return null;
  return visible.find((t) => t.title.toLowerCase().includes(q)) || visible.find((t) => q.includes(t.title.toLowerCase()));
}

function executeAIAction(data, actor, action, params = {}) {
  if (!action || action === 'none') return { executed: false, result: null };

  if (action === 'transfer_task_to_long_term') {
    const task = findTaskForAction(data, actor, params);
    if (!task) return { executed: false, error: 'وظیفه موردنظر برای انتقال پیدا نشد.' };
    const result = transferTaskToLongTerm(data, actor, task.id, 'messenger_ai');
    if (!result.ok) return { executed: false, error: result.error };
    return { executed: true, result: { task: result.task } };
  }

  if (action === 'mark_task_done') {
    const task = findTaskForAction(data, actor, params);
    if (!task) return { executed: false, error: 'وظیفه موردنظر برای تکمیل پیدا نشد.' };
    if (!canWriteItem(task, actor)) return { executed: false, error: 'دسترسی تغییر این وظیفه را ندارید.' };
    task.status = 'done';
    task.updatedAt = nowIso();
    task.history ||= [];
    task.history.push({ at: nowIso(), actorId: actor.id, action: 'done', source: 'messenger_ai' });
    logAudit(data, actor, 'mark_task_done', 'task', task.id, { source: 'messenger_ai' });
    return { executed: true, result: { task } };
  }

  if (action === 'create_task') {
    const task = cleanTaskPayload({
      title: params.title,
      description: params.description || '',
      type: params.type || 'scheduled',
      priority: params.priority || 'medium',
      scheduledAt: params.scheduledAt || params.dueAt || null,
      dueAt: params.dueAt || params.scheduledAt || null,
      assigneeIds: params.assigneeIds || [],
      groupIds: params.groupIds || [],
      visibility: params.visibility || 'normal'
    }, actor, params.type || 'scheduled');
    if (!task.title) return { executed: false, error: 'عنوان وظیفه مشخص نیست.' };
    if (task.type === 'long_term') {
      task.scheduledAt = null;
      task.dueAt = null;
    }
    data.tasks.push(task);
    logAudit(data, actor, 'create_task', 'task', task.id, { source: 'messenger_ai' });
    notify(data, task.assigneeIds, 'وظیفه جدید', `وظیفه «${task.title}» برای شما ایجاد شد.`, 'task', task.id);
    return { executed: true, result: { task } };
  }

  if (action === 'create_recurring_task') {
    const template = {
      id: makeId('r'),
      title: String(params.title || '').trim(),
      description: String(params.description || '').trim(),
      status: 'active',
      priority: params.priority || 'medium',
      cycle: params.cycle || 'weekly',
      interval: Math.max(1, Number(params.interval || 1)),
      daysOfWeek: Array.isArray(params.daysOfWeek) ? params.daysOfWeek.map(Number) : [],
      dayOfMonth: params.dayOfMonth || null,
      startDate: params.startDate || new Date().toISOString().slice(0, 10),
      endDate: params.endDate || null,
      time: params.time || '09:00',
      nextRunAt: params.nextRunAt || new Date(`${params.startDate || new Date().toISOString().slice(0, 10)}T${params.time || '09:00'}:00+03:30`).toISOString(),
      createdBy: actor.id,
      assigneeIds: normalizeIds(params.assigneeIds || []),
      groupIds: normalizeIds(params.groupIds || []),
      visibility: params.visibility || 'normal',
      lastGeneratedTaskId: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!template.title) return { executed: false, error: 'عنوان وظیفه تکرارشونده مشخص نیست.' };
    data.recurringTasks.push(template);
    logAudit(data, actor, 'create_recurring_task', 'recurringTask', template.id, { source: 'messenger_ai' });
    return { executed: true, result: { recurringTask: template } };
  }

  return { executed: false, result: null };
}

async function finalAIResponseAfterAction(data, actor, originalText, intent, execution) {
  const scoped = scopedDataForAI(data, actor);
  const system = [
    'You are the AI behind CEOOfficeAI messenger.',
    'Write the final answer in Persian unless user wrote English.',
    'Your answer must be based only on scoped data and action result. Do not reveal data outside access scope.',
    'Be concise. For date/task lists, use readable bullets. Do not output code.'
  ].join('\n');
  const prompt = {
    originalText,
    aiIntent: intent,
    execution,
    scopedData: scoped
  };
  return callAI(data, [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(prompt).slice(0, 45000) }
  ], { json: false });
}

async function processMessengerMessage(data, actor, text, channel = 'web') {
  const inbound = {
    id: makeId('msg'),
    channel,
    direction: 'inbound',
    actorId: actor.id,
    text,
    createdAt: nowIso()
  };
  data.messages.push(inbound);

  let replyText;
  let intent;
  let execution = { executed: false };
  try {
    intent = await inferMessengerIntentWithAI(data, actor, text);
    execution = executeAIAction(data, actor, intent.action, intent.params);
    if (execution.executed) {
      replyText = await finalAIResponseAfterAction(data, actor, text, intent, execution);
    } else if (execution.error) {
      replyText = await finalAIResponseAfterAction(data, actor, text, intent, execution);
    } else {
      replyText = intent.responseText || await finalAIResponseAfterAction(data, actor, text, intent, execution);
    }
  } catch (err) {
    replyText = `هوش مصنوعی پیام‌رسان هنوز پیکربندی نشده یا در دسترس نیست: ${err.message}`;
    intent = { action: 'none', params: {}, error: err.message };
  }

  const outbound = {
    id: makeId('msg'),
    channel,
    direction: 'outbound',
    actorId: actor.id,
    text: replyText,
    ai: {
      provider: aiSettings(data).provider,
      model: aiSettings(data).model,
      intent
    },
    createdAt: nowIso()
  };
  data.messages.push(outbound);
  logAudit(data, actor, 'messenger_message', 'message', inbound.id, { channel, intent: intent?.action || 'none', executed: execution.executed || false });
  return { replyText, intent, execution, inbound, outbound };
}

function normalizeBaleIncoming(body) {
  const message = body.message || body.edited_message || body.data?.message || body;
  const chatId = message.chat?.id || message.chat_id || body.chat_id || body.user_id || '';
  const text = message.text || message.caption || body.text || '';
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || message.from?.username || '';
  return { chatId: String(chatId || ''), text: String(text || '').trim(), senderName, raw: body };
}

function actorFromBale(data, chatId) {
  const found = data.users.find((u) => String(u.messengerIds?.bale || '') === String(chatId));
  return found || data.users.find((u) => u.id === data.settings?.bale?.defaultActorId) || data.users[0];
}

async function sendBaleMessage(data, chatId, text) {
  const settings = data.settings?.bale || {};
  const enabled = String(process.env.BALE_SEND_REPLIES || settings.sendReplies || 'false') === 'true';
  const token = process.env.BALE_BOT_TOKEN || settings.botToken || '';
  const base = process.env.BALE_API_BASE_URL || settings.apiBaseUrl || 'https://tapi.bale.ai/bot';
  if (!enabled || !token || !chatId) return { sent: false, reason: 'Bale sending disabled or missing token/chatId' };
  const url = `${base.replace(/\/$/, '')}${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const payload = await res.text();
  return { sent: res.ok, status: res.status, payload: payload.slice(0, 500) };
}

function updateTaskAssignment(data, actor, body) {
  const task = data.tasks.find((t) => t.id === body.taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found' };
  if (!canWriteItem(task, actor)) return { ok: false, status: 403, error: 'Forbidden' };
  const action = body.action;
  if (action === 'accept') task.status = 'accepted';
  if (action === 'reject') task.status = 'rejected';
  if (action === 'done') task.status = 'done';
  if (action === 'todo') task.status = 'todo';
  task.updatedAt = nowIso();
  task.history ||= [];
  task.history.push({ at: nowIso(), actorId: actor.id, action, note: body.note || '' });
  logAudit(data, actor, `task_${action}`, 'task', task.id, { note: body.note || '' });
  return { ok: true, task };
}

async function routeApi(req, res, url) {
  const data = readData();
  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
  const actor = getActor(data, req, body.actorId);
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, now: nowIso(), aiProvider: aiSettings(data).provider, aiModel: aiSettings(data).model });
  }

  if (url.pathname === '/api/settings/ai') {
    if (req.method === 'GET') return sendJson(res, 200, { ...data.settings.ai, providerEffective: aiSettings(data).provider, modelEffective: aiSettings(data).model });
    if (req.method === 'PUT') {
      data.settings.ai = { ...data.settings.ai, ...body, apiKey: body.apiKey ? body.apiKey : data.settings.ai.apiKey, updatedAt: nowIso() };
      writeData(data);
      return sendJson(res, 200, data.settings.ai);
    }
  }

  if (url.pathname === '/api/settings/bale') {
    if (req.method === 'GET') return sendJson(res, 200, { ...data.settings.bale, botToken: data.settings.bale.botToken ? '***' : '' });
    if (req.method === 'PUT') {
      data.settings.bale = { ...data.settings.bale, ...body, botToken: body.botToken ? body.botToken : data.settings.bale.botToken, updatedAt: nowIso() };
      writeData(data);
      return sendJson(res, 200, { ...data.settings.bale, botToken: data.settings.bale.botToken ? '***' : '' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/webhooks/bale') {
    const secret = data.settings?.bale?.webhookSecret || process.env.BALE_WEBHOOK_SECRET || '';
    if (secret && req.headers['x-bale-secret'] !== secret) return sendJson(res, 401, { ok: false, error: 'Invalid Bale secret' });
    const incoming = normalizeBaleIncoming(body);
    if (!incoming.text) return sendJson(res, 200, { ok: true, ignored: true, reason: 'No text' });
    const baleActor = actorFromBale(data, incoming.chatId);
    const result = await processMessengerMessage(data, baleActor, incoming.text, 'bale');
    result.baleSend = await sendBaleMessage(data, incoming.chatId, result.replyText).catch((err) => ({ sent: false, error: err.message }));
    writeData(data);
    return sendJson(res, 200, { ok: true, replyText: result.replyText, baleSend: result.baleSend });
  }

  if (req.method === 'POST' && url.pathname === '/api/messages/ask') {
    if (!body.text) return sendJson(res, 400, { ok: false, error: 'text is required' });
    const result = await processMessengerMessage(data, actor, String(body.text), body.channel || 'web');
    writeData(data);
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (req.method === 'POST' && url.pathname === '/api/messages/parse') {
    if (!body.text) return sendJson(res, 400, { ok: false, error: 'text is required' });
    try {
      const intent = await inferMessengerIntentWithAI(data, actor, String(body.text));
      return sendJson(res, 200, { ok: true, intent });
    } catch (err) {
      return sendJson(res, 503, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/users') {
    return sendJson(res, 200, data.users.map(sanitizeUser));
  }

  if (req.method === 'GET' && url.pathname === '/api/groups') {
    return sendJson(res, 200, data.groups);
  }

  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const type = url.searchParams.get('type');
    const date = url.searchParams.get('date');
    let tasks = data.tasks.filter((t) => canSeeItem(t, actor));
    if (type) tasks = tasks.filter((t) => t.type === type);
    if (date) tasks = tasks.filter((t) => sameDateInTehran(t.dueAt || t.scheduledAt, date));
    return sendJson(res, 200, tasks);
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const task = cleanTaskPayload(body, actor, body.type || 'scheduled');
    if (!task.title) return sendJson(res, 400, { ok: false, error: 'title is required' });
    if (task.type === 'long_term') {
      task.scheduledAt = null;
      task.dueAt = null;
    }
    data.tasks.push(task);
    logAudit(data, actor, 'create_task', 'task', task.id, { source: 'api' });
    notify(data, task.assigneeIds, 'وظیفه جدید', `وظیفه «${task.title}» برای شما ایجاد شد.`, 'task', task.id);
    writeData(data);
    return sendJson(res, 201, task);
  }

  if (parts[0] === 'api' && parts[1] === 'tasks' && parts[2]) {
    const taskId = parts[2];
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return sendJson(res, 404, { ok: false, error: 'Task not found' });
    if (!canWriteItem(task, actor)) return sendJson(res, 403, { ok: false, error: 'Forbidden' });

    if (req.method === 'PATCH' && parts.length === 3) {
      Object.assign(task, body, { id: task.id, updatedAt: nowIso() });
      if (task.type === 'long_term') {
        task.scheduledAt = null;
        task.dueAt = null;
      }
      logAudit(data, actor, 'update_task', 'task', task.id, { source: 'api' });
      writeData(data);
      return sendJson(res, 200, task);
    }

    if (req.method === 'DELETE' && parts.length === 3) {
      data.tasks = data.tasks.filter((t) => t.id !== taskId);
      logAudit(data, actor, 'delete_task', 'task', taskId, { source: 'api' });
      writeData(data);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && parts[3] === 'transfer-to-long-term') {
      const result = transferTaskToLongTerm(data, actor, taskId, 'api');
      if (!result.ok) return sendJson(res, result.status, { ok: false, error: result.error });
      writeData(data);
      return sendJson(res, 200, result.task);
    }
  }

  if (req.method === 'PATCH' && url.pathname === '/api/tasks/assignment') {
    const result = updateTaskAssignment(data, actor, body);
    if (!result.ok) return sendJson(res, result.status, { ok: false, error: result.error });
    writeData(data);
    return sendJson(res, 200, result.task);
  }

  if (req.method === 'GET' && url.pathname === '/api/recurring-tasks') {
    return sendJson(res, 200, data.recurringTasks.filter((r) => canSeeItem(r, actor)));
  }

  if (req.method === 'POST' && url.pathname === '/api/recurring-tasks') {
    const template = {
      id: makeId('r'),
      title: String(body.title || '').trim(),
      description: String(body.description || '').trim(),
      status: body.status || 'active',
      priority: body.priority || 'medium',
      cycle: body.cycle || 'weekly',
      interval: Math.max(1, Number(body.interval || 1)),
      daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek.map(Number) : normalizeIds(body.daysOfWeek).map(Number),
      dayOfMonth: body.dayOfMonth || null,
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      endDate: body.endDate || null,
      time: body.time || '09:00',
      nextRunAt: body.nextRunAt || new Date(`${body.startDate || new Date().toISOString().slice(0, 10)}T${body.time || '09:00'}:00+03:30`).toISOString(),
      createdBy: actor.id,
      assigneeIds: normalizeIds(body.assigneeIds || body.assignees),
      groupIds: normalizeIds(body.groupIds || body.groups),
      visibility: body.visibility || 'normal',
      lastGeneratedTaskId: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!template.title) return sendJson(res, 400, { ok: false, error: 'title is required' });
    data.recurringTasks.push(template);
    logAudit(data, actor, 'create_recurring_task', 'recurringTask', template.id, { source: 'api' });
    writeData(data);
    return sendJson(res, 201, template);
  }

  if (parts[0] === 'api' && parts[1] === 'recurring-tasks' && parts[2]) {
    const template = data.recurringTasks.find((r) => r.id === parts[2]);
    if (!template) return sendJson(res, 404, { ok: false, error: 'Recurring task not found' });
    if (!canWriteItem(template, actor)) return sendJson(res, 403, { ok: false, error: 'Forbidden' });
    if (req.method === 'PATCH' && parts.length === 3) {
      Object.assign(template, body, { id: template.id, updatedAt: nowIso() });
      logAudit(data, actor, 'update_recurring_task', 'recurringTask', template.id, { source: 'api' });
      writeData(data);
      return sendJson(res, 200, template);
    }
    if (req.method === 'POST' && parts[3] === 'generate-next') {
      const result = createTaskFromRecurring(data, actor, template.id);
      if (!result.ok) return sendJson(res, result.status, { ok: false, error: result.error });
      writeData(data);
      return sendJson(res, 200, result);
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/meetings') {
    const date = url.searchParams.get('date');
    let meetings = data.meetings.filter((m) => canSeeItem(m, actor));
    if (date) meetings = meetings.filter((m) => sameDateInTehran(m.startAt, date));
    return sendJson(res, 200, meetings);
  }

  if (req.method === 'POST' && url.pathname === '/api/meetings') {
    const meeting = {
      id: body.id || makeId('m'),
      title: String(body.title || '').trim(),
      description: String(body.description || '').trim(),
      startAt: body.startAt,
      endAt: body.endAt,
      location: body.location || '',
      createdBy: actor.id,
      memberIds: normalizeIds(body.memberIds || body.members),
      groupIds: normalizeIds(body.groupIds || body.groups),
      visibility: body.visibility || 'normal',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!meeting.title || !meeting.startAt) return sendJson(res, 400, { ok: false, error: 'title and startAt are required' });
    data.meetings.push(meeting);
    logAudit(data, actor, 'create_meeting', 'meeting', meeting.id, { source: 'api' });
    notify(data, meeting.memberIds, 'جلسه جدید', `جلسه «${meeting.title}» ثبت شد.`, 'meeting', meeting.id);
    writeData(data);
    return sendJson(res, 201, meeting);
  }

  if (req.method === 'GET' && url.pathname === '/api/notifications') {
    return sendJson(res, 200, data.notifications.filter((n) => n.userId === actor.id || isAdmin(actor) || isCeo(actor)));
  }

  if (req.method === 'GET' && url.pathname === '/api/audit-logs') {
    if (!isAdmin(actor) && !isCeo(actor)) return sendJson(res, 403, { ok: false, error: 'Forbidden' });
    return sendJson(res, 200, data.auditLogs.slice(-200).reverse());
  }

  return sendJson(res, 404, { ok: false, error: 'API route not found' });
}

function serveStatic(req, res, url) {
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === '/') filePath = '/index.html';
  const resolved = path.resolve(PUBLIC_FRONTEND_PATH, `.${filePath}`);
  if (!resolved.startsWith(PUBLIC_FRONTEND_PATH)) return sendText(res, 403, 'Forbidden');
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return sendText(res, 404, 'Not found');
  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(resolved).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await routeApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`CEO Office AI Coordinator backend listening on http://127.0.0.1:${PORT}`);
});
