"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, backendBaseUrl, loadAppData } from "@/lib/api";
import type { AiSettings, AnalyticsOverview, AppData, BaleSettings, Meeting, SmartSuggestion, Task, User } from "@/lib/types";

type PageKey = "dashboard" | "tasks" | "longterm" | "recurring" | "requests" | "meetings" | "users" | "analytics" | "ai" | "messenger";
type CalendarView = "month" | "week" | "day";

const emptyData: AppData = { users: [], pendingUsers: [], groups: [], tasks: [], recurringTasks: [], meetings: [], requests: [] };
const navItems: Array<{ key: PageKey; title: string; icon: string; adminOnly?: boolean }> = [
  { key: "dashboard", title: "داشبورد", icon: "⌂" },
  { key: "tasks", title: "کارهای جاری", icon: "✓" },
  { key: "longterm", title: "کارهای بلندمدت", icon: "∞" },
  { key: "recurring", title: "کارهای تکرارشونده", icon: "↻" },
  { key: "requests", title: "درخواست از مدیرعامل", icon: "◆" },
  { key: "meetings", title: "جلسات", icon: "□" },
  { key: "users", title: "افراد", icon: "◉", adminOnly: true },
  { key: "analytics", title: "تحلیل و هشدارها", icon: "◌", adminOnly: true },
  { key: "ai", title: "تنظیمات هوش مصنوعی", icon: "AI", adminOnly: true },
  { key: "messenger", title: "تنظیمات پیام رسان", icon: "✉", adminOnly: true }
];

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
              <span className="nav-title"><b>{item.icon}</b>{item.title}</span>
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
        <Metric title="کارهای جاری" value={current.length} />
        <Metric title="کارهای بلندمدت" value={longTerm.length} />
        <Metric title="چرخه های تکرار" value={data.recurringTasks.length} />
        <Metric title="جلسات" value={data.meetings.length} />
        <Metric title="درخواست های باز" value={pendingRequests.length} />
        <Metric title="افراد فعال" value={data.users.filter((user) => user.active).length} />
      </section>
      <section className="grid">
        <div className="panel"><div className="panel-head"><h2>کارهای نزدیک</h2><button className="blue" onClick={() => go("tasks")}>مشاهده</button></div><TaskList tasks={current.slice(0, 4)} users={data.users} /></div>
        <div className="panel"><div className="panel-head"><h2>جلسات پیش رو</h2><button className="blue" onClick={() => go("meetings")}>تقویم</button></div><MeetingList meetings={data.meetings.slice(0, 4)} users={data.users} /></div>
      </section>
    </>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return <div className="card metric"><span className="muted">{title}</span><b>{fa(value)}</b></div>;
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
    }).then(() => undefined), longTerm ? "کار بلندمدت ساخته شد." : "کار جاری ساخته شد.");
    event.currentTarget.reset();
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>{longTerm ? "کارهای بلندمدت" : "کارهای جاری"}</h2><span className="chip">{fa(tasks.length)} مورد</span></div>
      <form className="card form-grid" onSubmit={create}>
        <label>عنوان<input name="title" required /></label>
        {!longTerm ? <label>تاریخ<input name="date" type="date" defaultValue={todayInput()} required /><span className="muted small">نمایش در فهرست به تقویم جلالی تبدیل می شود.</span></label> : null}
        <label className="full">توضیحات<textarea name="description" /></label>
        <AssigneePicker users={users} />
        <button className="primary full">ثبت</button>
      </form>
      <TaskList tasks={tasks} users={users} onDelete={(id) => onAction(() => api.deleteTask(id).then(() => undefined), "کار حذف شد.")} onMove={longTerm ? undefined : (id) => onAction(() => api.moveTaskToLongTerm(id).then(() => undefined), "به بلندمدت منتقل شد.")} onAssignment={(id, status) => onAction(() => api.updateAssignment(id, status).then(() => undefined), "وضعیت ثبت شد.")} />
    </section>
  );
}

