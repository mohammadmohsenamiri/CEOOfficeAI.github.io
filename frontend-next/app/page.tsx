"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, backendBaseUrl, loadAppData } from "@/lib/api";
import type { AiSettings, AppData, BaleSettings, Meeting, Task, User } from "@/lib/types";

type PageKey = "dashboard" | "tasks" | "longterm" | "recurring" | "requests" | "meetings" | "users" | "ai" | "messenger";

const navItems: Array<{ key: PageKey; title: string; adminOnly?: boolean }> = [
  { key: "dashboard", title: "داشبورد" },
  { key: "tasks", title: "وظایف جاری" },
  { key: "longterm", title: "وظایف بلندمدت" },
  { key: "recurring", title: "وظایف تکرارشونده" },
  { key: "requests", title: "درخواست از مدیرعامل", adminOnly: true },
  { key: "meetings", title: "جلسات" },
  { key: "users", title: "افراد", adminOnly: true },
  { key: "ai", title: "تنظیمات AI", adminOnly: true },
  { key: "messenger", title: "تنظیمات پیام‌رسان", adminOnly: true }
];

const emptyData: AppData = {
  users: [],
  tasks: [],
  recurringTasks: [],
  meetings: [],
  requests: []
};

function fa(value: number | string) {
  return new Intl.NumberFormat("fa-IR").format(Number(value));
}

function dateFa(value?: string) {
  if (!value) return "بدون تاریخ";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateOnlyFa(value?: string) {
  if (!value) return "بدون تاریخ";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(value));
}

function isPrivileged(user?: User | null) {
  return user?.role === "Admin" || user?.role === "CEO";
}

export default function Home() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [data, setData] = useState<AppData>(emptyData);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isPrivileged(currentUser)),
    [currentUser]
  );

  async function refresh() {
    setError("");
    const result = await loadAppData();
    setData(result);
    if (!currentUser) {
      const savedId = localStorage.getItem("ceo-office-auth-user-id");
      setCurrentUser(result.users.find((user) => user.id === savedId) || result.users.find((user) => user.role === "Admin") || null);
    }
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    const savedPage = localStorage.getItem("ceo-office-active-page-next") as PageKey | null;
    if (savedPage) setPage(savedPage);
  }, []);

  function go(next: PageKey) {
    setPage(next);
    localStorage.setItem("ceo-office-active-page-next", next);
  }

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3200);
  }

  if (!currentUser && !loading) {
    return <LoginScreen onLogin={(user) => { setCurrentUser(user); notify("ورود انجام شد."); refresh().catch((err) => setError(err.message)); }} />;
  }

  const activeUser = currentUser || data.users[0];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="row">
            <strong>CEO Office AI Coordinator</strong>
            <span className="ai-badge">AI</span>
          </div>
          <span>نسخه Next.js، فارسی، راست‌چین و متصل به backend فعلی</span>
        </div>
        <nav className="nav">
          {visibleNav.map((item) => (
            <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => go(item.key)}>
              <span>{item.title}</span>
              <span>‹</span>
            </button>
          ))}
        </nav>
        <div className="panel" style={{ marginTop: 18 }}>
          <span className="muted small">کاربر فعال</span>
          <strong>{activeUser?.fullName || "نامشخص"}</strong>
          <span className="chip">{activeUser?.role || "-"}</span>
          <button className="blue" onClick={() => refresh().then(() => notify("داده‌ها به‌روزرسانی شد.")).catch((err) => setError(err.message))}>
            به‌روزرسانی
          </button>
          <button className="danger" onClick={() => { localStorage.removeItem("ceo-office-auth-user-id"); setCurrentUser(null); }}>
            خروج
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="hero">
          <div>
            <h1>{navItems.find((item) => item.key === page)?.title}</h1>
            <p className="muted">Backend: <span className="ltr">{backendBaseUrl()}</span></p>
          </div>
          <span className="chip ok">{loading ? "در حال دریافت" : "متصل"}</span>
        </header>
        {error ? <div className="card" style={{ borderColor: "rgba(248,113,113,.4)" }}>{error}</div> : null}
        {page === "dashboard" && <Dashboard data={data} go={go} />}
        {page === "tasks" && <TasksPanel tasks={data.tasks.filter((task) => !task.longTerm)} users={data.users} longTerm={false} onDone={refresh} notify={notify} />}
        {page === "longterm" && <TasksPanel tasks={data.tasks.filter((task) => task.longTerm)} users={data.users} longTerm onDone={refresh} notify={notify} />}
        {page === "recurring" && <RecurringPanel data={data} />}
        {page === "requests" && <RequestsPanel data={data} />}
        {page === "meetings" && <MeetingsPanel data={data} onDone={refresh} notify={notify} />}
        {page === "users" && <UsersPanel data={data} />}
        {page === "ai" && <AiSettingsPanel notify={notify} />}
        {page === "messenger" && <MessengerSettingsPanel notify={notify} />}
      </main>
      {toast ? <div className="card" style={{ position: "fixed", left: 20, bottom: 20, zIndex: 20 }}>{toast}</div> : null}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"password" | "bale">("password");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = mode === "password"
        ? await api.loginPassword(String(form.get("username")), String(form.get("password")))
        : await api.loginBaleCode(String(form.get("identifier")), String(form.get("code")));
      localStorage.setItem("ceo-office-auth-user-id", result.user.id);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ورود");
    }
  }

  return (
    <main className="login">
      <form className="panel login-card" onSubmit={submit}>
        <div className="brand">
          <div className="row"><strong>CEO Office AI Coordinator</strong><span className="ai-badge">AI</span></div>
          <span>ورود امن به نسخه Next.js</span>
        </div>
        <div className="tabs">
          <button type="button" className={mode === "password" ? "primary" : ""} onClick={() => setMode("password")}>ورود با حساب</button>
          <button type="button" className={mode === "bale" ? "primary" : ""} onClick={() => setMode("bale")}>ورود با بله</button>
        </div>
        {mode === "password" ? (
          <>
            <label>نام کاربری<input name="username" required /></label>
            <label>رمز عبور<input name="password" type="password" required /></label>
          </>
        ) : (
          <>
            <label>آیدی بله یا نام<input name="identifier" required /></label>
            <label>کد دریافت‌شده<input name="code" required /></label>
          </>
        )}
        {error ? <span className="chip warn">{error}</span> : null}
        <button className="primary">ورود</button>
      </form>
    </main>
  );
}

