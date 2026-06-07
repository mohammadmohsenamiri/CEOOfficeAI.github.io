import type {
  AiSettings,
  AnalyticsOverview,
  BaleSettings,
  CeoRequest,
  Group,
  Meeting,
  PendingUser,
  RecurringTask,
  SmartSuggestion,
  Task,
  User
} from "./types";

const fallbackBackendUrl = "https://ceoofficeai-github-io.onrender.com";

export function backendBaseUrl() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_BACKEND_URL || fallbackBackendUrl;
  return localStorage.getItem("ceo-office-backend-url") || process.env.NEXT_PUBLIC_BACKEND_URL || fallbackBackendUrl;
}

export function activeUserId() {
  if (typeof window === "undefined") return "admin";
  return localStorage.getItem("ceo-office-auth-user-id") || "admin";
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Actor-Id": activeUserId(),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.reason || "خطای ارتباط با backend");
  return body as T;
}

export async function loadAppData() {
  const [users, pendingUsers, groups, tasks, recurringTasks, meetings, requests] = await Promise.all([
    apiFetch<User[]>("/api/users"),
    apiFetch<PendingUser[]>("/api/pending-users").catch(() => []),
    apiFetch<Group[]>("/api/groups").catch(() => []),
    apiFetch<Task[]>("/api/tasks"),
    apiFetch<RecurringTask[]>("/api/recurring-tasks"),
    apiFetch<Meeting[]>("/api/meetings"),
    apiFetch<CeoRequest[]>("/api/ceo-requests").catch(() => [])
  ]);
  return { users, pendingUsers, groups, tasks, recurringTasks, meetings, requests };
}

export const api = {
  loginPassword: (username: string, password: string) =>
    apiFetch<{ loggedIn: boolean; user: User }>("/api/auth/login-password", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  signup: (payload: unknown) =>
    apiFetch<{ saved: true; pending: PendingUser; message?: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  requestBaleCode: (identifier: string) =>
    apiFetch<{ sent: boolean; userHint?: { fullName: string; baleUsername?: string } }>("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ identifier })
    }),
  loginBaleCode: (identifier: string, code: string) =>
    apiFetch<{ loggedIn: boolean; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, code })
    }),
  createTask: (payload: unknown) =>
    apiFetch<Task>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (payload: unknown) =>
    apiFetch<{ saved: true; task: Task }>("/api/tasks", { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (taskId: string) =>
    apiFetch<{ saved: true }>("/api/tasks", { method: "DELETE", body: JSON.stringify({ taskId }) }),
  moveTaskToLongTerm: (taskId: string) =>
    apiFetch<{ saved: true; task: Task }>("/api/tasks/long-term", { method: "PATCH", body: JSON.stringify({ taskId }) }),
  updateAssignment: (taskId: string, status: string, rejectReason = "") =>
    apiFetch<{ task: Task }>("/api/tasks/assignment", { method: "PATCH", body: JSON.stringify({ taskId, status, rejectReason }) }),
  createRecurringTask: (payload: unknown) =>
    apiFetch<RecurringTask>("/api/recurring-tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateRecurringTask: (payload: unknown) =>
    apiFetch<{ saved: true; recurringTask: RecurringTask }>("/api/recurring-tasks", { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRecurringTask: (recurringTaskId: string) =>
    apiFetch<{ saved: true }>("/api/recurring-tasks", { method: "DELETE", body: JSON.stringify({ recurringTaskId }) }),
  generateRecurringTask: (recurringTaskId: string) =>
    apiFetch<{ saved: true; task: Task; recurringTask: RecurringTask }>("/api/recurring-tasks/generate-next", {
      method: "POST",
      body: JSON.stringify({ recurringTaskId })
    }),
  createCeoRequest: (payload: unknown) =>
    apiFetch<CeoRequest>("/api/ceo-requests", { method: "POST", body: JSON.stringify(payload) }),
  decideCeoRequest: (requestId: string, status: string, decisionReason = "") =>
    apiFetch<{ request: CeoRequest }>("/api/ceo-requests/decision", {
      method: "PATCH",
      body: JSON.stringify({ requestId, status, decisionReason })
    }),
  createMeeting: (payload: unknown) =>
    apiFetch<Meeting>("/api/meetings", { method: "POST", body: JSON.stringify(payload) }),
  rescheduleMeeting: (meetingId: string, startAt: string, endAt: string) =>
    apiFetch<{ saved: true; meeting: Meeting }>("/api/meetings/reschedule", {
      method: "PATCH",
      body: JSON.stringify({ meetingId, startAt, endAt })
    }),
  createUser: (payload: unknown) =>
    apiFetch<User>("/api/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (payload: unknown) =>
    apiFetch<{ saved: true; user: User }>("/api/users", { method: "PATCH", body: JSON.stringify(payload) }),
  setUserStatus: (userId: string, active: boolean) =>
    apiFetch<{ saved: true; user: User }>("/api/users/status", { method: "PATCH", body: JSON.stringify({ userId, active }) }),
  deleteUser: (userId: string) =>
    apiFetch<{ saved: true }>("/api/users", { method: "DELETE", body: JSON.stringify({ userId }) }),
  approvePendingUser: (pendingUserId: string, role = "User", groupId = "g2") =>
    apiFetch<{ saved: true; user: User }>("/api/pending-users/approve", {
      method: "POST",
      body: JSON.stringify({ pendingUserId, role, groupId })
    }),
  rejectPendingUser: (pendingUserId: string, reason = "") =>
    apiFetch<{ saved: true; pending: PendingUser }>("/api/pending-users/reject", {
      method: "POST",
      body: JSON.stringify({ pendingUserId, reason })
    }),
  getAiSettings: () => apiFetch<AiSettings>("/api/settings/ai"),
  saveAiSettings: (payload: Partial<AiSettings>) =>
    apiFetch<{ saved: true; ai: AiSettings }>("/api/settings/ai", { method: "PUT", body: JSON.stringify(payload) }),
  testAi: () => apiFetch<{ ok: boolean; ai: unknown; messengerMode: string }>("/api/settings/ai/test", { method: "POST", body: "{}" }),
  askAi: (text: string) =>
    apiFetch<{ reply: string; ai: unknown; messageId: string }>("/api/messages/ask", { method: "POST", body: JSON.stringify({ text, source: "web" }) }),
  getBaleSettings: () => apiFetch<BaleSettings>("/api/settings/bale"),
  saveBaleSettings: (payload: Partial<BaleSettings>) =>
    apiFetch<{ saved: true; bale: BaleSettings }>("/api/settings/bale", { method: "PUT", body: JSON.stringify(payload) }),
  registerBaleWebhook: () =>
    apiFetch<unknown>("/api/settings/bale/register-webhook", { method: "POST", body: "{}" }),
  testBaleSend: (chatId: string, text: string) =>
    apiFetch<unknown>("/api/settings/bale/test-send", { method: "POST", body: JSON.stringify({ chatId, text }) }),
  runBaleReminders: () =>
    apiFetch<{ sent: unknown[] }>("/api/reminders/bale/run", { method: "POST", body: "{}" }),
  analyticsOverview: () => apiFetch<AnalyticsOverview>("/api/analytics/overview"),
  smartSuggestions: () => apiFetch<{ generatedAt: string; suggestions: SmartSuggestion[] }>("/api/smart-notifications/suggestions"),
  runSmartNotifications: () =>
    apiFetch<{ created: number }>("/api/smart-notifications/run", { method: "POST", body: "{}" })
};
