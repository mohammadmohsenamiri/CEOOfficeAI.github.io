const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4188);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString("hex")}`;

const seed = {
  settings: {
    bale: {
      enabled: false,
      botToken: "",
      webhookUrl: "",
      secret: "",
      defaultReplyMode: "persian-confirmation",
      updatedAt: ""
    },
    ai: {
      mode: "online",
      onlineProvider: "not-configured",
      baseUrl: "",
      apiKey: "",
      model: "",
      offlineModelPath: "",
      fallbackParserEnabled: true,
      updatedAt: ""
    },
    deployment: {
      target: "local",
      publicBaseUrl: "",
      databaseMode: "json-file",
      freeHostingProvider: "render",
      updatedAt: ""
    }
  },
  users: [],
  groups: [
    { id: "g1", title: "مدیریت", type: "management" },
    { id: "g2", title: "دفتر مدیرعامل", type: "office" },
    { id: "g3", title: "فروش", type: "normal" },
    { id: "g4", title: "عملیات", type: "normal" },
    { id: "g-ceo-request", title: "درخواست از مدیرعامل", type: "ceo_request" }
  ],
  tasks: [],
  recurringTasks: [],
  ceoRequests: [],
  meetings: [],
  incomingMessages: [],
  pendingUsers: [],
  authCodes: [],
  notifications: [],
  auditLogs: []
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    writeData(seed);
    return applyEnvironmentSettings(structuredClone(seed));
  }
  return applyEnvironmentSettings(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function cleanPublicUrl(value) {
  return String(value || "").trim().replace(/^\/+(https?:\/\/)/, "$1").replace(/\/$/, "");
}

function cleanWebhookUrl(value) {
  return String(value || "").trim().replace(/^\/+(https?:\/\/)/, "$1");
}

function applyEnvironmentSettings(data) {
  if (!data.settings) data.settings = {};
  if (!data.settings.bale) data.settings.bale = structuredClone(seed.settings.bale);
  if (!data.settings.ai) data.settings.ai = structuredClone(seed.settings.ai);
  if (!data.settings.deployment) data.settings.deployment = structuredClone(seed.settings.deployment);
  data.users = data.users || [];
  data.groups = data.groups || structuredClone(seed.groups);
  data.tasks = data.tasks || [];
  data.recurringTasks = data.recurringTasks || [];
  data.ceoRequests = data.ceoRequests || [];
  data.meetings = data.meetings || [];
  data.incomingMessages = data.incomingMessages || [];
  data.pendingUsers = data.pendingUsers || [];
  data.authCodes = data.authCodes || [];
  data.notifications = data.notifications || [];
  data.auditLogs = data.auditLogs || [];

  const publicBaseUrl = cleanPublicUrl(PUBLIC_BASE_URL);
  const envWebhookUrl = process.env.BALE_WEBHOOK_URL || (publicBaseUrl ? `${publicBaseUrl}/api/webhooks/bale` : "");
  if (process.env.BALE_ENABLED) data.settings.bale.enabled = process.env.BALE_ENABLED === "true";
  if (process.env.BALE_BOT_TOKEN) data.settings.bale.botToken = process.env.BALE_BOT_TOKEN;
  if (envWebhookUrl) data.settings.bale.webhookUrl = cleanWebhookUrl(envWebhookUrl);
  if (process.env.BALE_SECRET) data.settings.bale.secret = process.env.BALE_SECRET;
  if (process.env.BALE_REPLY_MODE) data.settings.bale.defaultReplyMode = process.env.BALE_REPLY_MODE;
  if (publicBaseUrl) data.settings.deployment.publicBaseUrl = publicBaseUrl;
  if (process.env.AI_PROVIDER) data.settings.ai.onlineProvider = process.env.AI_PROVIDER;
  if (process.env.AI_BASE_URL) data.settings.ai.baseUrl = cleanPublicUrl(process.env.AI_BASE_URL);
  if (process.env.AI_MODEL) data.settings.ai.model = process.env.AI_MODEL;
  if (process.env.AI_API_KEY) data.settings.ai.apiKeyConfigured = true;

  const sampleIds = new Set(["u1", "u2", "u3", "u4"]);
  if (process.env.KEEP_SAMPLE_USERS !== "true") {
    data.users = (data.users || []).filter((user) => !sampleIds.has(user.id));
    data.tasks = (data.tasks || []).filter((task) => !sampleIds.has(task.creatorId) && !(task.assignments || []).some((assignment) => sampleIds.has(assignment.userId)));
    data.ceoRequests = (data.ceoRequests || []).filter((request) => !sampleIds.has(request.requesterId) && !sampleIds.has(request.ceoId));
    data.meetings = (data.meetings || []).filter((meeting) => !sampleIds.has(meeting.creatorId) && !(meeting.members || []).some((member) => sampleIds.has(member)));
  }

  const adminBaleChatId = process.env.ADMIN_BALE_CHAT_ID || "";
  const adminBaleUsername = normalizeBaleUsername(process.env.ADMIN_BALE_USERNAME || "");
  const adminFullName = process.env.ADMIN_FULL_NAME || "مدیر سیستم";
  const adminJobTitle = process.env.ADMIN_JOB_TITLE || "ادمین";
  const adminUsername = String(process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const existingAdmin = (data.users || []).find((user) => user.role === "Admin");
  const existingCeo = (data.users || []).find((user) => user.role === "CEO" || user.isCeo);
  if (!existingAdmin) {
    data.users.unshift({
      id: "admin",
      fullName: adminFullName,
      jobTitle: adminJobTitle,
      role: "Admin",
      groups: ["g2"],
      username: adminUsername,
      passwordHash: process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : "",
      telegramChatId: "",
      baleChatId: adminBaleChatId,
      baleUsername: adminBaleUsername,
      baleProfileUrl: adminBaleUsername ? `https://ble.ir/${adminBaleUsername.replace(/^@/, "")}` : "",
      active: true,
      isCeo: false
    });
  } else {
    if (process.env.ADMIN_FULL_NAME) existingAdmin.fullName = adminFullName;
    if (process.env.ADMIN_JOB_TITLE) existingAdmin.jobTitle = adminJobTitle;
    if (adminUsername) existingAdmin.username = adminUsername;
    if (process.env.ADMIN_PASSWORD) existingAdmin.passwordHash = hashPassword(process.env.ADMIN_PASSWORD);
    if (adminBaleChatId) existingAdmin.baleChatId = adminBaleChatId;
    if (adminBaleUsername) {
      existingAdmin.baleUsername = adminBaleUsername;
      existingAdmin.baleProfileUrl = `https://ble.ir/${adminBaleUsername.replace(/^@/, "")}`;
    }
  }
  if (!existingCeo) {
    const ceoBaleUsername = normalizeBaleUsername(process.env.CEO_BALE_USERNAME || "");
    data.users.unshift({
      id: "ceo",
      fullName: process.env.CEO_FULL_NAME || "مدیرعامل",
      jobTitle: process.env.CEO_JOB_TITLE || "مدیرعامل",
      role: "CEO",
      groups: ["g1"],
      username: process.env.CEO_USERNAME || "ceo",
      passwordHash: process.env.CEO_PASSWORD ? hashPassword(process.env.CEO_PASSWORD) : "",
      telegramChatId: "",
      baleChatId: process.env.CEO_BALE_CHAT_ID || "",
      baleUsername: ceoBaleUsername,
      baleProfileUrl: ceoBaleUsername ? `https://ble.ir/${ceoBaleUsername.replace(/^@/, "")}` : "",
      active: true,
      isCeo: true
    });
  } else {
    if (process.env.CEO_USERNAME) existingCeo.username = String(process.env.CEO_USERNAME).trim().toLowerCase();
    if (process.env.CEO_PASSWORD) existingCeo.passwordHash = hashPassword(process.env.CEO_PASSWORD);
  }
  return data;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Actor-Id, X-Bale-Secret"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid JSON")); }
    });
  });
}

function actor(data, req) {
  return data.users.find((user) => user.id === req.headers["x-actor-id"]) || data.users.find((user) => user.role === "Admin");
}

function isPrivileged(user) {
  return user && (user.role === "Admin" || user.role === "CEO");
}

function log(data, actorId, action, entityType, entityId, beforeData, afterData) {
  data.auditLogs.unshift({ id: id("AUD"), actorId, action, entityType, entityId, beforeData, afterData, createdAt: nowIso() });
}

function canViewTask(currentUser, task) {
  if (task.visibility === "ceo_private") {
    return currentUser.role === "CEO" || task.creatorId === currentUser.id || task.assignments.some((a) => a.userId === currentUser.id);
  }
  if (currentUser.role === "Admin") return true;
  if (task.creatorId === currentUser.id) return true;
  if (task.assignments.some((a) => a.userId === currentUser.id)) return true;
  return false;
}

