const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4188);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");

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
  users: [
    { id: "u1", fullName: "مریم رضایی", jobTitle: "مدیرعامل", role: "CEO", groups: ["g1"], telegramChatId: "1001", baleChatId: "2001", active: true, isCeo: true },
    { id: "u2", fullName: "علی کریمی", jobTitle: "هماهنگ‌کننده دفتر", role: "Admin", groups: ["g2"], telegramChatId: "1002", baleChatId: "2002", active: true, isCeo: false },
    { id: "u3", fullName: "سارا احمدی", jobTitle: "مدیر فروش", role: "Employee", groups: ["g3"], telegramChatId: "1003", baleChatId: "2003", active: true, isCeo: false },
    { id: "u4", fullName: "حسین نوری", jobTitle: "مسئول عملیات", role: "Employee", groups: ["g4"], telegramChatId: "1004", baleChatId: "2004", active: true, isCeo: false }
  ],
  groups: [
    { id: "g1", title: "مدیریت", type: "management" },
    { id: "g2", title: "دفتر مدیرعامل", type: "office" },
    { id: "g3", title: "فروش", type: "normal" },
    { id: "g4", title: "عملیات", type: "normal" },
    { id: "g-ceo-request", title: "درخواست از مدیرعامل", type: "ceo_request" }
  ],
  tasks: [
    {
      id: "T-1001",
      title: "آماده‌سازی گزارش فروش هفتگی",
      description: "خلاصه فروش، ریسک‌ها و اقدامات پیشنهادی برای جلسه صبح شنبه.",
      creatorId: "u2",
      groupId: "g3",
      dueAt: "2026-06-06T07:30:00.000Z",
      priority: "high",
      visibility: "group",
      status: "open",
      createdAt: nowIso(),
      assignments: [
        { userId: "u3", status: "accepted", rejectReason: "", doneAt: "" },
        { userId: "u4", status: "pending", rejectReason: "", doneAt: "" }
      ]
    }
  ],
  ceoRequests: [
    { id: "R-2201", title: "درخواست تایید بودجه رویداد مشتریان", description: "بودجه اولیه برای رویداد تیرماه نیاز به تایید دارد.", requesterId: "u3", ceoId: "u1", status: "pending", decisionReason: "", delegatedTaskId: "", createdAt: nowIso() }
  ],
  meetings: [
    { id: "M-3001", title: "جلسه هماهنگی فروش و عملیات", description: "بررسی تعهدات باز و تصمیم برای هفته آینده.", startAt: "2026-06-06T08:00:00.000Z", endAt: "2026-06-06T09:00:00.000Z", location: "اتاق جلسات اصلی", creatorId: "u2", status: "scheduled", members: ["u2", "u3", "u4"], createdAt: nowIso() }
  ],
  incomingMessages: [],
  notifications: [],
  auditLogs: []
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    writeData(seed);
    return structuredClone(seed);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
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
  return currentUser.groups.includes(task.groupId);
}

function canAssignTo(data, currentUser, assigneeIds) {
  const ceo = data.users.find((user) => user.isCeo);
  if (!ceo || !assigneeIds.includes(ceo.id)) return true;
  return currentUser.role === "CEO" && assigneeIds.every((userId) => userId === ceo.id);
}

