"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, backendBaseUrl, loadAppData } from "@/lib/api";
import type { AiSettings, AnalyticsOverview, AppData, BaleSettings, Meeting, SmartSuggestion, Task, User } from "@/lib/types";

type PageKey = "dashboard" | "tasks" | "longterm" | "recurring" | "requests" | "meetings" | "users" | "analytics" | "ai" | "messenger";
type CalendarView = "month" | "week" | "day";
type IconKey = "dashboard" | "tasks" | "requests" | "meetings" | "bale" | "analytics" | "offline" | "users" | "approveUser" | "clock" | "done" | "alert" | "user" | "lock" | "spark";

const emptyData: AppData = { users: [], pendingUsers: [], groups: [], tasks: [], recurringTasks: [], meetings: [], requests: [] };
const navItems: Array<{ key: PageKey; title: string; icon: IconKey; adminOnly?: boolean }> = [
  { key: "dashboard", title: "داشبورد", icon: "dashboard" },
  { key: "tasks", title: "وظایف جاری", icon: "tasks" },
  { key: "longterm", title: "وظایف بلندمدت", icon: "tasks" },
  { key: "recurring", title: "وظایف تکرارشونده", icon: "clock" },
  { key: "requests", title: "درخواست از مدیرعامل", icon: "requests" },
  { key: "meetings", title: "جلسات", icon: "meetings" },
  { key: "users", title: "افراد", icon: "users", adminOnly: true },
  { key: "analytics", title: "تحلیل و هشدارها", icon: "analytics", adminOnly: true },
  { key: "ai", title: "تنظیمات هوش مصنوعی", icon: "offline", adminOnly: true },
  { key: "messenger", title: "تنظیمات پیام رسان", icon: "bale", adminOnly: true }
];