function canViewRecurringTask(currentUser, recurringTask) {
  if (currentUser.role === "Admin") return true;
  if (recurringTask.creatorId === currentUser.id) return true;
  if ((recurringTask.assigneeIds || []).includes(currentUser.id)) return true;
  return false;
}

function canAssignTo(data, currentUser, assigneeIds) {
  const ceo = data.users.find((user) => user.isCeo);
  if (!ceo || !assigneeIds.includes(ceo.id)) return true;
  return false;
}

function buildScopedMessengerData(data, currentUser) {
  const visibleTaskList = data.tasks.filter((task) => canViewTask(currentUser, task));
  const visibleMeetingList = data.meetings.filter((meeting) => currentUser.role === "Admin" || meeting.creatorId === currentUser.id || meeting.members.includes(currentUser.id));
  const visibleRecurringList = data.recurringTasks.filter((item) => canViewRecurringTask(currentUser, item));
  return {
    user: { id: currentUser.id, fullName: currentUser.fullName, role: currentUser.role, groups: currentUser.groups },
    tasks: visibleTaskList.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt,
      longTerm: Boolean(task.longTerm),
      status: task.status,
      assigneeIds: task.assignments.map((assignment) => assignment.userId)
    })),
    meetings: visibleMeetingList.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      members: meeting.members
    })),
    recurringTasks: visibleRecurringList.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      cycle: item.cycle,
      interval: item.interval,
      nextRunAt: item.nextRunAt,
      active: item.active,
      assigneeIds: item.assigneeIds
    }))
  };
}

function aiRuntimeSettings(data) {
  const ai = data.settings.ai || {};
  return {
    provider: process.env.AI_PROVIDER || ai.onlineProvider || "not-configured",
    baseUrl: cleanPublicUrl(process.env.AI_BASE_URL || ai.baseUrl || ""),
    apiKey: process.env.AI_API_KEY || ai.apiKey || "",
    model: process.env.AI_MODEL || ai.model || "gpt-4o-mini"
  };
}

async function askMessengerAI(data, currentUser, text) {
  const settings = aiRuntimeSettings(data);
  const provider = String(settings.provider || "").toLowerCase();
  const isOllama = provider === "ollama" || settings.baseUrl.includes("localhost:11434") || settings.baseUrl.includes("127.0.0.1:11434");
  if ((!settings.apiKey && !isOllama) || !settings.baseUrl || provider === "not-configured" || provider === "disabled") {
    return {
      provider: settings.provider,
      model: settings.model,
      configured: false,
      reply: "هوش مصنوعی پیام‌رسان هنوز پیکربندی نشده است. برای پاسخ‌های عمومی باید AI_PROVIDER و AI_BASE_URL و AI_API_KEY و AI_MODEL در Render تنظیم شوند."
    };
  }
  const scopedData = buildScopedMessengerData(data, currentUser);
  const messages = [
    {
      role: "system",
      content: "تو دستیار فارسی و راست‌چین دفتر مدیرعامل هستی. فقط بر اساس داده‌های مجاز همین کاربر پاسخ بده. اگر داده کافی نیست صریح بگو. پاسخ کوتاه، عملی و فارسی باشد."
    },
    {
      role: "user",
      content: JSON.stringify({ question: text, scopedData }, null, 2)
    }
  ];
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...((settings.apiKey || isOllama) ? { "Authorization": `Bearer ${settings.apiKey || "ollama"}` } : {})
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.2,
      max_tokens: 700
    })
  });
  const raw = await response.text();
  if (!response.ok) {
    return {
      provider: settings.provider,
      model: settings.model,
      configured: true,
      reply: `خطای هوش مصنوعی: ${response.status} ${raw.slice(0, 180)}`
    };
  }
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch {}
  return {
    provider: settings.provider,
    model: settings.model,
    configured: true,
    reply: parsed.choices?.[0]?.message?.content?.trim() || "پاسخ معتبری از هوش مصنوعی دریافت نشد."
  };
}

function nextRecurringRun(sourceDate, cycle, interval, daysOfWeek, dayOfMonth, time) {
  const base = sourceDate ? new Date(sourceDate) : new Date();
  if (Number.isNaN(base.getTime())) base.setTime(Date.now());
  const step = Math.max(1, Number(interval) || 1);
  if (cycle === "weekly" && Array.isArray(daysOfWeek) && daysOfWeek.length) {
    for (let offset = 1; offset <= 14 * step; offset += 1) {
      const candidate = new Date(base);
      candidate.setDate(candidate.getDate() + offset);
      if (daysOfWeek.includes(candidate.getDay())) {
        const [hour, minute] = String(time || "09:00").split(":").map(Number);
        candidate.setHours(hour || 9, minute || 0, 0, 0);
        return candidate.toISOString();
      }
    }
  }
  const next = new Date(base);
  if (cycle === "monthly") {
    next.setMonth(next.getMonth() + step);
    if (dayOfMonth) next.setDate(Math.min(Number(dayOfMonth), 28));
  } else if (cycle === "weekly") {
    next.setDate(next.getDate() + 7 * step);
  } else {
    next.setDate(next.getDate() + step);
  }
  const [hour, minute] = String(time || "09:00").split(":").map(Number);
  next.setHours(hour || 9, minute || 0, 0, 0);
  return next.toISOString();
}

function createTaskFromRecurring(data, recurringTask) {
  const task = {
    id: id("T"),
    title: recurringTask.title,
    description: recurringTask.description,
    creatorId: recurringTask.creatorId,
    groupId: recurringTask.groupId,
    dueAt: recurringTask.nextRunAt || nowIso(),
    priority: recurringTask.priority || "medium",
    longTerm: false,
    visibility: recurringTask.visibility || "group",
    status: "open",
    createdAt: nowIso(),
    recurringTaskId: recurringTask.id,
    assignments: (recurringTask.assigneeIds || []).map((userId) => ({ userId, status: "pending", rejectReason: "", doneAt: "" }))
  };
  data.tasks.unshift(task);
  task.assignments.forEach((assignment) => createNotification(data, assignment.userId, "وظیفه تکرارشونده جدید", task.title, { type: "task", id: task.id }));
  recurringTask.lastGeneratedAt = nowIso();
  recurringTask.nextRunAt = nextRecurringRun(task.dueAt, recurringTask.cycle, recurringTask.interval, recurringTask.daysOfWeek, recurringTask.dayOfMonth, recurringTask.time);
  return task;
}

function normalizeBaleMessage(payload) {
  const message = payload.message || payload;
  const chat = message.chat || {};
  const from = message.from || payload.from || {};
  return {
    source: "bale",
    senderMessengerId: String(chat.id || message.chat_id || payload.chat_id || ""),
    senderUsername: normalizeBaleUsername(chat.username || from.username || message.username || payload.username || ""),
    text: String(message.text || payload.text || ""),
    rawPayload: payload,
    receivedAt: nowIso()
  };
}

function resolveUsersByPersianText(data, text) {
  return data.users
    .filter((user) => user.active && !user.isCeo)
    .filter((user) => text.includes(user.fullName.split(" ")[0]))
    .map((user) => user.id);
}

function parsePersianIntent(data, text) {
  const normalizedText = String(text || "");
  if (/تکرارشونده|تکرار شونده|روزانه|هفتگی|ماهانه/.test(normalizedText)) {
    const assignees = resolveUsersByPersianText(data, normalizedText);
    const cycle = normalizedText.includes("ماهانه") ? "monthly" : normalizedText.includes("هفتگی") ? "weekly" : "daily";
    return { intent: "create_recurring_task", title: normalizedText.slice(0, 90) || "وظیفه تکرارشونده جدید", assignees, cycle, confidence: 0.84, needsConfirmation: false };
  }
  if (/انتقال.*بلندمدت|بلندمدت کن|بدون تاریخ کن/.test(normalizedText)) {
    const visibleTitle = data.tasks.find((item) => item.title && normalizedText.includes(item.title));
    return { intent: "transfer_task_to_long_term", title: normalizedText.slice(0, 90), taskId: visibleTitle?.id || "", confidence: 0.74, needsConfirmation: false };
  }
  if (/نمایش|لیست|گزارش|امروز|فردا|این هفته|جلسات|وظایف|وظیفه‌ها|وظیفه ها/.test(normalizedText)) {
    return { intent: "ask_ai", question: normalizedText, confidence: 0.86, needsConfirmation: false };
  }
  const assignees = resolveUsersByPersianText(data, text);
  const cleaned = text.replace(/برای|بساز|ثبت کن|تا فردا|تا امروز|وظیفه|جلسه/g, "").trim().slice(0, 90);
  if (text.includes("بلندمدت") || text.includes("بلند مدت") || text.includes("بدون تاریخ")) {
    return { intent: "create_long_term_task", title: cleaned || "وظیفه بلندمدت جدید", assignees, confidence: 0.82, needsConfirmation: false };
  }
  if (text.includes("جلسه")) {
    return { intent: "create_meeting", title: cleaned || "جلسه جدید", members: assignees, startText: text.includes("فردا") ? "فردا" : "امروز", confidence: 0.76, needsConfirmation: false };
  }
  if (text.includes("مدیرعامل") || text.includes("بودجه") || text.includes("تایید")) {
    return { intent: "create_ceo_request", title: cleaned || "درخواست از مدیرعامل", confidence: 0.72, needsConfirmation: false };
  }
  if (text.includes("وظیفه") || text.includes("کار")) {
    return { intent: "create_task", title: cleaned || "وظیفه جدید", assignees, dueText: text.includes("فردا") ? "فردا" : "امروز", confidence: 0.81, needsConfirmation: false };
  }
  if (text.includes("وظیفه‌های من") || text.includes("/mytasks")) return { intent: "query_tasks", confidence: 0.93, needsConfirmation: false };
  return { intent: "unknown", confidence: 0.3, needsConfirmation: false, question: "لطفاً مشخص کنید وظیفه، جلسه یا درخواست از مدیرعامل می‌خواهید." };
}