function Dashboard({ data, go }: { data: AppData; go: (page: PageKey) => void }) {
  const longTerm = data.tasks.filter((task) => task.longTerm).length;
  const dated = data.tasks.filter((task) => !task.longTerm).length;
  return (
    <>
      <section className="metrics">
        <div className="card metric"><span className="muted">وظایف جاری</span><b>{fa(dated)}</b></div>
        <div className="card metric"><span className="muted">وظایف بلندمدت</span><b>{fa(longTerm)}</b></div>
        <div className="card metric"><span className="muted">چرخه‌های تکرار</span><b>{fa(data.recurringTasks.length)}</b></div>
        <div className="card metric"><span className="muted">جلسات</span><b>{fa(data.meetings.length)}</b></div>
      </section>
      <section className="grid">
        <div className="panel">
          <div className="panel-head"><h2>وظایف نزدیک</h2><button className="blue" onClick={() => go("tasks")}>رفتن به وظایف</button></div>
          <TaskList tasks={data.tasks.filter((task) => !task.longTerm).slice(0, 4)} users={data.users} />
        </div>
        <div className="panel">
          <div className="panel-head"><h2>جلسات پیش رو</h2><button className="blue" onClick={() => go("meetings")}>رفتن به جلسات</button></div>
          <MeetingList meetings={data.meetings.slice(0, 4)} users={data.users} />
        </div>
      </section>
    </>
  );
}

function TasksPanel({ tasks, users, longTerm, onDone, notify }: { tasks: Task[]; users: User[]; longTerm: boolean; onDone: () => Promise<void>; notify: (message: string) => void }) {
  async function remove(taskId: string) {
    await api.deleteTask(taskId);
    await onDone();
    notify("وظیفه حذف شد.");
  }

  async function move(taskId: string) {
    await api.moveTaskToLongTerm(taskId);
    await onDone();
    notify("وظیفه به بخش بلندمدت منتقل شد.");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{longTerm ? "وظایف بلندمدت" : "وظایف جاری"}</h2>
        <span className="chip">{fa(tasks.length)} مورد</span>
      </div>
      <TaskList tasks={tasks} users={users} onDelete={remove} onMove={longTerm ? undefined : move} />
    </section>
  );
}