const iconPaths: Record<IconKey, string[]> = {
  dashboard: ["M3 13h8V3H3z", "M13 21h8V11h-8z", "M13 3h8v4h-8z", "M3 17h8v4H3z"],
  tasks: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  requests: ["M12 3l7 4v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7z", "M9 12l2 2 4-5"],
  meetings: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2z"],
  bale: ["M21 12a9 9 0 1 1-3.2-6.9", "M8 12h8", "M12 8v8", "M16 4h5v5"],
  analytics: ["M3 3v18h18", "M7 16l4-5 4 3 5-8"],
  offline: ["M12 18h.01", "M8.5 14.5a5 5 0 0 1 7 0", "M5 11a10 10 0 0 1 14 0", "M2 8a15 15 0 0 1 20 0", "M3 3l18 18"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  approveUser: ["M3 21a6 6 0 0 1 12 0", "M16 11l2 2 4-5"],
  clock: ["M12 6v6l4 2"],
  done: ["M20 6L9 17l-5-5"],
  alert: ["M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  user: ["M20 21a8 8 0 0 0-16 0"],
  lock: ["M4 11h16v10H4z", "M8 11V7a4 4 0 0 1 8 0v4"],
  spark: ["M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"]
};

function Icon({ name }: { name: IconKey }) {
  return (
    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "users" || name === "approveUser" || name === "user" ? <circle cx={name === "users" ? 9 : 12} cy={name === "users" ? 7 : 8} r="4" /> : null}
      {name === "clock" ? <circle cx="12" cy="12" r="10" /> : null}
      {iconPaths[name].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

function fa(value: number | string) {
  return new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
}

function dateFa(value?: string, withTime = false) {
  if (!value) return "بدون تاریخ";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

function timeFa(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isoFromDateTime(date: string, time = "09:00") {
  return new Date(`${date}T${time}:00`).toISOString();
}

function todayInput(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromLocalValue(value: string) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day, 9, 0, 0, 0);
}

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

function gregorianToJalali(date: Date) {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  let gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy3 = gm > 2 ? gy2 + 1 : gy2;
  let days = 365 * gy2 + div(gy3 + 3, 4) - div(gy3 + 99, 100) + div(gy3 + 399, 400) - 80 + gd + gdm[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  jy += jy > 979 ? -979 : 0;
  let days = 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 1600 + 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const salA = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  while (gm <= 12 && gd > salA[gm]) gd -= salA[gm++];
  return { gy, gm, gd };
}

function JalaliDatePicker({ name, defaultValue, onChange }: { name: string; defaultValue?: string; onChange?: (value: string) => void }) {
  const [selected, setSelected] = useState(defaultValue || todayInput());
  const initialJalali = gregorianToJalali(dateFromLocalValue(defaultValue || todayInput()));
  const [view, setView] = useState({ jy: initialJalali.jy, jm: initialJalali.jm });
  const [open, setOpen] = useState(false);
  const selectedDate = dateFromLocalValue(selected);
  const selectedJalali = gregorianToJalali(selectedDate);
  const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const daysInMonth = view.jm <= 6 ? 31 : view.jm <= 11 ? 30 : 29;
  const first = jalaliToGregorian(view.jy, view.jm, 1);
  const firstDate = new Date(first.gy, first.gm - 1, first.gd);
  const offset = (firstDate.getDay() + 1) % 7;
  const titleDate = new Date(first.gy, first.gm - 1, first.gd);

  function shiftMonth(delta: number) {
    setView((current) => {
      let jy = current.jy;
      let jm = current.jm + delta;
      if (jm < 1) { jm = 12; jy--; }
      if (jm > 12) { jm = 1; jy++; }
      return { jy, jm };
    });
  }

  function choose(jd: number) {
    const g = jalaliToGregorian(view.jy, view.jm, jd);
    const next = localDateValue(new Date(g.gy, g.gm - 1, g.gd));
    setSelected(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <div className="full persian-date-picker">
      <input type="hidden" name={name} value={selected} />
      <label>تاریخ شمسی
        <button type="button" className="blue picker-toggle" onClick={() => setOpen((value) => !value)}>
          {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "full" }).format(selectedDate)}
        </button>
      </label>
      <div className={open ? "date-picker-popover" : "date-picker-popover hidden"}>
        <div className="date-picker-head">
          <button type="button" onClick={() => shiftMonth(-1)}>ماه قبل</button>
          <strong>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(titleDate)}</strong>
          <button type="button" onClick={() => shiftMonth(1)}>ماه بعد</button>
        </div>
        <div className="date-picker-grid">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const jd = index + 1;
            const active = selectedJalali.jy === view.jy && selectedJalali.jm === view.jm && selectedJalali.jd === jd;
            return <button type="button" className={active ? "primary" : ""} key={jd} onClick={() => choose(jd)}>{fa(jd)}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

function isPrivileged(user?: User | null) {
  return user?.role === "Admin" || user?.role === "CEO";
}

function assignableUsers(users: User[]) {
  return users.filter((user) => user.active && !user.isCeo && user.role !== "CEO");
}

export default function Home() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [data, setData] = useState<AppData>(emptyData);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const visibleNav = useMemo(() => navItems.filter((item) => !item.adminOnly || isPrivileged(currentUser)), [currentUser]);
  const activeUser = currentUser || data.users[0] || null;

  async function refresh() {
    setError("");
    const result = await loadAppData();
    setData(result);
    const savedId = localStorage.getItem("ceo-office-auth-user-id");
    setCurrentUser((existing) => result.users.find((user) => user.id === existing?.id) || result.users.find((user) => user.id === savedId) || existing || null);
  }

  useEffect(() => {
    const savedPage = localStorage.getItem("ceo-office-active-page-next") as PageKey | null;
    if (savedPage) setPage(savedPage);
    refresh().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!visibleNav.some((item) => item.key === page)) go("dashboard");
  }, [visibleNav, page]);

  function go(next: PageKey) {
    setPage(next);
    localStorage.setItem("ceo-office-active-page-next", next);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  async function action(work: () => Promise<void>, success?: string) {
    try {
      setError("");
      await work();
      await refresh();
      if (success) notify(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته");
    }
  }

  if (!activeUser && !loading) {
    return <LoginScreen onLogin={(user) => { localStorage.setItem("ceo-office-auth-user-id", user.id); setCurrentUser(user); refresh().catch((err) => setError(err.message)); }} />;
  }

  return (
    <div className="app" dir="rtl">
      <aside className="sidebar">
        <div className="brand">
          <div className="row"><strong>CEO Office AI</strong><span className="ai-badge">AI</span></div>
          <span>نسخه Next.js هم تراز با نسخه HTML، متصل به backend واقعی و مناسب کار فارسی راست چین.</span>
        </div>
        <nav className="nav">
          {visibleNav.map((item) => (
            <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => go(item.key)}>
              <span className="nav-title"><b><Icon name={item.icon} /></b>{item.title}</span>
              <span>‹</span>
            </button>
          ))}
        </nav>
        <div className="panel" style={{ marginTop: 18 }}>
          <span className="muted small">کاربر فعال</span>
          <strong>{activeUser?.fullName || "نامشخص"}</strong>
          <span className="chip">{activeUser?.role || "-"}</span>
          <button className="blue" onClick={() => action(refresh, "داده ها به روز شد.")}>به روزرسانی</button>
          <button className="danger" onClick={() => { localStorage.removeItem("ceo-office-auth-user-id"); setCurrentUser(null); }}>خروج</button>
        </div>
      </aside>
      <main className="main">
        <header className="hero">
          <div>
            <h1>{navItems.find((item) => item.key === page)?.title}</h1>
            <p className="muted">Backend: <span className="ltr">{backendBaseUrl()}</span></p>
          </div>
          <span className={loading ? "chip warn" : "chip ok"}>{loading ? "در حال دریافت" : "متصل"}</span>
        </header>
        {error ? <div className="card error">{error}</div> : null}
        {page === "dashboard" && <Dashboard data={data} go={go} />}
        {page === "tasks" && <TasksPanel tasks={data.tasks.filter((task) => !task.longTerm)} users={data.users} longTerm={false} onAction={action} />}
        {page === "longterm" && <TasksPanel tasks={data.tasks.filter((task) => task.longTerm)} users={data.users} longTerm onAction={action} />}
        {page === "recurring" && <RecurringPanel data={data} onAction={action} />}
        {page === "requests" && <RequestsPanel data={data} activeUser={activeUser} onAction={action} />}
        {page === "meetings" && <MeetingsPanel data={data} onAction={action} />}
        {page === "users" && <UsersPanel data={data} onAction={action} />}
        {page === "analytics" && <AnalyticsPanel onAction={action} />}
        {page === "ai" && <AiSettingsPanel notify={notify} />}
        {page === "messenger" && <MessengerSettingsPanel notify={notify} />}
      </main>
      {toast ? <div className="card toast">{toast}</div> : null}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"password" | "bale" | "signup">("password");
  const [identifier, setIdentifier] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "signup") {
        await api.signup({
          fullName: String(form.get("fullName")),
          jobTitle: String(form.get("jobTitle")),
          baleUsername: String(form.get("baleUsername")),
          username: String(form.get("username")),
          password: String(form.get("password"))
        });
        setNotice("درخواست شما ثبت شد و بعد از تایید مدیر فعال می شود.");
        return;
      }
      const result = mode === "password"
        ? await api.loginPassword(String(form.get("username")), String(form.get("password")))
        : await api.loginBaleCode(identifier, String(form.get("code")));
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ورود");
    }
  }

  async function requestCode() {
    try {
      setError("");
      const result = await api.requestBaleCode(identifier);
      setNotice(result.userHint ? `کد برای ${result.userHint.fullName} ارسال شد.` : "کد ورود در بله ارسال شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ارسال کد ناموفق بود");
    }
  }

  return (
    <main className="login" dir="rtl">
      <form className="panel login-card" onSubmit={submit}>
        <div className="brand"><div className="row"><strong>CEO Office AI</strong><span className="ai-badge">AI</span></div><span>ورود امن یا ثبت نام با تایید مدیر</span></div>
        <div className="tabs">
          <button type="button" className={mode === "password" ? "primary" : ""} onClick={() => setMode("password")}>حساب کاربری</button>
          <button type="button" className={mode === "bale" ? "primary" : ""} onClick={() => setMode("bale")}>کد بله</button>
          <button type="button" className={mode === "signup" ? "primary" : ""} onClick={() => setMode("signup")}>ثبت نام</button>
        </div>
        {mode === "password" && <><label>نام کاربری<input name="username" required /></label><label>رمز عبور<input name="password" type="password" required /></label></>}
        {mode === "bale" && <><label>آیدی بله یا نام کاربری<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label><button type="button" className="blue" onClick={requestCode}>دریافت کد از بله</button><label>کد دریافت شده<input name="code" required /></label></>}
        {mode === "signup" && <><label>نام کامل<input name="fullName" required /></label><label>جایگاه شغلی<input name="jobTitle" required /></label><label>آیدی بله<input name="baleUsername" required placeholder="@username" /></label><label>نام کاربری<input name="username" required /></label><label>رمز عبور<input name="password" type="password" required /></label></>}
        {notice ? <span className="chip ok">{notice}</span> : null}
        {error ? <span className="chip warn">{error}</span> : null}
        <button className="primary">{mode === "signup" ? "ثبت درخواست" : "ورود"}</button>
      </form>
    </main>
  );
}

function Dashboard({ data, go }: { data: AppData; go: (page: PageKey) => void }) {
  const current = data.tasks.filter((task) => !task.longTerm);
  const longTerm = data.tasks.filter((task) => task.longTerm);
  const pendingRequests = data.requests.filter((request) => request.status === "pending");
  return (
    <>
      <section className="metrics">
        <Metric title="وظایف جاری" value={current.length} icon="tasks" />
        <Metric title="وظایف بلندمدت" value={longTerm.length} icon="tasks" />
        <Metric title="چرخه های تکرار" value={data.recurringTasks.length} icon="clock" />
        <Metric title="جلسات" value={data.meetings.length} icon="meetings" />
        <Metric title="درخواست های باز" value={pendingRequests.length} icon="requests" />
        <Metric title="افراد فعال" value={data.users.filter((user) => user.active).length} icon="users" />
      </section>
      <section className="grid">
        <div className="panel"><div className="panel-head"><h2>وظایف نزدیک</h2><button className="blue" onClick={() => go("tasks")}>مشاهده</button></div><TaskList tasks={current.slice(0, 4)} users={data.users} /></div>
        <div className="panel"><div className="panel-head"><h2>جلسات پیش رو</h2><button className="blue" onClick={() => go("meetings")}>تقویم</button></div><MeetingList meetings={data.meetings.slice(0, 4)} users={data.users} /></div>
      </section>
    </>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon?: IconKey }) {
  return <div className="card metric">{icon ? <span className="metric-icon"><Icon name={icon} /></span> : null}<span className="muted">{title}</span><b>{fa(value)}</b></div>;
}

function AssigneePicker({ users, name = "assigneeIds" }: { users: User[]; name?: string }) {
  return (
    <label className="full">مسئولان
      <select name={name} multiple required>
        {assignableUsers(users).map((user) => <option value={user.id} key={user.id}>{user.fullName} - {user.jobTitle}</option>)}
      </select>
    </label>
  );
}

function selectedValues(form: FormData, name: string) {
  return form.getAll(name).map(String).filter(Boolean);
}

function TasksPanel({ tasks, users, longTerm, onAction }: { tasks: Task[]; users: User[]; longTerm: boolean; onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onAction(() => api.createTask({
      title: String(form.get("title")),
      description: String(form.get("description")),
      dueAt: longTerm ? "" : isoFromDateTime(String(form.get("date")), "09:00"),
      longTerm,
      assigneeIds: selectedValues(form, "assigneeIds")
    }).then(() => undefined), longTerm ? "وظیفه بلندمدت ساخته شد." : "وظیفه جاری ساخته شد.");
    event.currentTarget.reset();
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>{longTerm ? "وظایف بلندمدت" : "وظایف جاری"}</h2><span className="chip">{fa(tasks.length)} مورد</span></div>
      <form className="card form-grid" onSubmit={create}>
        <label>عنوان<input name="title" required /></label>
        {!longTerm ? <JalaliDatePicker name="date" defaultValue={todayInput()} /> : null}
        <label className="full">توضیحات<textarea name="description" /></label>
        <AssigneePicker users={users} />
        <button className="primary full">ثبت</button>
      </form>
      <TaskList tasks={tasks} users={users} onDelete={(id) => onAction(() => api.deleteTask(id).then(() => undefined), "وظیفه حذف شد.")} onMove={longTerm ? undefined : (id) => onAction(() => api.moveTaskToLongTerm(id).then(() => undefined), "به بلندمدت منتقل شد.")} onAssignment={(id, status) => onAction(() => api.updateAssignment(id, status).then(() => undefined), "وضعیت ثبت شد.")} />
    </section>
  );
}

function TaskList({ tasks, users, onDelete, onMove, onAssignment }: { tasks: Task[]; users: User[]; onDelete?: (id: string) => void; onMove?: (id: string) => void; onAssignment?: (id: string, status: string) => void }) {
  if (!tasks.length) return <div className="card muted">موردی برای نمایش وجود ندارد.</div>;
  return (
    <div className="list">
      {tasks.map((task) => (
        <article className="card" key={task.id}>
          <div className="row"><div className="icon-heading"><span className="card-icon"><Icon name={task.longTerm ? "clock" : "tasks"} /></span><div><h3>{task.title}</h3><p className="muted">{task.description || "بدون توضیح"}</p></div></div><span className="chip">{task.longTerm ? "بلندمدت" : dateFa(task.dueAt)}</span></div>
          <div className="chips">{task.assignments?.map((assignment) => <span className="chip" key={assignment.userId}>{users.find((user) => user.id === assignment.userId)?.fullName || "کاربر"}: {assignment.status}</span>)}</div>
          <div className="actions">
            {onAssignment ? <><button className="blue" onClick={() => onAssignment(task.id, "done")}>انجام شد</button><button onClick={() => onAssignment(task.id, "rejected")}>رد</button></> : null}
            {onMove ? <button className="blue" onClick={() => onMove(task.id)}>انتقال به بلندمدت</button> : null}
            {onDelete ? <button className="danger" onClick={() => onDelete(task.id)}>حذف</button> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function RecurringPanel({ data, onAction }: { data: AppData; onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onAction(() => api.createRecurringTask({
      title: String(form.get("title")),
      description: String(form.get("description")),
      assigneeIds: selectedValues(form, "assigneeIds"),
      cycle: String(form.get("cycle")),
      interval: Number(form.get("interval")) || 1,
      time: String(form.get("time") || "09:00"),
      startAt: isoFromDateTime(String(form.get("date")), String(form.get("time") || "09:00"))
    }).then(() => undefined), "چرخه تکرار ساخته شد.");
    event.currentTarget.reset();
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>وظایف تکرارشونده</h2><span className="chip">{fa(data.recurringTasks.length)} چرخه</span></div>
      <form className="card form-grid" onSubmit={create}>
        <label>عنوان<input name="title" required /></label>
        <label>چرخه<select name="cycle" defaultValue="daily"><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option></select></label>
        <label>فاصله<input name="interval" type="number" min="1" defaultValue="1" /></label>
        <JalaliDatePicker name="date" defaultValue={todayInput()} />
        <label>ساعت<input name="time" type="time" defaultValue="09:00" /></label>
        <label className="full">توضیحات<textarea name="description" /></label>
        <AssigneePicker users={data.users} />
        <button className="primary full">ثبت چرخه</button>
      </form>
      <div className="list">{data.recurringTasks.map((item) => <article className="card" key={item.id}><div className="row"><h3>{item.title}</h3><span className={item.active ? "chip ok" : "chip warn"}>{item.active ? "فعال" : "غیرفعال"}</span></div><p className="muted">{item.description || "بدون توضیح"}</p><div className="chips"><span className="chip">{item.cycle}</span><span className="chip">{dateFa(item.nextRunAt, true)}</span></div><div className="actions"><button className="blue" onClick={() => onAction(() => api.generateRecurringTask(item.id).then(() => undefined), "نمونه بعدی ساخته شد.")}>ساخت نمونه بعدی</button><button className="danger" onClick={() => onAction(() => api.deleteRecurringTask(item.id).then(() => undefined), "چرخه حذف شد.")}>حذف</button></div></article>)}</div>
    </section>
  );
}

function RequestsPanel({ data, activeUser, onAction }: { data: AppData; activeUser: User | null; onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onAction(() => api.createCeoRequest({ title: String(form.get("title")), description: String(form.get("description")) }).then(() => undefined), "درخواست ثبت شد.");
    event.currentTarget.reset();
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>درخواست از مدیرعامل</h2><span className="chip">{fa(data.requests.length)} درخواست</span></div>
      <form className="card form-grid" onSubmit={create}><label>عنوان<input name="title" required /></label><label className="full">شرح<textarea name="description" /></label><button className="primary full">ارسال درخواست</button></form>
      <div className="list">{data.requests.map((request) => <article className="card" key={request.id}><div className="row"><h3>{request.title}</h3><span className="chip">{request.status}</span></div><p className="muted">{request.description || "بدون توضیح"}</p>{request.decisionReason ? <p>{request.decisionReason}</p> : null}{activeUser?.role === "CEO" ? <div className="actions"><button className="blue" onClick={() => onAction(() => api.decideCeoRequest(request.id, "accepted").then(() => undefined), "درخواست پذیرفته شد.")}>پذیرش</button><button onClick={() => onAction(() => api.decideCeoRequest(request.id, "delegated").then(() => undefined), "درخواست به وظیفه تبدیل شد.")}>تبدیل به وظیفه</button><button className="danger" onClick={() => onAction(() => api.decideCeoRequest(request.id, "rejected").then(() => undefined), "درخواست رد شد.")}>رد</button></div> : null}</article>)}</div>
    </section>
  );
}

function MeetingsPanel({ data, onAction }: { data: AppData; onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  const [view, setView] = useState<CalendarView>("month");
  const [focus, setFocus] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const hours = Array.from({ length: 14 }, (_, index) => index + 7);

  useEffect(() => {
    if (!modalOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modalOpen]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const start = String(form.get("startTime") || "09:00");
    const end = String(form.get("endTime") || "10:00");
    if (new Date(`${date}T${end}:00`) <= new Date(`${date}T${start}:00`)) {
      await onAction(async () => { throw new Error("ساعت پایان باید بعد از ساعت شروع باشد."); });
      return;
    }
    await onAction(() => api.createMeeting({
      title: String(form.get("title") || "جلسه"),
      description: String(form.get("description") || ""),
      location: String(form.get("location")),
      startAt: isoFromDateTime(date, start),
      endAt: isoFromDateTime(date, end),
      members: selectedValues(form, "members")
    }).then(() => undefined), "جلسه ثبت شد.");
    setFocus(dateFromLocalValue(date));
    setModalOpen(false);
    event.currentTarget.reset();
  }

  async function moveMeeting(meetingId: string, dropDate: string, dropHour?: number) {
    const meeting = data.meetings.find((item) => item.id === meetingId);
    if (!meeting || !dropDate) return;
    const oldStart = new Date(meeting.startAt);
    const oldEnd = new Date(meeting.endAt);
    const duration = Math.max(30 * 60000, oldEnd.getTime() - oldStart.getTime());
    const nextStart = dateFromLocalValue(dropDate);
    nextStart.setHours(dropHour ?? oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const nextEnd = new Date(nextStart.getTime() + duration);
    await onAction(() => api.rescheduleMeeting(meeting.id, nextStart.toISOString(), nextEnd.toISOString()).then(() => undefined), "زمان جلسه جابه جا شد.");
    setFocus(nextStart);
  }

  const visibleMeetings = [...data.meetings].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{calendarTitle(focus, view)}</h2>
          <p className="muted small">جلسات را بکشید و روی روز یا ساعت جدید رها کنید.</p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setModalOpen(true)}>جلسه جدید</button>
          <button onClick={() => setFocus(shiftDate(focus, view, -1))}>{view === "month" ? "ماه قبل" : view === "week" ? "هفته قبل" : "روز قبل"}</button>
          <button className="blue" onClick={() => setFocus(new Date())}>امروز</button>
          <button onClick={() => setFocus(shiftDate(focus, view, 1))}>{view === "month" ? "ماه بعد" : view === "week" ? "هفته بعد" : "روز بعد"}</button>
        </div>
      </div>
      <div className="tabs">
        <button className={view === "month" ? "primary" : ""} onClick={() => setView("month")}>ماه</button>
        <button className={view === "week" ? "primary" : ""} onClick={() => setView("week")}>هفته</button>
        <button className={view === "day" ? "primary" : ""} onClick={() => setView("day")}>روز</button>
      </div>
      {view === "month" ? <CalendarMonth focus={focus} meetings={visibleMeetings} onMove={moveMeeting} /> : null}
      {view === "week" ? <CalendarWeek focus={focus} hours={hours} meetings={visibleMeetings} onMove={moveMeeting} /> : null}
      {view === "day" ? <CalendarDay focus={focus} hours={hours} meetings={visibleMeetings} onMove={moveMeeting} /> : null}
      <div className="panel-head"><h2>برنامه پیش رو</h2><span className="chip">{fa(visibleMeetings.length)} جلسه</span></div>
      <MeetingList meetings={visibleMeetings} users={data.users} />
      {modalOpen ? (
        <div className="modal-backdrop" onClick={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}>
          <form className="modal-card" onSubmit={create}>
            <div className="panel-head">
              <h2>جلسه جدید</h2>
              <button type="button" onClick={() => setModalOpen(false)}>بستن</button>
            </div>
            <div className="form-grid">
              <label className="full">عنوان<input name="title" defaultValue="جلسه" required /></label>
              <label className="full">توضیح<textarea name="description" /></label>
              <JalaliDatePicker name="date" defaultValue={localDateValue(focus)} />
              <label>ساعت شروع<input name="startTime" type="time" defaultValue="09:00" required /></label>
              <label>ساعت پایان<input name="endTime" type="time" defaultValue="10:00" required /></label>
              <label className="full">مکان یا لینک<input name="location" placeholder="اتاق جلسه یا لینک" /></label>
              <label className="full">اعضا<select name="members" multiple size={5}>{data.users.filter((user) => user.active).map((user) => <option value={user.id} key={user.id}>{user.fullName}</option>)}</select></label>
            </div>
            <button className="primary">ثبت جلسه</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function CalendarMonth({ focus, meetings, onMove }: { focus: Date; meetings: Meeting[]; onMove: (meetingId: string, date: string) => void }) {
  const year = focus.getFullYear();
  const month = focus.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 1) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  return (
    <div className="calendar-grid">
      {weekdays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
      {Array.from({ length: 42 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        const dayMeetings = meetings.filter((meeting) => sameLocalDay(new Date(meeting.startAt), day));
        return (
          <div className={`calendar-day ${day.getMonth() !== month ? "dim" : ""} ${sameLocalDay(day, new Date()) ? "today" : ""}`} key={day.toISOString()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onMove(event.dataTransfer.getData("text/plain"), localDateValue(day))}>
            <span className="day-number">{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(day)}</span>
            {dayMeetings.slice(0, 3).map((meeting) => <MeetingPill key={meeting.id} meeting={meeting} />)}
            {dayMeetings.length > 3 ? <span className="muted small">+{fa(dayMeetings.length - 3)} جلسه</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function CalendarWeek({ focus, hours, meetings, onMove }: { focus: Date; hours: number[]; meetings: Meeting[]; onMove: (meetingId: string, date: string, hour?: number) => void }) {
  const start = startOfPersianWeek(focus);
  const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  return (
    <div className="calendar-week-view">
      <div className="week-hour-rail"><span />{hours.map((hour) => <span key={hour}>{fa(hour)}:۰۰</span>)}</div>
      {weekdays.map((weekday, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return (
          <div className="week-column" key={weekday}>
            <header><span>{weekday}</span><span className="muted small">{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(day)}</span></header>
            {hours.map((hour) => {
              const slotMeetings = meetings.filter((meeting) => sameLocalDay(new Date(meeting.startAt), day) && new Date(meeting.startAt).getHours() === hour);
              return <div className="week-hour-cell" key={hour} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onMove(event.dataTransfer.getData("text/plain"), localDateValue(day), hour)}>{slotMeetings.map((meeting) => <MeetingPill key={meeting.id} meeting={meeting} />)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function CalendarDay({ focus, hours, meetings, onMove }: { focus: Date; hours: number[]; meetings: Meeting[]; onMove: (meetingId: string, date: string, hour?: number) => void }) {
  return (
    <div className="calendar-day-view">
      {hours.map((hour) => {
        const slotMeetings = meetings.filter((meeting) => sameLocalDay(new Date(meeting.startAt), focus) && new Date(meeting.startAt).getHours() === hour);
        return (
          <div className="hour-row" key={hour}>
            <div className="hour-label">{fa(hour)}:۰۰</div>
            <div className="hour-cell" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onMove(event.dataTransfer.getData("text/plain"), localDateValue(focus), hour)}>{slotMeetings.map((meeting) => <MeetingPill key={meeting.id} meeting={meeting} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

function MeetingPill({ meeting }: { meeting: Meeting }) {
  return (
    <div className="event-pill" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", meeting.id)}>
      <strong>{meeting.title}</strong>
      <span>{timeFa(meeting.startAt)} · {meeting.location || "بدون مکان"}</span>
    </div>
  );
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfPersianWeek(date: Date) {
  const start = new Date(date);
  const offset = (start.getDay() + 1) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function shiftDate(date: Date, view: CalendarView, step: number) {
  const next = new Date(date);
  if (view === "month") next.setMonth(next.getMonth() + step);
  if (view === "week") next.setDate(next.getDate() + step * 7);
  if (view === "day") next.setDate(next.getDate() + step);
  return next;
}

function calendarTitle(date: Date, view: CalendarView) {
  if (view === "day") return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "full" }).format(date);
  if (view === "week") {
    const start = startOfPersianWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(start)} تا ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short", year: "numeric" }).format(end)}`;
  }
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(date);
}

function MeetingList({ meetings, users }: { meetings: Meeting[]; users: User[] }) {
  if (!meetings.length) return <div className="card muted">جلسه ای برای نمایش وجود ندارد.</div>;
  return <div className="list">{meetings.map((meeting) => <MeetingMini key={meeting.id} meeting={meeting} users={users} />)}</div>;
}

function MeetingMini({ meeting, users, onReschedule }: { meeting: Meeting; users: User[]; onReschedule?: (date: string) => void }) {
  return (
    <article className="card">
      <div className="row"><h3>{meeting.title}</h3><span className="chip">{dateFa(meeting.startAt, true)} تا {timeFa(meeting.endAt)}</span></div>
      <p className="muted">{meeting.location || "بدون مکان"}</p>
      <div className="chips">{meeting.members.map((id) => <span className="chip" key={id}>{users.find((user) => user.id === id)?.fullName || "کاربر"}</span>)}</div>
      {onReschedule ? <JalaliDatePicker name={`reschedule-${meeting.id}`} defaultValue={localDateValue(new Date(meeting.startAt))} onChange={onReschedule} /> : null}
    </article>
  );
}

function UsersPanel({ data, onAction }: { data: AppData; onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onAction(() => api.createUser({ fullName: String(form.get("fullName")), jobTitle: String(form.get("jobTitle")), role: String(form.get("role") || "User"), username: String(form.get("username")), password: String(form.get("password")), baleUsername: String(form.get("baleUsername")), baleChatId: String(form.get("baleChatId")) }).then(() => undefined), "کاربر ساخته شد.");
    event.currentTarget.reset();
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>افراد</h2><span className="chip">{fa(data.users.length)} نفر</span></div>
      <form className="card form-grid" onSubmit={create}><label>نام<input name="fullName" required /></label><label>جایگاه<input name="jobTitle" required /></label><label>نقش<select name="role"><option value="User">کاربر</option><option value="Admin">Admin</option></select></label><label>نام کاربری<input name="username" /></label><label>رمز عبور<input name="password" type="password" /></label><label>آیدی بله<input name="baleUsername" /></label><label>شناسه فنی بله<input name="baleChatId" /></label><button className="primary full">افزودن کاربر</button></form>
      {data.pendingUsers.filter((user) => user.status === "pending").length ? <div className="panel"><h2>در انتظار تایید</h2>{data.pendingUsers.filter((user) => user.status === "pending").map((user) => <article className="card" key={user.id}><div className="row"><div><h3>{user.fullName}</h3><p className="muted">{user.jobTitle}</p></div><span className="chip warn">در انتظار</span></div><div className="chips"><span className="chip ltr">{user.baleChatId || "-"}</span><span className="chip ltr">{user.baleUsername || "-"}</span>{user.baleProfileUrl ? <a className="chip ltr" href={user.baleProfileUrl} target="_blank">پروفایل بله</a> : null}</div><div className="actions"><button className="blue" onClick={() => onAction(() => api.approvePendingUser(user.id).then(() => undefined), "کاربر تایید شد.")}>تایید</button><button className="danger" onClick={() => onAction(() => api.rejectPendingUser(user.id).then(() => undefined), "درخواست رد شد.")}>رد</button></div></article>)}</div> : null}
      <div className="grid">{data.users.map((user) => <article className="card" key={user.id}><div className="row"><div><h3>{user.fullName}</h3><p className="muted">{user.jobTitle}</p></div><span className={user.active ? "chip ok" : "chip warn"}>{user.active ? "فعال" : "معلق"}</span></div><div className="chips"><span className="chip">{user.role}</span><span className="chip ltr">{user.baleUsername || user.baleChatId || "بدون بله"}</span>{user.baleProfileUrl ? <a className="chip ltr" href={user.baleProfileUrl} target="_blank">پروفایل</a> : null}</div><div className="actions">{!user.isCeo ? <><button onClick={() => onAction(() => api.setUserStatus(user.id, !user.active).then(() => undefined), user.active ? "کاربر معلق شد." : "کاربر فعال شد.")}>{user.active ? "تعلیق" : "فعال سازی"}</button><button className="danger" onClick={() => onAction(() => api.deleteUser(user.id).then(() => undefined), "کاربر حذف شد.")}>حذف</button></> : <span className="chip">مدیرعامل قابل حذف نیست</span>}</div></article>)}</div>
    </section>
  );
}

function AnalyticsPanel({ onAction }: { onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  useEffect(() => {
    api.analyticsOverview().then(setOverview).catch(() => undefined);
    api.smartSuggestions().then((result) => setSuggestions(result.suggestions)).catch(() => undefined);
  }, []);
  return (
    <section className="panel">
      <div className="panel-head"><h2>تحلیل و هشدارها</h2><button className="blue" onClick={() => onAction(() => api.runSmartNotifications().then(() => undefined), "هشدارهای هوشمند اجرا شد.")}>اجرای هشدارها</button></div>
      {overview ? <section className="metrics"><Metric title="همه وظایف" value={overview.totals.tasks} icon="tasks" /><Metric title="باز" value={overview.totals.openTasks} icon="clock" /><Metric title="انجام شده" value={overview.totals.doneTasks} icon="done" /><Metric title="اعلان ها" value={overview.totals.notifications} icon="alert" /></section> : <div className="card muted">گزارش در دسترس نیست.</div>}
      <div className="grid">{overview?.byUser.map((row) => <article className="card" key={row.userId}><div className="row"><h3>{row.fullName}</h3><span className="chip">{fa(row.completionRate)}٪</span></div><div className="chips"><span className="chip">کل: {fa(row.assigned)}</span><span className="chip ok">انجام: {fa(row.done)}</span><span className="chip warn">باز: {fa(row.pending)}</span></div></article>)}</div>
      <div className="list">{suggestions.map((item) => <article className="card" key={item.id}><div className="row"><h3>{item.title}</h3><span className="chip">{item.severity}</span></div><p className="muted">{item.body}</p></article>)}</div>
    </section>
  );
}

function AiSettingsPanel({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [result, setResult] = useState("");
  const [question, setQuestion] = useState("");
  useEffect(() => { api.getAiSettings().then(setSettings).catch((err) => setResult(err.message)); }, []);
  if (!settings) return <section className="panel">در حال دریافت تنظیمات هوش مصنوعی...</section>;
  async function saveAndTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.saveAiSettings({ mode: String(form.get("mode")) as AiSettings["mode"], onlineProvider: String(form.get("onlineProvider")), baseUrl: String(form.get("baseUrl")), apiKey: String(form.get("apiKey")), model: String(form.get("model")), offlineModelPath: String(form.get("offlineModelPath")), fallbackParserEnabled: form.get("fallbackParserEnabled") === "true" });
    const test = await api.testAi();
    setResult(JSON.stringify(test, null, 2));
    notify(test.ok ? "اتصال هوش مصنوعی موفق بود و پیام رسان به AI وصل شد." : "تست هوش مصنوعی موفق نبود.");
  }
  async function ask() {
    const answer = await api.askAi(question);
    setResult(answer.reply);
  }
  return (
    <form className="panel" onSubmit={saveAndTest}>
      <div className="panel-head"><h2>تنظیمات هوش مصنوعی</h2><span className="chip">{settings.mode}</span></div>
      <div className="form-grid"><label>حالت<select name="mode" defaultValue={settings.mode}><option value="online">آنلاین</option><option value="offline">آفلاین / Ollama</option></select></label><label>ارائه دهنده<select name="onlineProvider" defaultValue={settings.onlineProvider || "openrouter"}><option value="openrouter">OpenRouter</option><option value="openai-compatible">OpenAI Compatible</option><option value="ollama">Ollama</option></select></label><label>مدل<input name="model" defaultValue={settings.model || "qwen3:3b"} /></label><label className="full">نشانی پایه<input name="baseUrl" defaultValue={settings.baseUrl || "https://openrouter.ai/api/v1"} /></label><label className="full">کلید API<input name="apiKey" defaultValue={settings.apiKey ? "********" : ""} /></label><label className="full">مدل یا مسیر آفلاین<input name="offlineModelPath" defaultValue={settings.offlineModelPath || "qwen3:3b"} /></label><label>تحلیل گر جایگزین<select name="fallbackParserEnabled" defaultValue={String(settings.fallbackParserEnabled !== false)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label></div>
      <div className="actions"><button className="primary">ذخیره و تست اتصال</button></div>
      <div className="card form-grid"><label className="full">گفتگو با AI<textarea value={question} onChange={(event) => setQuestion(event.target.value)} /></label><button type="button" className="blue full" onClick={ask}>ارسال پرسش</button></div>
      {result ? <pre className="card ltr">{result}</pre> : null}
    </form>
  );
}

function MessengerSettingsPanel({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState<BaleSettings | null>(null);
  const [result, setResult] = useState("");
  useEffect(() => { api.getBaleSettings().then(setSettings).catch(() => undefined); }, []);
  if (!settings) return <section className="panel">در حال دریافت تنظیمات پیام رسان...</section>;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.saveBaleSettings({ enabled: form.get("enabled") === "true", botToken: String(form.get("botToken")), webhookUrl: String(form.get("webhookUrl")), secret: String(form.get("secret")), defaultReplyMode: String(form.get("defaultReplyMode")) });
    notify("تنظیمات پیام رسان ذخیره شد.");
  }
  async function show(work: Promise<unknown>) {
    const value = await work;
    setResult(JSON.stringify(value, null, 2));
  }
  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head"><h2>تنظیمات پیام رسان بله</h2><span className={settings.enabled ? "chip ok" : "chip warn"}>{settings.enabled ? "فعال" : "غیرفعال"}</span></div>
      <div className="form-grid"><label>فعال سازی<select name="enabled" defaultValue={String(settings.enabled)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label><label>حالت پاسخ<select name="defaultReplyMode" defaultValue={settings.defaultReplyMode}><option value="ai-assisted">پاسخ هوشمند با AI</option><option value="persian-confirmation">تایید فارسی قبل از ثبت</option><option value="persian-command-only">فقط دستور متنی</option></select></label><label className="full">توکن ربات<input name="botToken" defaultValue={settings.botToken || ""} /></label><label className="full">نشانی وب هوک<input name="webhookUrl" defaultValue={settings.webhookUrl || ""} /></label><label className="full">سرآیند محرمانه<input name="secret" defaultValue={settings.secret || ""} /></label></div>
      <div className="actions"><button className="primary">ذخیره</button><button type="button" className="blue" onClick={() => show(api.registerBaleWebhook())}>ثبت وب هوک</button><button type="button" onClick={() => show(api.testBaleSend("", "پیام تست از CEO Office AI"))}>ارسال پیام تست</button><button type="button" onClick={() => show(api.runBaleReminders())}>اجرای یادآوری جلسات</button></div>
      {result ? <pre className="card ltr">{result}</pre> : null}
    </form>
  );
}