function normalizeBaleMessage(payload) {
  const message = payload.message || payload;
  const chat = message.chat || {};
  return {
    source: "bale",
    senderMessengerId: String(chat.id || message.chat_id || payload.chat_id || ""),
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
  const assignees = resolveUsersByPersianText(data, text);
  const cleaned = text.replace(/برای|بساز|ثبت کن|تا فردا|تا امروز|تسک|جلسه/g, "").trim().slice(0, 90);
  if (text.includes("جلسه")) {
    return { intent: "create_meeting", title: cleaned || "جلسه جدید", members: assignees, startText: text.includes("فردا") ? "فردا" : "امروز", confidence: 0.76, needsConfirmation: true };
  }
  if (text.includes("مدیرعامل") || text.includes("بودجه") || text.includes("تایید")) {
    return { intent: "create_ceo_request", title: cleaned || "درخواست از مدیرعامل", confidence: 0.72, needsConfirmation: true };
  }
  if (text.includes("تسک") || text.includes("کار")) {
    return { intent: "create_task", title: cleaned || "تسک جدید", assignees, dueText: text.includes("فردا") ? "فردا" : "امروز", confidence: 0.81, needsConfirmation: true };
  }
  if (text.includes("تسک‌های من") || text.includes("/mytasks")) return { intent: "query_tasks", confidence: 0.93, needsConfirmation: false };
  return { intent: "unknown", confidence: 0.3, needsConfirmation: false, question: "لطفاً مشخص کنید تسک، جلسه یا درخواست از مدیرعامل می‌خواهید." };
}

function createNotification(data, userId, title, body, relatedEntity) {
  data.notifications.unshift({ id: id("N"), userId, channel: "web", title, body, scheduledAt: nowIso(), sentAt: "", status: "pending", relatedEntity });
}

const routes = {
  "GET /api/health": async ({ data }) => ({ ok: true, product: "CEO Office AI Coordinator", phases: "P0-P6 backend MVP", time: nowIso(), counts: {
    users: data.users.length,
    tasks: data.tasks.length,
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
      webhookUrl: String(body.webhookUrl || ""),
      secret: body.secret === "********" ? before.secret : String(body.secret || ""),
      defaultReplyMode: String(body.defaultReplyMode || "persian-confirmation"),
      updatedAt: nowIso()
    };
    log(data, currentUser.id, "update_bale_settings", "settings", "bale", before, data.settings.bale);
    return { saved: true, bale: { ...data.settings.bale, botToken: data.settings.bale.botToken ? "********" : "" } };
  },

  "GET /api/users": async ({ data }) => data.users,
  "GET /api/groups": async ({ data }) => data.groups,

  "GET /api/tasks": async ({ data, currentUser }) => data.tasks.filter((task) => canViewTask(currentUser, task)),

  "POST /api/tasks": async ({ data, body, currentUser }) => {
    const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
    if (!assigneeIds.length) return { status: 400, body: { error: "حداقل یک مسئول انتخاب کنید." } };
    if (!canAssignTo(data, currentUser, assigneeIds)) return { status: 403, body: { error: "تعریف مستقیم تسک برای مدیرعامل مجاز نیست. از مسیر درخواست از مدیرعامل استفاده کنید." } };
    const ceo = data.users.find((user) => user.isCeo);
    const task = {
      id: id("T"),
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      creatorId: currentUser.id,
      groupId: String(body.groupId || currentUser.groups[0]),
      dueAt: body.dueAt || nowIso(),
      priority: body.priority || "medium",
      visibility: assigneeIds.includes(ceo && ceo.id) ? "ceo_private" : "group",
      status: "open",
      createdAt: nowIso(),
      assignments: assigneeIds.map((userId) => ({ userId, status: "pending", rejectReason: "", doneAt: "" }))
    };
    data.tasks.unshift(task);
    task.assignments.forEach((a) => createNotification(data, a.userId, "تسک جدید", task.title, { type: "task", id: task.id }));
    log(data, currentUser.id, "create", "task", task.id, null, task);
    return { status: 201, body: task };
  },

  "PATCH /api/tasks/assignment": async ({ data, body, currentUser }) => {
    const task = data.tasks.find((item) => item.id === body.taskId);
    if (!task || !canViewTask(currentUser, task)) return { status: 404, body: { error: "تسک پیدا نشد." } };
    const assignment = task.assignments.find((item) => item.userId === currentUser.id);
    if (!assignment) return { status: 403, body: { error: "شما مسئول این تسک نیستید." } };
    const before = { ...assignment };
    assignment.status = body.status;
    assignment.rejectReason = body.rejectReason || "";
    assignment.doneAt = body.status === "done" ? nowIso() : "";
    if (task.assignments.every((item) => item.status === "done")) {
      task.status = "done";
      createNotification(data, task.creatorId, "تسک تکمیل شد", task.title, { type: "task", id: task.id });
    } else {
      createNotification(data, task.creatorId, "وضعیت تسک تغییر کرد", `${currentUser.fullName}: ${body.status}`, { type: "task", id: task.id });
    }
    log(data, currentUser.id, "update_assignment", "task", task.id, before, assignment);
    return { task };
  },

  "GET /api/ceo-requests": async ({ data, currentUser }) => data.ceoRequests.filter((request) => currentUser.role === "CEO" || currentUser.role === "Admin" || request.requesterId === currentUser.id),

  "POST /api/ceo-requests": async ({ data, body, currentUser }) => {
    const ceo = data.users.find((user) => user.isCeo);
    const request = { id: id("R"), title: String(body.title || ""), description: String(body.description || ""), requesterId: currentUser.id, ceoId: ceo.id, status: "pending", decisionReason: "", delegatedTaskId: "", createdAt: nowIso() };
    data.ceoRequests.unshift(request);
    createNotification(data, ceo.id, "درخواست جدید از مدیرعامل", request.title, { type: "ceo_request", id: request.id });
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

  "POST /api/messages/parse": async ({ data, body }) => parsePersianIntent(data, String(body.text || "")),

  "POST /api/webhooks/bale": async ({ data, req, body }) => {
    const configuredSecret = data.settings.bale.secret;
    if (configuredSecret && req.headers["x-bale-secret"] !== configuredSecret) return { status: 401, body: { error: "Bale secret is invalid." } };
    const normalized = normalizeBaleMessage(body);
    const linkedUser = data.users.find((user) => user.baleChatId === normalized.senderMessengerId);
    const parsedIntent = normalized.text ? parsePersianIntent(data, normalized.text) : { intent: "unknown", question: "لطفاً متن پیام را ارسال کنید." };
    const record = { id: id("MSG"), ...normalized, userId: linkedUser ? linkedUser.id : "", parsedIntent, status: linkedUser ? "parsed" : "unknown_sender" };
    data.incomingMessages.unshift(record);
    log(data, linkedUser ? linkedUser.id : "anonymous", "incoming_bale_message", "message", record.id, null, record);
    return {
      ok: true,
      messageId: record.id,
      reply: linkedUser ? "پیام شما دریافت شد. لطفاً خلاصه برداشت سیستم را تایید یا لغو کنید." : "شناسه بله شما در سیستم ثبت نشده است. لطفاً با مدیر سیستم تماس بگیرید.",
      parsedIntent
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
      const due = new Date(task.dueAt).getTime();
      if (task.status !== "done" && due < now) {
        suggestions.push({
          id: id("SUG"),
          type: "overdue_task",
          severity: "high",
          title: "تسک عقب‌افتاده",
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
      const due = new Date(task.dueAt).getTime();
      if (task.status !== "done" && due < now) {
        createNotification(data, task.creatorId, "هشدار تسک عقب‌افتاده", task.title, { type: "task", id: task.id });
        created += 1;
      }
    }
    log(data, currentUser.id, "run_smart_notifications", "notification", "batch", null, { created });
    return { created };
  },

  "GET /api/offline/status": async ({ data }) => ({
    mode: data.settings.ai.mode,
    offlineReady: Boolean(data.settings.ai.offlineModelPath),
    fallbackParserEnabled: data.settings.ai.fallbackParserEnabled,
    message: data.settings.ai.mode === "offline"
      ? "حالت آفلاین فعال است، اما مدل محلی باید روی سرور داخلی نصب شود."
      : "حالت فعلی آنلاین/محلی است و parser fallback فعال است."
  })
};

async function handle(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const data = readData();
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const htmlPath = path.join(__dirname, "..", "ceo-office-ai-coordinator-mvp.html");
    const html = fs.readFileSync(htmlPath, "utf8").replaceAll("http://127.0.0.1:4188", "");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  const key = `${req.method} ${url.pathname}`;
  const route = routes[key];
  if (!route) return send(res, 404, { error: "Route not found", route: key });

  try {
    const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
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
