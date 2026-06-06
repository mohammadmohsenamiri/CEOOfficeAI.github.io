import type { AiSettings, BaleSettings, CeoRequest, Meeting, RecurringTask, Task, User } from "./types";

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
  const [users, tasks, recurringTasks, meetings, requests] = await Promise.all([
    apiFetch<User[]>("/api/users"),
    apiFetch<Task[]>("/api/tasks"),
    apiFetch<RecurringTask[]>("/api/recurring-tasks"),
    apiFetch<Meeting[]>("/api/meetings"),
    apiFetch<CeoRequest[]>("/api/ceo-requests")
  ]);
  return { users, tasks, recurringTasks, meetings, requests };
}

export const api = {
  loginPassword: (username: string, password: string) =>
    apiFetch<{ loggedIn: boolean; user: User }>("/api/auth/login-password", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  requestBaleCode: (identifier: string) =>
    apiFetch<{ sent: boolean }>("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ identifier })
    }),
  loginBaleCode: (identifier: string, code: string) =>
    apiFetch<{ loggedIn: boolean; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, code })
    }),
  createTask: (payload: unknown) =>
    apiFetch<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  deleteTask: (taskId: string) =>
    apiFetch<{ deleted: true }>("/api/tasks", { method: "DELETE", body: JSON.stringify({ taskId }) }),
  moveTaskToLongTerm: (taskId: string) =>
    apiFetch<{ saved: true; task: Task }>("/api/tasks/long-term", { method: "PATCH", body: JSON.stringify({ taskId }) }),
  createMeeting: (payload: unknown) =>
    apiFetch<{ meeting: Meeting }>("/api/meetings", { method: "POST", body: JSON.stringify(payload) }),
  getAiSettings: () => apiFetch<AiSettings>("/api/settings/ai"),
  saveAiSettings: (payload: Partial<AiSettings>) =>
    apiFetch<{ saved: true; ai: AiSettings }>("/api/settings/ai", { method: "PUT", body: JSON.stringify(payload) }),
  testAi: () => apiFetch<{ ok: boolean; ai: unknown; messengerMode: string }>("/api/settings/ai/test", { method: "POST", body: "{}" }),
  getBaleSettings: () => apiFetch<BaleSettings>("/api/settings/bale"),
  saveBaleSettings: (payload: Partial<BaleSettings>) =>
    apiFetch<{ saved: true; bale: BaleSettings }>("/api/settings/bale", { method: "PUT", body: JSON.stringify(payload) })
};