function TaskList({ tasks, users, onDelete, onMove, onAssignment }: { tasks: Task[]; users: User[]; onDelete?: (id: string) => void; onMove?: (id: string) => void; onAssignment?: (id: string, status: string) => void }) {
  if (!tasks.length) return <div className="card muted">موردی برای نمایش وجود ندارد.</div>;
  return (
    <div className="list">
      {tasks.map((task) => (
        <article className="card" key={task.id}>
          <div className="row"><div><h3>{task.title}</h3><p className="muted">{task.description || "بدون توضیح"}</p></div><span className="chip">{task.longTerm ? "بلندمدت" : dateFa(task.dueAt)}</span></div>
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
      <div className="panel-head"><h2>کارهای تکرارشونده</h2><span className="chip">{fa(data.recurringTasks.length)} چرخه</span></div>
      <form className="card form-grid" onSubmit={create}>
        <label>عنوان<input name="title" required /></label>
        <label>چرخه<select name="cycle" defaultValue="daily"><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option></select></label>
        <label>فاصله<input name="interval" type="number" min="1" defaultValue="1" /></label>
        <label>شروع<input name="date" type="date" defaultValue={todayInput()} /></label>
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
      <div className="list">{data.requests.map((request) => <article className="card" key={request.id}><div className="row"><h3>{request.title}</h3><span className="chip">{request.status}</span></div><p className="muted">{request.description || "بدون توضیح"}</p>{request.decisionReason ? <p>{request.decisionReason}</p> : null}{activeUser?.role === "CEO" ? <div className="actions"><button className="blue" onClick={() => onAction(() => api.decideCeoRequest(request.id, "accepted").then(() => undefined), "درخواست پذیرفته شد.")}>پذیرش</button><button onClick={() => onAction(() => api.decideCeoRequest(request.id, "delegated").then(() => undefined), "درخواست به کار تبدیل شد.")}>تبدیل به کار</button><button className="danger" onClick={() => onAction(() => api.decideCeoRequest(request.id, "rejected").then(() => undefined), "درخواست رد شد.")}>رد</button></div> : null}</article>)}</div>
    </section>
  );
}

function MeetingsPanel({ data, onAction }: { data: AppData; onAction: (work: () => Promise<void>, success?: string) => Promise<void> }) {
  const [view, setView] = useState<CalendarView>("month");
  const [focus, setFocus] = useState(new Date());
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const start = String(form.get("startTime") || "09:00");
    const end = String(form.get("endTime") || "10:00");
    await onAction(() => api.createMeeting({ title: String(form.get("title") || "جلسه"), location: String(form.get("location")), startAt: isoFromDateTime(date, start), endAt: isoFromDateTime(date, end), members: selectedValues(form, "members") }).then(() => undefined), "جلسه ثبت شد.");
    event.currentTarget.reset();
  }
  const days = calendarDays(focus, view);
  return (
    <section className="panel">
      <div className="panel-head"><h2>{calendarTitle(focus, view)}</h2><div className="actions"><button onClick={() => setFocus(shiftDate(focus, view, -1))}>قبلی</button><button className="blue" onClick={() => setFocus(new Date())}>امروز</button><button onClick={() => setFocus(shiftDate(focus, view, 1))}>بعدی</button></div></div>
      <div className="tabs"><button className={view === "month" ? "primary" : ""} onClick={() => setView("month")}>ماه</button><button className={view === "week" ? "primary" : ""} onClick={() => setView("week")}>هفته</button><button className={view === "day" ? "primary" : ""} onClick={() => setView("day")}>روز</button></div>
      <form className="card form-grid" onSubmit={create}><label>عنوان<input name="title" defaultValue="جلسه" /></label><label>تاریخ<input name="date" type="date" defaultValue={todayInput()} required /></label><label>شروع<input name="startTime" type="time" defaultValue="09:00" /></label><label>پایان<input name="endTime" type="time" defaultValue="10:00" /></label><label className="full">مکان یا لینک<input name="location" /></label><label className="full">اعضا<select name="members" multiple>{data.users.filter((user) => user.active).map((user) => <option value={user.id} key={user.id}>{user.fullName}</option>)}</select></label><button className="primary full">ثبت جلسه</button></form>
      <div className="calendar">
        {days.map((day) => {
          const dayMeetings = data.meetings.filter((meeting) => new Date(meeting.startAt).toDateString() === day.toDateString());
          return <article className="card day" key={day.toISOString()}><strong>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short", day: "numeric", month: "short" }).format(day)}</strong><div className="list">{dayMeetings.map((meeting) => <MeetingMini key={meeting.id} meeting={meeting} users={data.users} onReschedule={(date) => onAction(() => api.rescheduleMeeting(meeting.id, isoFromDateTime(date, meeting.startAt.slice(11, 16) || "09:00"), isoFromDateTime(date, meeting.endAt.slice(11, 16) || "10:00")).then(() => undefined), "زمان جلسه تغییر کرد.")} />)}{!dayMeetings.length ? <span className="muted small">جلسه ای ثبت نشده</span> : null}</div></article>;
        })}
      </div>
      <MeetingList meetings={data.meetings} users={data.users} />
    </section>
  );
}

function calendarDays(focus: Date, view: CalendarView) {
  const count = view === "month" ? 30 : view === "week" ? 7 : 1;
  const start = new Date(focus);
  if (view === "month") start.setDate(1);
  if (view === "week") start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: count }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
}

function shiftDate(date: Date, view: CalendarView, step: number) {
  const next = new Date(date);
  if (view === "month") next.setMonth(next.getMonth() + step);
  if (view === "week") next.setDate(next.getDate() + step * 7);
  if (view === "day") next.setDate(next.getDate() + step);
  return next;
}

function calendarTitle(date: Date, view: CalendarView) {
  const label = view === "month" ? "ماه" : view === "week" ? "هفته" : "روز";
  return `${label} ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "full" }).format(date)}`;
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
      {onReschedule ? <label>جابجایی به تاریخ<input type="date" onChange={(event) => event.target.value && onReschedule(event.target.value)} /></label> : null}
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
      {overview ? <section className="metrics"><Metric title="همه کارها" value={overview.totals.tasks} /><Metric title="باز" value={overview.totals.openTasks} /><Metric title="انجام شده" value={overview.totals.doneTasks} /><Metric title="اعلان ها" value={overview.totals.notifications} /></section> : <div className="card muted">گزارش در دسترس نیست.</div>}
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