function nextDateFromText(text) {
  const date = new Date();
  if (text.includes("پس‌فردا") || text.includes("پس فردا")) date.setDate(date.getDate() + 2);
  else if (text.includes("فردا")) date.setDate(date.getDate() + 1);
  else if (text.includes("هفته بعد")) date.setDate(date.getDate() + 7);
  date.setHours(9, 0, 0, 0);
  return date;
}

function hasExplicitMeetingTime(text) {
  return /(\d{1,2}:\d{2}|\d{1,2}\s*(صبح|ظهر|عصر|شب)|ساعت\s*\d{1,2})/.test(String(text || ""));
}

function hasExplicitMeetingDay(text) {
  return /(امروز|فردا|پس‌فردا|پس فردا|شنبه|یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنجشنبه|جمعه|\d{1,2}\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند))/.test(String(text || ""));
}

function createTaskEntity(data, currentUser, intent, text, longTerm = false) {
  let assigneeIds = Array.isArray(intent.assignees) && intent.assignees.length ? intent.assignees : [currentUser.id];
  assigneeIds = Array.from(new Set(assigneeIds));
  if (!canAssignTo(data, currentUser, assigneeIds)) throw new Error("تعریف مستقیم وظیفه برای مدیرعامل مجاز نیست. از مسیر درخواست از مدیرعامل استفاده کنید.");
  const ceo = data.users.find((user) => user.isCeo);
  const task = {
    id: id("T"),
    title: intent.title || "وظیفه جدید",
    description: text,
    creatorId: currentUser.id,
    groupId: currentUser.groups?.[0] || "g2",
    dueAt: longTerm ? "" : nextDateFromText(text).toISOString(),
    priority: "medium",
    longTerm,
    visibility: assigneeIds.includes(ceo && ceo.id) ? "ceo_private" : "group",
    status: "open",
    createdAt: nowIso(),
    assignments: assigneeIds.map((userId) => ({ userId, status: "pending", rejectReason: "", doneAt: "" }))
  };
  data.tasks.unshift(task);
  task.assignments.forEach((assignment) => createNotification(data, assignment.userId, longTerm ? "وظیفه بلندمدت جدید" : "وظیفه جدید", task.title, { type: "task", id: task.id }));
  return task;
}

async function executeBaleIntent(data, currentUser, intent, text) {
  if (intent.intent === "create_task") {
    const task = createTaskEntity(data, currentUser, intent, text, false);
    return { created: true, type: "task", id: task.id, reply: `وظیفه ثبت شد: ${task.title}` };
  }
  if (intent.intent === "create_long_term_task") {
    const task = createTaskEntity(data, currentUser, intent, text, true);
    return { created: true, type: "long_term_task", id: task.id, reply: `وظیفه بلندمدت ثبت شد: ${task.title}` };
  }
  if (intent.intent === "create_recurring_task") {
    const assigneeIds = Array.from(new Set((Array.isArray(intent.assignees) && intent.assignees.length) ? intent.assignees : [currentUser.id]));
    if (!canAssignTo(data, currentUser, assigneeIds)) throw new Error("تعریف مستقیم وظیفه برای مدیرعامل مجاز نیست.");
    const recurringTask = {
      id: id("RT"),
      title: intent.title || "وظیفه تکرارشونده جدید",
      description: text,
      creatorId: currentUser.id,
      groupId: currentUser.groups?.[0] || "g2",
      assigneeIds,
      cycle: intent.cycle || "daily",
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      time: "09:00",
      nextRunAt: nextRecurringRun(nowIso(), intent.cycle || "daily", 1, [], null, "09:00"),
      priority: "medium",
      visibility: "group",
      active: true,
      createdAt: nowIso()
    };
    data.recurringTasks.unshift(recurringTask);
    return { created: true, type: "recurring_task", id: recurringTask.id, reply: `وظیفه تکرارشونده ثبت شد: ${recurringTask.title}` };
  }
  if (intent.intent === "transfer_task_to_long_term") {
    const task = data.tasks.find((item) => item.id === intent.taskId || (item.title && text.includes(item.title)));
    if (!task || !canViewTask(currentUser, task)) return { created: false, type: "transfer_task_to_long_term", reply: "وظیفه‌ای برای انتقال پیدا نشد. لطفاً عنوان دقیق وظیفه را در پیام بنویسید." };
    if (currentUser.role !== "Admin" && task.creatorId !== currentUser.id) return { created: false, type: "transfer_task_to_long_term", reply: "فقط سازنده یا ادمین می‌تواند وظیفه را به بلندمدت منتقل کند." };
    task.longTerm = true;
    task.dueAt = "";
    task.updatedAt = nowIso();
    return { created: false, type: "transfer_task_to_long_term", id: task.id, reply: `وظیفه به وظایف بلندمدت منتقل شد: ${task.title}` };
  }
  if (intent.intent === "ask_ai") {
    const ai = await askMessengerAI(data, currentUser, intent.question || text);
    return { created: false, type: "ai_answer", ai: { provider: ai.provider, model: ai.model, configured: ai.configured }, reply: ai.reply };
  }
  if (intent.intent === "create_ceo_request") {
    const ceo = data.users.find((user) => user.isCeo) || data.users.find((user) => user.role === "Admin");
    const request = { id: id("R"), title: intent.title || "درخواست از مدیرعامل", description: text, requesterId: currentUser.id, ceoId: ceo?.id || currentUser.id, status: "pending", decisionReason: "", delegatedTaskId: "", createdAt: nowIso() };
    data.ceoRequests.unshift(request);
    if (ceo) createNotification(data, ceo.id, "درخواست جدید از مدیرعامل", request.title, { type: "ceo_request", id: request.id });
    return { created: true, type: "ceo_request", id: request.id, reply: `درخواست از مدیرعامل ثبت شد: ${request.title}` };
  }
  if (intent.intent === "create_meeting") {
    if (!hasExplicitMeetingTime(text) || !hasExplicitMeetingDay(text)) {
      const ai = await askMessengerAI(data, currentUser, `برای این درخواست جلسه، با توجه به جلسات موجود و دسترسی کاربر، یک زمان مناسب پیشنهاد بده اما چیزی ثبت نکن. اگر زمان یا روز مبهم است، بگو نیاز به تایید مدیرعامل دارد: ${text}`);
      return { created: false, type: "meeting_time_suggestion", ai: { provider: ai.provider, model: ai.model, configured: ai.configured }, reply: `${ai.reply}\n\nبرای ثبت جلسه، مدیرعامل باید زمان پیشنهادی را تایید کند.` };
    }
    const startAt = nextDateFromText(text);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const members = Array.from(new Set([currentUser.id, ...((intent.members && intent.members.length) ? intent.members : [])]));
    const meeting = { id: id("M"), title: intent.title || "جلسه جدید", description: text, startAt: startAt.toISOString(), endAt: endAt.toISOString(), location: "", creatorId: currentUser.id, status: "scheduled", members, createdAt: nowIso() };
    data.meetings.unshift(meeting);
    members.forEach((userId) => createNotification(data, userId, "جلسه جدید", meeting.title, { type: "meeting", id: meeting.id }));
    return { created: true, type: "meeting", id: meeting.id, reply: `جلسه ثبت شد: ${meeting.title}` };
  }
  if (intent.intent === "query_tasks") {
    const tasks = data.tasks.filter((task) => canViewTask(currentUser, task)).slice(0, 8);
    return { created: false, type: "query_tasks", reply: tasks.length ? tasks.map((task) => `- ${task.title}`).join("\n") : "وظیفه‌ای برای شما ثبت نشده است." };
  }
  return { created: false, type: "unknown", reply: intent.question || "پیام دریافت شد، اما دستور قابل ثبت تشخیص داده نشد." };
}