function TaskList({ tasks, users, onDelete, onMove }: { tasks: Task[]; users: User[]; onDelete?: (id: string) => void; onMove?: (id: string) => void }) {
  if (!tasks.length) return <div className="card muted">وظیفه‌ای برای نمایش وجود ندارد.</div>;
  return (
    <div className="list">
      {tasks.map((task) => (
        <article className="card" key={task.id}>
          <div className="row">
            <div>
              <h3>{task.title}</h3>
              <p className="muted">{task.description || "بدون توضیح"}</p>
            </div>
            <span className="chip">{task.longTerm ? "بلندمدت" : dateOnlyFa(task.dueAt)}</span>
          </div>
          <div className="chips">
            {task.assignments?.map((assignment) => <span className="chip" key={assignment.userId}>{users.find((user) => user.id === assignment.userId)?.fullName || "کاربر"}</span>)}
          </div>
          <div className="actions">
            {onMove ? <button className="blue" onClick={() => onMove(task.id)}>انتقال به بلندمدت</button> : null}
            {onDelete ? <button className="danger" onClick={() => onDelete(task.id)}>حذف</button> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function RecurringPanel({ data }: { data: AppData }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>وظایف تکرارشونده</h2><span className="chip">{fa(data.recurringTasks.length)} چرخه</span></div>
      <div className="list">
        {data.recurringTasks.map((item) => (
          <article className="card" key={item.id}>
            <div className="row"><h3>{item.title}</h3><span className={item.active ? "chip ok" : "chip warn"}>{item.active ? "فعال" : "غیرفعال"}</span></div>
            <p className="muted">{item.description || "بدون توضیح"}</p>
            <div className="chips"><span className="chip">{item.cycle}</span><span className="chip">{dateFa(item.nextRunAt)}</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RequestsPanel({ data }: { data: AppData }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>درخواست‌های مدیرعامل</h2><span className="chip">{fa(data.requests.length)} درخواست</span></div>
      <div className="list">
        {data.requests.map((request) => (
          <article className="card" key={request.id}>
            <div className="row"><h3>{request.title}</h3><span className="chip">{request.status}</span></div>
            <p className="muted">{request.description || "بدون توضیح"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MeetingsPanel({ data }: { data: AppData; onDone: () => Promise<void>; notify: (message: string) => void }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>تقویم جلسات</h2><span className="chip">{fa(data.meetings.length)} جلسه</span></div>
      <div className="calendar">
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date();
          day.setDate(day.getDate() + index);
          const dayMeetings = data.meetings.filter((meeting) => new Date(meeting.startAt).toDateString() === day.toDateString());
          return (
            <article className="card day" key={index}>
              <strong>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "short" }).format(day)}</strong>
              <div className="list" style={{ marginTop: 10 }}>
                {dayMeetings.map((meeting) => <MeetingMini key={meeting.id} meeting={meeting} users={data.users} />)}
                {!dayMeetings.length ? <span className="muted small">جلسه‌ای ثبت نشده</span> : null}
              </div>
            </article>
          );
        })}
      </div>
      <MeetingList meetings={data.meetings} users={data.users} />
    </section>
  );
}

function MeetingList({ meetings, users }: { meetings: Meeting[]; users: User[] }) {
  if (!meetings.length) return <div className="card muted">جلسه‌ای برای نمایش وجود ندارد.</div>;
  return <div className="list">{meetings.map((meeting) => <MeetingMini key={meeting.id} meeting={meeting} users={users} />)}</div>;
}

function MeetingMini({ meeting, users }: { meeting: Meeting; users: User[] }) {
  return (
    <article className="card">
      <div className="row"><h3>{meeting.title}</h3><span className="chip">{dateFa(meeting.startAt)}</span></div>
      <p className="muted">{meeting.location || "بدون مکان"}</p>
      <div className="chips">{meeting.members.map((id) => <span className="chip" key={id}>{users.find((user) => user.id === id)?.fullName || "کاربر"}</span>)}</div>
    </article>
  );
}

function UsersPanel({ data }: { data: AppData }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>افراد</h2><span className="chip">{fa(data.users.length)} نفر</span></div>
      <div className="grid">
        {data.users.map((user) => (
          <article className="card" key={user.id}>
            <div className="row">
              <div><h3>{user.fullName}</h3><p className="muted">{user.jobTitle}</p></div>
              <span className={user.active ? "chip ok" : "chip warn"}>{user.active ? "فعال" : "معلق"}</span>
            </div>
            <div className="chips"><span className="chip">{user.role}</span><span className="chip ltr">{user.baleUsername || user.baleChatId || "بدون بله"}</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AiSettingsPanel({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [result, setResult] = useState("");

  useEffect(() => {
    api.getAiSettings().then(setSettings).catch((err) => setResult(err.message));
  }, []);

  if (!settings) return <section className="panel">در حال دریافت تنظیمات AI...</section>;

  async function saveAndTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.saveAiSettings({
      mode: String(form.get("mode")) as AiSettings["mode"],
      onlineProvider: String(form.get("onlineProvider")),
      baseUrl: String(form.get("baseUrl")),
      apiKey: String(form.get("apiKey")),
      model: String(form.get("model")),
      offlineModelPath: String(form.get("offlineModelPath")),
      fallbackParserEnabled: form.get("fallbackParserEnabled") === "true"
    });
    const test = await api.testAi();
    setResult(JSON.stringify(test, null, 2));
    notify(test.ok ? "ارتباط AI موفق بود و پیام‌رسان به AI وصل شد." : "تست AI موفق نبود.");
  }

  return (
    <form className="panel" onSubmit={saveAndTest}>
      <div className="panel-head"><h2>تنظیمات AI</h2><span className="chip">{settings.mode}</span></div>
      <div className="form-grid">
        <label>AI Mode<select name="mode" defaultValue={settings.mode}><option value="online">Online</option><option value="offline">Offline / Ollama</option></select></label>
        <label>Provider<select name="onlineProvider" defaultValue={settings.onlineProvider || "openrouter"}><option value="openrouter">OpenRouter</option><option value="openai-compatible">OpenAI Compatible</option><option value="ollama">Ollama</option></select></label>
        <label>Model<input name="model" defaultValue={settings.model || "openrouter/free"} /></label>
        <label className="full">Base URL<input name="baseUrl" defaultValue={settings.baseUrl || "https://openrouter.ai/api/v1"} /></label>
        <label className="full">API Key<input name="apiKey" defaultValue={settings.apiKey ? "********" : ""} /></label>
        <label className="full">Offline Model / Path<input name="offlineModelPath" defaultValue={settings.offlineModelPath || "qwen3:3b"} /></label>
        <label>Fallback Parser<select name="fallbackParserEnabled" defaultValue={String(settings.fallbackParserEnabled !== false)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
      </div>
      <div className="actions"><button className="primary">ذخیره و تست ارتباط AI</button></div>
      {result ? <pre className="card ltr">{result}</pre> : null}
    </form>
  );
}

function MessengerSettingsPanel({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState<BaleSettings | null>(null);

  useEffect(() => {
    api.getBaleSettings().then(setSettings).catch(() => undefined);
  }, []);

  if (!settings) return <section className="panel">در حال دریافت تنظیمات پیام‌رسان...</section>;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.saveBaleSettings({
      enabled: form.get("enabled") === "true",
      botToken: String(form.get("botToken")),
      webhookUrl: String(form.get("webhookUrl")),
      secret: String(form.get("secret")),
      defaultReplyMode: String(form.get("defaultReplyMode"))
    });
    notify("تنظیمات پیام‌رسان ذخیره شد.");
  }

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head"><h2>تنظیمات پیام‌رسان</h2><span className="chip">{settings.enabled ? "فعال" : "غیرفعال"}</span></div>
      <div className="form-grid">
        <label>فعال‌سازی<select name="enabled" defaultValue={String(settings.enabled)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
        <label>حالت پاسخ<select name="defaultReplyMode" defaultValue={settings.defaultReplyMode}><option value="ai-assisted">پاسخ هوشمند با AI</option><option value="persian-confirmation">تایید فارسی قبل از ثبت</option><option value="persian-command-only">فقط دستور متنی</option></select></label>
        <label className="full">Bot Token<input name="botToken" defaultValue={settings.botToken || ""} /></label>
        <label className="full">Webhook URL<input name="webhookUrl" defaultValue={settings.webhookUrl || ""} /></label>
        <label className="full">Secret Header<input name="secret" defaultValue={settings.secret || ""} /></label>
      </div>
      <button className="primary">ذخیره تنظیمات پیام‌رسان</button>
    </form>
  );
}