function parseBaleSelfIntroduction(text) {
  const nameMatch = text.match(/نام\s*[:：]\s*([^\n\r]+)/i);
  const jobMatch = text.match(/(?:جایگاه شغلی|سمت|شغل)\s*[:：]\s*([^\n\r]+)/i);
  if (!nameMatch || !jobMatch) return null;
  return {
    fullName: nameMatch[1].trim(),
    jobTitle: jobMatch[1].trim()
  };
}

function normalizeBaleUsername(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return "";
  const withoutUrl = cleaned.replace(/^https?:\/\/ble\.ir\//i, "");
  return withoutUrl.startsWith("@") ? withoutUrl : `@${withoutUrl}`;
}

function findUserForLogin(data, identifier) {
  const raw = String(identifier || "").trim();
  const baleUsername = normalizeBaleUsername(raw);
  return (data.users || []).find((user) => user.active && (
    user.baleUsername === baleUsername ||
    user.fullName === raw ||
    user.baleChatId === raw
  ));
}

function authPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
    role: user.role,
    groups: user.groups || [],
    baleUsername: user.baleUsername || "",
    baleProfileUrl: user.baleProfileUrl || "",
    isCeo: Boolean(user.isCeo)
  };
}

function hashPassword(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

async function sendBaleText(data, chatId, text) {
  const token = data.settings.bale.botToken;
  if (!data.settings.bale.enabled) return { ok: false, skipped: true, reason: "Bale bot is disabled." };
  if (!token) return { ok: false, skipped: true, reason: "Bale bot token is not configured." };
  if (!chatId) return { ok: false, skipped: true, reason: "Bale chat id is missing." };

  const response = await fetch(`https://tapi.bale.ai/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const body = await response.text();
  return { ok: response.ok, status: response.status, body };
}

async function registerBaleWebhook(data) {
  const token = data.settings.bale.botToken;
  const url = data.settings.bale.webhookUrl;
  if (!token) return { ok: false, error: "Bale bot token is not configured." };
  if (!url) return { ok: false, error: "Bale webhook URL is not configured." };

  const postResponse = await fetch(`https://tapi.bale.ai/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  const postBody = await postResponse.text();
  if (postResponse.ok) return { ok: true, method: "POST", status: postResponse.status, body: postBody };

  const getResponse = await fetch(`https://tapi.bale.ai/bot${token}/setWebhook?url=${encodeURIComponent(url)}`);
  const getBody = await getResponse.text();
  return { ok: getResponse.ok, method: "GET", status: getResponse.status, body: getBody, postAttempt: { status: postResponse.status, body: postBody } };
}

function createNotification(data, userId, title, body, relatedEntity) {
  data.notifications.unshift({ id: id("N"), userId, channel: "web", title, body, scheduledAt: nowIso(), sentAt: "", status: "pending", relatedEntity });
}

const routes = {
  "GET /api/health": async ({ data }) => ({ ok: true, product: "CEO Office AI Coordinator", phases: "P0-P6 backend MVP", time: nowIso(), counts: {
    users: data.users.length,
    tasks: data.tasks.length,
    recurringTasks: data.recurringTasks.length,
    meetings: data.meetings.length,
    ceoRequests: data.ceoRequests.length
  }}),

  "GET /api/phase-coverage": async () => ({
    totalPhases: 11,
    coveredAsLocalMvp: ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
    productionComplete: [],
    notes: {
      P0: "Persian/RTL/Jalali foundation is implemented in UI and Persian backend messages.",
      P1: "Local users, groups, roles, audit logs, JSON persistence.",
      P2: "Bale text webhook and normalized messages. Telegram adapter is still a planned equivalent route.",
      P3: "Rule-based parser returns JSON intent. Online AI provider is configurable but not connected.",
      P4: "Task workflow with multi-assignee statuses and notifications.",
      P5: "CEO privacy and direct CEO assignment guard.",
      P6: "Meetings with members and notifications.",
      P7: "Smart notifications and analytics endpoints.",
      P8: "Responsive web dashboard prototype and admin/settings screens.",
      P9: "Free-hosting deployment artifacts and health endpoints.",
      P10: "Offline/internal mode configuration and deployment guide; no real local model bundled."
    }
  }),

  "GET /api/settings/bale": async ({ data }) => {
    const safe = { ...data.settings.bale, botToken: data.settings.bale.botToken ? "********" : "" };
    return safe;
  },

  "GET /api/settings/ai": async ({ data }) => data.settings.ai,

  "PUT /api/settings/ai": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند تنظیمات AI را تغییر دهد." } };
    const before = data.settings.ai;
    data.settings.ai = {
      ...before,
      mode: body.mode === "offline" ? "offline" : "online",
      onlineProvider: String(body.onlineProvider || before.onlineProvider || "not-configured"),
      baseUrl: cleanPublicUrl(body.baseUrl || before.baseUrl || ""),
      apiKey: body.apiKey === "********" ? before.apiKey : String(body.apiKey || before.apiKey || ""),
      model: String(body.model || before.model || ""),
      offlineModelPath: String(body.offlineModelPath || ""),
      fallbackParserEnabled: body.fallbackParserEnabled !== false,
      updatedAt: nowIso()
    };
    log(data, currentUser.id, "update_ai_settings", "settings", "ai", before, data.settings.ai);
    return { saved: true, ai: data.settings.ai };
  },

  "GET /api/settings/deployment": async ({ data }) => data.settings.deployment,

  "PUT /api/settings/deployment": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند تنظیمات استقرار را تغییر دهد." } };
    const before = data.settings.deployment;
    data.settings.deployment = {
      ...before,
      target: String(body.target || "local"),
      publicBaseUrl: String(body.publicBaseUrl || ""),
      databaseMode: String(body.databaseMode || "json-file"),
      freeHostingProvider: String(body.freeHostingProvider || "render"),
      updatedAt: nowIso()
    };
    log(data, currentUser.id, "update_deployment_settings", "settings", "deployment", before, data.settings.deployment);
    return { saved: true, deployment: data.settings.deployment };
  },

  "PUT /api/settings/bale": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند تنظیمات بله را تغییر دهد." } };
    const before = data.settings.bale;
    data.settings.bale = {
      ...before,
      enabled: Boolean(body.enabled),
      botToken: body.botToken === "********" ? before.botToken : String(body.botToken || ""),
      webhookUrl: cleanWebhookUrl(body.webhookUrl),
      secret: body.secret === "********" ? before.secret : String(body.secret || ""),
      defaultReplyMode: String(body.defaultReplyMode || "persian-confirmation"),
      updatedAt: nowIso()
    };
    log(data, currentUser.id, "update_bale_settings", "settings", "bale", before, data.settings.bale);
    return { saved: true, bale: { ...data.settings.bale, botToken: data.settings.bale.botToken ? "********" : "" } };
  },

  "POST /api/settings/bale/register-webhook": async ({ data, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند webhook بله را ثبت کند." } };
    const result = await registerBaleWebhook(data);
    log(data, currentUser.id, "register_bale_webhook", "settings", "bale", null, result);
    return result.ok ? result : { status: 502, body: result };
  },

  "POST /api/settings/bale/test-send": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند ارسال پیام تست بله را انجام دهد." } };
    const chatId = String(body.chatId || currentUser.baleChatId || "");
    const result = await sendBaleText(data, chatId, String(body.text || "پیام تست از سیستم دفتر مدیرعامل"));
    log(data, currentUser.id, "test_bale_send", "settings", "bale", null, result);
    return result.ok ? result : { status: 502, body: result };
  },

  "POST /api/auth/request-code": async ({ data, body }) => {
    const target = findUserForLogin(data, body.identifier);
    if (!target) return { status: 404, body: { error: "کاربر تاییدشده‌ای با این شناسه بله پیدا نشد." } };
    if (!target.baleChatId) return { status: 400, body: { error: "حساب شما هنوز به شناسه فنی بله متصل نیست. ابتدا به بازوی بله پیام بدهید یا از ادمین بخواهید اتصال را تکمیل کند." } };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    data.authCodes = (data.authCodes || []).filter((item) => item.userId !== target.id);
    data.authCodes.push({ id: id("AUTH"), userId: target.id, codeHash: crypto.createHash("sha256").update(code).digest("hex"), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), usedAt: "", createdAt: nowIso() });
    const sendResult = await sendBaleText(data, target.baleChatId, `کد ورود شما به CEO Office AI:\n${code}\n\nاین کد تا ۱۰ دقیقه معتبر است.`);
    return { sent: true, userHint: { fullName: target.fullName, baleUsername: target.baleUsername || "" }, baleSend: sendResult };
  },

  "POST /api/auth/login": async ({ data, body }) => {
    const target = findUserForLogin(data, body.identifier);
    if (!target) return { status: 404, body: { error: "کاربر تاییدشده‌ای با این شناسه پیدا نشد." } };
    const codeHash = crypto.createHash("sha256").update(String(body.code || "").trim()).digest("hex");
    const record = (data.authCodes || []).find((item) => item.userId === target.id && item.codeHash === codeHash && !item.usedAt);
    if (!record) return { status: 401, body: { error: "کد ورود معتبر نیست." } };
    if (new Date(record.expiresAt).getTime() < Date.now()) return { status: 401, body: { error: "کد ورود منقضی شده است." } };
    record.usedAt = nowIso();
    log(data, target.id, "login", "user", target.id, null, { at: record.usedAt });
    return { loggedIn: true, user: authPublicUser(target) };
  },

  "POST /api/auth/login-password": async ({ data, body }) => {
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const target = (data.users || []).find((user) => user.active && String(user.username || "").toLowerCase() === username);
    if (!target || !target.passwordHash || target.passwordHash !== hashPassword(password)) return { status: 401, body: { error: "نام کاربری یا رمز عبور معتبر نیست." } };
    log(data, target.id, "login_password", "user", target.id, null, { at: nowIso() });
    return { loggedIn: true, user: authPublicUser(target) };
  },

  "POST /api/auth/signup": async ({ data, body }) => {
    const fullName = String(body.fullName || "").trim();
    const jobTitle = String(body.jobTitle || "").trim();
    const baleUsername = normalizeBaleUsername(body.baleUsername || "");
    const baleProfileUrl = cleanPublicUrl(body.baleProfileUrl || (baleUsername ? `https://ble.ir/${baleUsername.replace(/^@/, "")}` : ""));
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!fullName || !jobTitle || !baleUsername || !username || !password) return { status: 400, body: { error: "نام، جایگاه شغلی، آیدی بله، نام کاربری و رمز عبور الزامی است." } };
    if ((data.users || []).some((user) => String(user.username || "").toLowerCase() === username)) return { status: 409, body: { error: "این نام کاربری قبلاً ثبت شده است." } };
    if ((data.users || []).some((user) => user.baleUsername === baleUsername)) return { status: 409, body: { error: "این آیدی بله قبلاً به یک حساب تاییدشده متصل شده است." } };
    const existing = (data.pendingUsers || []).find((item) => item.baleUsername === baleUsername && item.status === "pending");
    if (existing) return { saved: true, pending: existing, message: "درخواست شما قبلاً ثبت شده و در انتظار تایید ادمین است." };
    const pending = { id: id("PU"), fullName, jobTitle, username, passwordHash: hashPassword(password), baleChatId: String(body.baleChatId || "").trim(), baleUsername, baleProfileUrl, status: "pending", createdAt: nowIso(), rawText: "signup-form" };
    data.pendingUsers.unshift(pending);
    const admin = data.users.find((user) => user.role === "Admin");
    if (admin) createNotification(data, admin.id, "کاربر جدید در انتظار تایید", pending.fullName, { type: "pending_user", id: pending.id });
    log(data, "anonymous", "signup_pending_user", "pending_user", pending.id, null, pending);
    return { saved: true, pending };
  },

  "GET /api/users": async ({ data }) => data.users.map(({ passwordHash, ...user }) => user),
  "POST /api/users": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند کاربر جدید بسازد." } };
    const user = {
      id: id("U"),
      fullName: String(body.fullName || "").trim(),
      jobTitle: String(body.jobTitle || "").trim(),
      role: body.role || "User",
      groups: [body.groupId || "g2"],
      username: String(body.username || "").trim().toLowerCase(),
      passwordHash: body.password ? hashPassword(body.password) : "",
      telegramChatId: String(body.telegramChatId || "").trim(),
      baleChatId: String(body.baleChatId || "").trim(),
      baleUsername: normalizeBaleUsername(body.baleUsername || ""),
      baleProfileUrl: cleanPublicUrl(body.baleProfileUrl || ""),
      active: body.active !== false,
      isCeo: false
    };
    if (!user.fullName || !user.jobTitle) return { status: 400, body: { error: "نام و جایگاه شغلی الزامی است." } };
    if (user.username && data.users.some((item) => String(item.username || "").toLowerCase() === user.username)) return { status: 409, body: { error: "این نام کاربری قبلاً ثبت شده است." } };
    data.users.push(user);
    log(data, currentUser.id, "create_user", "user", user.id, null, user);
    return { status: 201, body: user };
  },
  "PATCH /api/users": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند کاربر را ویرایش کند." } };
    const target = data.users.find((user) => user.id === body.userId);
    if (!target) return { status: 404, body: { error: "کاربر پیدا نشد." } };
    const before = { ...target };
    const fullName = String(body.fullName || "").trim();
    const jobTitle = String(body.jobTitle || "").trim();
    if (!fullName || !jobTitle) return { status: 400, body: { error: "نام و جایگاه شغلی الزامی است." } };
    target.fullName = fullName;
    target.jobTitle = jobTitle;
    if (!target.isCeo && target.role !== "Admin") target.role = body.role || target.role || "User";
    target.groups = [body.groupId || target.groups?.[0] || "g2"];
    const username = String(body.username || "").trim().toLowerCase();
    if (username && data.users.some((item) => item.id !== target.id && String(item.username || "").toLowerCase() === username)) return { status: 409, body: { error: "این نام کاربری قبلاً ثبت شده است." } };
    target.username = username;
    if (body.password) target.passwordHash = hashPassword(body.password);
    target.telegramChatId = String(body.telegramChatId || "").trim();
    target.baleChatId = String(body.baleChatId || "").trim();
    target.baleUsername = normalizeBaleUsername(body.baleUsername || "");
    target.baleProfileUrl = cleanPublicUrl(body.baleProfileUrl || (target.baleUsername ? `https://ble.ir/${target.baleUsername.replace(/^@/, "")}` : ""));
    log(data, currentUser.id, "update_user", "user", target.id, before, target);
    return { saved: true, user: target };
  },
  "PATCH /api/users/status": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند وضعیت کاربر را تغییر دهد." } };
    const target = data.users.find((user) => user.id === body.userId);
    if (!target) return { status: 404, body: { error: "کاربر پیدا نشد." } };
    if (target.isCeo) return { status: 403, body: { error: "تعلیق مدیرعامل از این مسیر مجاز نیست." } };
    const before = { ...target };
    target.active = body.active === true;
    log(data, currentUser.id, target.active ? "activate_user" : "suspend_user", "user", target.id, before, target);
    return { saved: true, user: target };
  },
  "DELETE /api/users": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند کاربر را حذف کند." } };
    const target = data.users.find((user) => user.id === body.userId);
    if (!target) return { status: 404, body: { error: "کاربر پیدا نشد." } };
    if (target.isCeo) return { status: 403, body: { error: "حذف مدیرعامل مجاز نیست." } };
    data.tasks = (data.tasks || [])
      .map((task) => ({ ...task, assignments: (task.assignments || []).filter((assignment) => assignment.userId !== target.id) }))
      .filter((task) => task.creatorId !== target.id && task.assignments.length);
    data.ceoRequests = (data.ceoRequests || []).filter((request) => request.requesterId !== target.id && request.ceoId !== target.id);
    data.meetings = (data.meetings || [])
      .map((meeting) => ({ ...meeting, members: (meeting.members || []).filter((member) => member !== target.id) }))
      .filter((meeting) => meeting.creatorId !== target.id);
    data.notifications = (data.notifications || []).filter((notification) => notification.userId !== target.id);
    data.users = data.users.filter((user) => user.id !== target.id);
    log(data, currentUser.id, "delete_user", "user", target.id, target, null);
    return { saved: true, mode: "delete" };
  },
  "GET /api/groups": async ({ data }) => data.groups,
  "GET /api/pending-users": async ({ data, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "دسترسی به کاربران در انتظار تایید مجاز نیست." } };
    return data.pendingUsers || [];
  },

  "POST /api/pending-users/approve": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند کاربر جدید را تایید کند." } };
    const pending = (data.pendingUsers || []).find((item) => item.id === body.pendingUserId);
    if (!pending) return { status: 404, body: { error: "درخواست تایید کاربر پیدا نشد." } };
    const groupId = body.groupId || "g2";
    const user = {
      id: id("U"),
      fullName: pending.fullName,
      jobTitle: pending.jobTitle,
      role: body.role || "User",
      groups: [groupId],
      username: pending.username || "",
      passwordHash: pending.passwordHash || "",
      telegramChatId: "",
      baleChatId: pending.baleChatId,
      baleUsername: pending.baleUsername || "",
      baleProfileUrl: pending.baleProfileUrl || "",
      active: true,
      isCeo: false
    };
    data.users.push(user);
    pending.status = "approved";
    pending.approvedAt = nowIso();
    pending.approvedBy = currentUser.id;
    createNotification(data, currentUser.id, "کاربر جدید تایید شد", user.fullName, { type: "user", id: user.id });
    await sendBaleText(data, pending.baleChatId, "حساب شما تایید شد. از این به بعد می‌توانید درخواست‌ها و وظیفه‌ها را از همین گفتگو ارسال کنید.");
    log(data, currentUser.id, "approve_pending_user", "user", user.id, pending, user);
    return { saved: true, user };
  },

  "POST /api/pending-users/reject": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند درخواست کاربر را رد کند." } };
    const pending = (data.pendingUsers || []).find((item) => item.id === body.pendingUserId);
    if (!pending) return { status: 404, body: { error: "درخواست تایید کاربر پیدا نشد." } };
    pending.status = "rejected";
    pending.rejectedAt = nowIso();
    pending.rejectedBy = currentUser.id;
    pending.rejectReason = body.reason || "";
    await sendBaleText(data, pending.baleChatId, "درخواست معرفی شما تایید نشد. لطفاً با مدیر سیستم تماس بگیرید.");
    log(data, currentUser.id, "reject_pending_user", "pending_user", pending.id, null, pending);
    return { saved: true, pending };
  },

  "PATCH /api/users/link-bale": async ({ data, body, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "فقط مدیر سیستم می‌تواند شناسه بله کاربران را ثبت کند." } };
    const target = data.users.find((user) => user.id === body.userId);
    if (!target) return { status: 404, body: { error: "کاربر پیدا نشد." } };
    const before = { ...target };
    target.baleChatId = String(body.baleChatId || "").trim();
    if (body.baleUsername !== undefined) target.baleUsername = normalizeBaleUsername(body.baleUsername);
    log(data, currentUser.id, "link_bale_chat", "user", target.id, before, target);
    return { saved: true, user: { id: target.id, fullName: target.fullName, baleChatId: target.baleChatId, baleUsername: target.baleUsername || "" } };
  },

  "GET /api/tasks": async ({ data, currentUser }) => data.tasks.filter((task) => canViewTask(currentUser, task)),

  "POST /api/tasks": async ({ data, body, currentUser }) => {
    const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
    if (!assigneeIds.length) return { status: 400, body: { error: "حداقل یک مسئول انتخاب کنید." } };
    if (!canAssignTo(data, currentUser, assigneeIds)) return { status: 403, body: { error: "تعریف مستقیم وظیفه برای مدیرعامل مجاز نیست. از مسیر درخواست از مدیرعامل استفاده کنید." } };
    const ceo = data.users.find((user) => user.isCeo);
    const task = {
      id: id("T"),
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      creatorId: currentUser.id,
      groupId: String(body.groupId || currentUser.groups[0]),
      dueAt: body.longTerm ? "" : (body.dueAt || nowIso()),
      priority: body.priority || "medium",
      longTerm: Boolean(body.longTerm),
      visibility: assigneeIds.includes(ceo && ceo.id) ? "ceo_private" : "group",
      status: "open",
      createdAt: nowIso(),
      assignments: assigneeIds.map((userId) => ({ userId, status: "pending", rejectReason: "", doneAt: "" }))
    };
    data.tasks.unshift(task);
    task.assignments.forEach((a) => createNotification(data, a.userId, "وظیفه جدید", task.title, { type: "task", id: task.id }));
    log(data, currentUser.id, "create", "task", task.id, null, task);
    return { status: 201, body: task };
  },

  "DELETE /api/tasks": async ({ data, body, currentUser }) => {
    const task = data.tasks.find((item) => item.id === body.taskId);
    if (!task || !canViewTask(currentUser, task)) return { status: 404, body: { error: "وظیفه پیدا نشد." } };
    if (currentUser.role !== "Admin" && task.creatorId !== currentUser.id) return { status: 403, body: { error: "فقط سازنده یا مدیر سیستم می‌تواند وظیفه را حذف کند." } };
    data.tasks = data.tasks.filter((item) => item.id !== task.id);
    log(data, currentUser.id, "delete", "task", task.id, task, null);
    return { saved: true };
  },

  "PATCH /api/tasks/long-term": async ({ data, body, currentUser }) => {
    const task = data.tasks.find((item) => item.id === body.taskId);
    if (!task || !canViewTask(currentUser, task)) return { status: 404, body: { error: "وظیفه پیدا نشد." } };
    if (currentUser.role !== "Admin" && task.creatorId !== currentUser.id) return { status: 403, body: { error: "فقط سازنده یا ادمین می‌تواند وظیفه را به بلندمدت منتقل کند." } };
    const before = { ...task };
    task.longTerm = true;
    task.dueAt = "";
    task.updatedAt = nowIso();
    log(data, currentUser.id, "transfer_to_long_term", "task", task.id, before, task);
    return { saved: true, task };
  },

  "GET /api/recurring-tasks": async ({ data, currentUser }) => data.recurringTasks.filter((item) => canViewRecurringTask(currentUser, item)),

  "POST /api/recurring-tasks": async ({ data, body, currentUser }) => {
    const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
    if (!assigneeIds.length) return { status: 400, body: { error: "حداقل یک مسئول انتخاب کنید." } };
    if (!canAssignTo(data, currentUser, assigneeIds)) return { status: 403, body: { error: "تعریف مستقیم وظیفه برای مدیرعامل مجاز نیست." } };
    const recurringTask = {
      id: id("RT"),
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      creatorId: currentUser.id,
      groupId: String(body.groupId || currentUser.groups?.[0] || "g2"),
      assigneeIds,
      cycle: ["daily", "weekly", "monthly"].includes(body.cycle) ? body.cycle : "daily",
      interval: Math.max(1, Number(body.interval) || 1),
      daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6) : [],
      dayOfMonth: body.dayOfMonth ? Number(body.dayOfMonth) : null,
      time: String(body.time || "09:00"),
      nextRunAt: nextRecurringRun(body.startAt || nowIso(), body.cycle || "daily", body.interval || 1, body.daysOfWeek || [], body.dayOfMonth, body.time || "09:00"),
      priority: body.priority || "medium",
      visibility: "group",
      active: body.active !== false,
      createdAt: nowIso()
    };
    if (!recurringTask.title) return { status: 400, body: { error: "عنوان وظیفه تکرارشونده الزامی است." } };
    data.recurringTasks.unshift(recurringTask);
    log(data, currentUser.id, "create", "recurring_task", recurringTask.id, null, recurringTask);
    return { status: 201, body: recurringTask };
  },

  "DELETE /api/recurring-tasks": async ({ data, body, currentUser }) => {
    const item = data.recurringTasks.find((task) => task.id === body.recurringTaskId);
    if (!item || !canViewRecurringTask(currentUser, item)) return { status: 404, body: { error: "وظیفه تکرارشونده پیدا نشد." } };
    if (currentUser.role !== "Admin" && item.creatorId !== currentUser.id) return { status: 403, body: { error: "فقط سازنده یا ادمین می‌تواند این چرخه را حذف کند." } };
    data.recurringTasks = data.recurringTasks.filter((task) => task.id !== item.id);
    log(data, currentUser.id, "delete", "recurring_task", item.id, item, null);
    return { saved: true };
  },

  "POST /api/recurring-tasks/generate-next": async ({ data, body, currentUser }) => {
    const item = data.recurringTasks.find((task) => task.id === body.recurringTaskId);
    if (!item || !canViewRecurringTask(currentUser, item)) return { status: 404, body: { error: "وظیفه تکرارشونده پیدا نشد." } };
    const task = createTaskFromRecurring(data, item);
    log(data, currentUser.id, "generate_next", "recurring_task", item.id, null, task);
    return { saved: true, task, recurringTask: item };
  },

  "PATCH /api/tasks/assignment": async ({ data, body, currentUser }) => {
    const task = data.tasks.find((item) => item.id === body.taskId);
    if (!task || !canViewTask(currentUser, task)) return { status: 404, body: { error: "وظیفه پیدا نشد." } };
    const assignment = task.assignments.find((item) => item.userId === currentUser.id);
    if (!assignment) return { status: 403, body: { error: "شما مسئول این وظیفه نیستید." } };
    const before = { ...assignment };
    assignment.status = body.status;
    assignment.rejectReason = body.rejectReason || "";
    assignment.doneAt = body.status === "done" ? nowIso() : "";
    if (task.assignments.every((item) => item.status === "done")) {
      task.status = "done";
      createNotification(data, task.creatorId, "وظیفه تکمیل شد", task.title, { type: "task", id: task.id });
    } else {
      createNotification(data, task.creatorId, "وضعیت وظیفه تغییر کرد", `${currentUser.fullName}: ${body.status}`, { type: "task", id: task.id });
    }
    log(data, currentUser.id, "update_assignment", "task", task.id, before, assignment);
    return { task };
  },

  "GET /api/ceo-requests": async ({ data, currentUser }) => data.ceoRequests.filter((request) => currentUser.role === "CEO" || currentUser.role === "Admin" || request.requesterId === currentUser.id),

  "POST /api/ceo-requests": async ({ data, body, currentUser }) => {
    const ceo = data.users.find((user) => user.isCeo) || data.users.find((user) => user.role === "Admin");
    const request = { id: id("R"), title: String(body.title || ""), description: String(body.description || ""), requesterId: currentUser.id, ceoId: ceo?.id || currentUser.id, status: "pending", decisionReason: "", delegatedTaskId: "", createdAt: nowIso() };
    data.ceoRequests.unshift(request);
    if (ceo) createNotification(data, ceo.id, "درخواست جدید از مدیرعامل", request.title, { type: "ceo_request", id: request.id });
    log(data, currentUser.id, "create", "ceo_request", request.id, null, request);
    return { status: 201, body: request };
  },

  "PATCH /api/ceo-requests/decision": async ({ data, body, currentUser }) => {
    if (currentUser.role !== "CEO") return { status: 403, body: { error: "فقط مدیرعامل می‌تواند درباره درخواست تصمیم بگیرد." } };
    const request = data.ceoRequests.find((item) => item.id === body.requestId);
    if (!request) return { status: 404, body: { error: "درخواست پیدا نشد." } };
    const before = { ...request };
    request.status = body.status;
    request.decisionReason = body.decisionReason || "";
    if (body.status === "delegated" && !request.delegatedTaskId) {
      const task = {
        id: id("T"),
        title: request.title,
        description: request.description,
        creatorId: currentUser.id,
        groupId: currentUser.groups?.[0] || "g2",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        priority: "medium",
        longTerm: false,
        visibility: "group",
        status: "open",
        createdAt: nowIso(),
        assignments: [{ userId: request.requesterId, status: "pending", rejectReason: "", doneAt: "" }]
      };
      data.tasks.unshift(task);
      request.delegatedTaskId = task.id;
      createNotification(data, request.requesterId, "وظیفه جدید از درخواست مدیرعامل", task.title, { type: "task", id: task.id });
    }
    log(data, currentUser.id, "decision", "ceo_request", request.id, before, request);
    return { request };
  },

  "GET /api/meetings": async ({ data, currentUser }) => data.meetings.filter((meeting) => currentUser.role === "Admin" || meeting.creatorId === currentUser.id || meeting.members.includes(currentUser.id)),

  "POST /api/meetings": async ({ data, body, currentUser }) => {
    const members = Array.from(new Set([currentUser.id, ...(Array.isArray(body.members) ? body.members : [])]));
    const meeting = { id: id("M"), title: String(body.title || ""), description: String(body.description || ""), startAt: body.startAt || nowIso(), endAt: body.endAt || body.startAt || nowIso(), location: String(body.location || ""), creatorId: currentUser.id, status: "scheduled", members, createdAt: nowIso() };
    data.meetings.unshift(meeting);
    members.forEach((userId) => createNotification(data, userId, "جلسه جدید", meeting.title, { type: "meeting", id: meeting.id }));
    log(data, currentUser.id, "create", "meeting", meeting.id, null, meeting);
    return { status: 201, body: meeting };
  },

  "PATCH /api/meetings/reschedule": async ({ data, body, currentUser }) => {
    const meeting = data.meetings.find((item) => item.id === body.meetingId);
    if (!meeting) return { status: 404, body: { error: "جلسه پیدا نشد." } };
    if (currentUser.role !== "Admin" && meeting.creatorId !== currentUser.id && !meeting.members.includes(currentUser.id)) {
      return { status: 403, body: { error: "دسترسی تغییر زمان این جلسه را ندارید." } };
    }
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      return { status: 400, body: { error: "زمان شروع یا پایان جلسه معتبر نیست." } };
    }
    const before = { ...meeting };
    meeting.startAt = startAt.toISOString();
    meeting.endAt = endAt.toISOString();
    meeting.members.forEach((userId) => createNotification(data, userId, "زمان جلسه تغییر کرد", meeting.title, { type: "meeting", id: meeting.id }));
    log(data, currentUser.id, "reschedule", "meeting", meeting.id, before, meeting);
    return { saved: true, meeting };
  },

  "POST /api/reminders/bale/run": async ({ data, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "اجرای یادآوری‌ها فقط برای ادمین یا مدیرعامل مجاز است." } };
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const oneHourStart = new Date(now.getTime() + 55 * 60 * 1000);
    const oneHourEnd = new Date(now.getTime() + 65 * 60 * 1000);
    const sent = [];
    for (const user of data.users.filter((item) => item.active && item.baleChatId)) {
      const tomorrowMeetings = data.meetings.filter((meeting) => meeting.members.includes(user.id) && new Date(meeting.startAt) >= tomorrowStart && new Date(meeting.startAt) <= tomorrowEnd);
      if (tomorrowMeetings.length) {
        const text = `برنامه جلسات فردای شما:\n${tomorrowMeetings.map((meeting) => `- ${meeting.title} | ${new Date(meeting.startAt).toLocaleString("fa-IR")}`).join("\n")}`;
        sent.push({ userId: user.id, type: "tomorrow_digest", result: await sendBaleText(data, user.baleChatId, text) });
      }
      const soonMeetings = data.meetings.filter((meeting) => meeting.members.includes(user.id) && new Date(meeting.startAt) >= oneHourStart && new Date(meeting.startAt) <= oneHourEnd);
      for (const meeting of soonMeetings) {
        const ai = await askMessengerAI(data, user, `برای کاربر ${user.fullName} یک یادآوری کوتاه، فارسی و عملیاتی برای جلسه زیر بنویس. فقط متن پیام را بده.\nعنوان: ${meeting.title}\nزمان شروع: ${new Date(meeting.startAt).toLocaleString("fa-IR")}\nمحل/لینک: ${meeting.location || "ثبت نشده"}`);
        const text = ai.configured
          ? ai.reply
          : `یادآوری هوشمند جلسه:\n${meeting.title}\nشروع: ${new Date(meeting.startAt).toLocaleString("fa-IR")}\n${meeting.location ? `محل/لینک: ${meeting.location}` : ""}`;
        sent.push({ userId: user.id, type: "one_hour_reminder", meetingId: meeting.id, result: await sendBaleText(data, user.baleChatId, text) });
      }
    }
    log(data, currentUser.id, "run_bale_meeting_reminders", "meeting", "batch", null, { sent: sent.length });
    return { sent };
  },

  "POST /api/messages/ask": async ({ data, body, currentUser }) => {
    const text = String(body.text || "").trim();
    if (!text) return { status: 400, body: { error: "متن پرسش الزامی است." } };
    const ai = await askMessengerAI(data, currentUser, text);
    const record = {
      id: id("MSG"),
      source: body.source || "web",
      senderMessengerId: currentUser.id,
      text,
      userId: currentUser.id,
      parsedIntent: { intent: "ask_ai" },
      execution: { type: "ai_answer", ai: { provider: ai.provider, model: ai.model, configured: ai.configured }, reply: ai.reply },
      status: "answered",
      receivedAt: nowIso()
    };
    data.incomingMessages.unshift(record);
    log(data, currentUser.id, "ask_ai", "message", record.id, null, record);
    return { reply: ai.reply, ai: { provider: ai.provider, model: ai.model, configured: ai.configured }, messageId: record.id };
  },

  "POST /api/messages/parse": async ({ data, body }) => parsePersianIntent(data, String(body.text || "")),

  "POST /api/webhooks/bale": async ({ data, req, body }) => {
    const configuredSecret = data.settings.bale.secret;
    if (configuredSecret && req.headers["x-bale-secret"] !== configuredSecret) return { status: 401, body: { error: "Bale secret is invalid." } };
    const normalized = normalizeBaleMessage(body);
    const linkedUser = data.users.find((user) => user.baleChatId === normalized.senderMessengerId);
    if (!linkedUser) {
      const existingPendingBeforeIntro = (data.pendingUsers || []).find((item) => item.baleChatId === normalized.senderMessengerId && item.status === "pending");
      if (existingPendingBeforeIntro && !parseBaleSelfIntroduction(normalized.text)) {
        const record = { id: id("MSG"), ...normalized, userId: "", parsedIntent: { intent: "pending_user_waiting", pendingUserId: existingPendingBeforeIntro.id }, status: "pending_user_waiting" };
        data.incomingMessages.unshift(record);
        const reply = "معرفی شما قبلاً ثبت شده است. لطفاً منتظر تایید مدیر سیستم باشید.";
        const sendResult = await sendBaleText(data, normalized.senderMessengerId, reply);
        return { ok: true, messageId: record.id, reply, pendingUser: existingPendingBeforeIntro, baleSend: sendResult };
      }
      const intro = parseBaleSelfIntroduction(normalized.text);
      if (intro) {
        const existingPending = (data.pendingUsers || []).find((item) => item.baleChatId === normalized.senderMessengerId && item.status === "pending");
        const pending = existingPending || {
          id: id("PU"),
          baleChatId: normalized.senderMessengerId,
          baleUsername: normalized.senderUsername || "",
          baleProfileUrl: normalized.senderUsername ? `https://ble.ir/${normalized.senderUsername.replace(/^@/, "")}` : "",
          fullName: intro.fullName,
          jobTitle: intro.jobTitle,
          status: "pending",
          createdAt: nowIso(),
          rawText: normalized.text
        };
        if (!existingPending) data.pendingUsers.unshift(pending);
        const record = { id: id("MSG"), ...normalized, userId: "", parsedIntent: { intent: "self_introduction", pendingUserId: pending.id }, status: "pending_user" };
        data.incomingMessages.unshift(record);
        createNotification(data, data.users.find((user) => user.role === "Admin")?.id || "u2", "کاربر جدید در انتظار تایید", pending.fullName, { type: "pending_user", id: pending.id });
        const reply = `معرفی شما با موفقیت ثبت شد.\n\nنام: ${pending.fullName}\nجایگاه شغلی: ${pending.jobTitle}\n\nلطفاً منتظر تایید ادمین باشید.`;
        const sendResult = await sendBaleText(data, normalized.senderMessengerId, reply);
        log(data, "anonymous", "pending_user_registration", "pending_user", pending.id, null, pending);
        return { ok: true, messageId: record.id, reply, pendingUser: pending, baleSend: sendResult };
      }
    }
    const parsedIntent = normalized.text ? parsePersianIntent(data, normalized.text) : { intent: "unknown", question: "لطفاً متن پیام را ارسال کنید." };
    let execution = null;
    if (linkedUser) {
      try {
        execution = await executeBaleIntent(data, linkedUser, parsedIntent, normalized.text);
      } catch (error) {
        execution = { created: false, type: "error", reply: error.message };
      }
    }
    const record = { id: id("MSG"), ...normalized, userId: linkedUser ? linkedUser.id : "", parsedIntent, execution, status: linkedUser ? "executed" : "unknown_sender" };
    data.incomingMessages.unshift(record);
    log(data, linkedUser ? linkedUser.id : "anonymous", "incoming_bale_message", "message", record.id, null, record);
    const reply = linkedUser ? execution.reply : "معرفی شما ثبت نشد.\n\nلطفاً نام و جایگاه شغلی خود را با قالب زیر ارسال نمایید و منتظر تایید از سوی ادمین باشید.\n\nنام: محمد امیری\nجایگاه شغلی: مدیر پروژه";
    const sendResult = await sendBaleText(data, normalized.senderMessengerId, reply);
    return {
      ok: true,
      messageId: record.id,
      reply,
      parsedIntent,
      baleSend: sendResult
    };
  },

  "GET /api/messages": async ({ data }) => data.incomingMessages,
  "GET /api/notifications": async ({ data, currentUser }) => data.notifications.filter((notification) => currentUser.role === "Admin" || notification.userId === currentUser.id),
  "GET /api/audit-logs": async ({ data, currentUser }) => isPrivileged(currentUser) ? data.auditLogs : { status: 403, body: { error: "دسترسی به لاگ‌ها مجاز نیست." } },

  "GET /api/analytics/overview": async ({ data, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "دسترسی به گزارش مدیریتی مجاز نیست." } };
    const assignments = data.tasks.flatMap((task) => task.assignments.map((assignment) => ({ ...assignment, taskId: task.id, dueAt: task.dueAt })));
    const byUser = data.users.map((user) => {
      const userAssignments = assignments.filter((assignment) => assignment.userId === user.id);
      const done = userAssignments.filter((assignment) => assignment.status === "done").length;
      const rejected = userAssignments.filter((assignment) => assignment.status === "rejected").length;
      const pending = userAssignments.filter((assignment) => assignment.status === "pending").length;
      return {
        userId: user.id,
        fullName: user.fullName,
        role: user.role,
        assigned: userAssignments.length,
        done,
        rejected,
        pending,
        completionRate: userAssignments.length ? Math.round((done / userAssignments.length) * 100) : 0
      };
    });
    return {
      totals: {
        tasks: data.tasks.length,
        doneTasks: data.tasks.filter((task) => task.status === "done").length,
        openTasks: data.tasks.filter((task) => task.status !== "done").length,
        meetings: data.meetings.length,
        ceoRequests: data.ceoRequests.length,
        notifications: data.notifications.length
      },
      byUser
    };
  },

  "GET /api/smart-notifications/suggestions": async ({ data, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "دسترسی به پیشنهادهای هوشمند مجاز نیست." } };
    const now = Date.now();
    const suggestions = [];
    for (const task of data.tasks) {
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null;
      if (task.status !== "done" && due && due < now) {
        suggestions.push({
          id: id("SUG"),
          type: "overdue_task",
          severity: "high",
          title: "وظیفه عقب‌افتاده",
          body: task.title,
          relatedEntity: { type: "task", id: task.id }
        });
      }
      const ageDays = Math.floor((now - new Date(task.createdAt || task.dueAt).getTime()) / 86400000);
      if (task.status !== "done" && ageDays >= 14) {
        suggestions.push({
          id: id("SUG"),
          type: "long_term_candidate",
          severity: "medium",
          title: "پیشنهاد تبدیل به کار بلندمدت",
          body: task.title,
          relatedEntity: { type: "task", id: task.id }
        });
      }
    }
    return { generatedAt: nowIso(), suggestions };
  },

  "POST /api/smart-notifications/run": async ({ data, currentUser }) => {
    if (!isPrivileged(currentUser)) return { status: 403, body: { error: "اجرای قوانین هوشمند مجاز نیست." } };
    const now = Date.now();
    let created = 0;
    for (const task of data.tasks) {
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null;
      if (task.status !== "done" && due && due < now) {
        createNotification(data, task.creatorId, "هشدار وظیفه عقب‌افتاده", task.title, { type: "task", id: task.id });
        created += 1;
      }
    }
    log(data, currentUser.id, "run_smart_notifications", "notification", "batch", null, { created });
    return { created };
  },

  "GET /api/offline/status": async ({ data }) => ({
    mode: data.settings.ai.mode,
    offlineReady: Boolean(data.settings.ai.baseUrl && data.settings.ai.model),
    fallbackParserEnabled: data.settings.ai.fallbackParserEnabled,
    message: data.settings.ai.mode === "offline"
      ? `حالت آفلاین فعال است. مدل پیشنهادی: ${data.settings.ai.model || "qwen3:3b"} روی Ollama.`
      : "حالت فعلی آنلاین/محلی است و parser fallback فعال است."
  })
};

async function handle(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const data = readData();
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const repoIndexPath = path.join(__dirname, "..", "index.html");
    const localOutputPath = path.join(__dirname, "..", "ceo-office-ai-coordinator-mvp.html");
    const htmlPath = fs.existsSync(repoIndexPath) ? repoIndexPath : localOutputPath;
    const html = fs.readFileSync(htmlPath, "utf8").replaceAll("http://127.0.0.1:4188", "");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  const key = `${req.method} ${url.pathname}`;
  const route = routes[key];
  if (!route) return send(res, 404, { error: "Route not found", route: key });

  try {
    const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? await readBody(req) : {};
    const currentUser = actor(data, req);
    const result = await route({ data, body, req, currentUser, url });
    if (req.method !== "GET") writeData(data);
    if (result && typeof result === "object" && "status" in result && "body" in result) return send(res, result.status, result.body);
    return send(res, 200, result);
  } catch (error) {
    return send(res, 500, { error: error.message || "Internal server error" });
  }
}

http.createServer(handle).listen(PORT, HOST, () => {
  console.log(`CEO Office backend listening on http://${HOST}:${PORT}`);
});
