# CEO Office AI Frontend Next.js

این پوشه نسخه جدید frontend سامانه است که از فایل بزرگ `index.html` جدا شده و با Next.js + TypeScript پیاده سازی می شود.

## چرا جدا از backend؟

- backend فعلی در پوشه `backend` بدون تغییر باقی می ماند.
- frontend جدید را می توان جدا روی Vercel یا Render Static/Web Service منتشر کرد.
- APIها همچنان از backend فعلی خوانده می شوند.

## اجرای محلی

```bash
npm install
npm run dev
```

سپس آدرس زیر را باز کنید:

```text
http://localhost:3000
```

## تنظیم backend

فایل `.env.local` بسازید:

```text
NEXT_PUBLIC_BACKEND_URL=https://ceoofficeai-github-io.onrender.com
```

اگر backend محلی اجرا می کنید:

```text
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4188
```

## Deploy پیشنهادی

### Vercel

Root Directory:

```text
frontend-next
```

Build Command:

```text
npm run build
```

Output:

```text
.next
```

Environment Variable:

```text
NEXT_PUBLIC_BACKEND_URL=https://ceoofficeai-github-io.onrender.com
```

### Render

Root Directory:

```text
frontend-next
```

Build Command:

```text
npm install && npm run build
```

Start Command:

```text
npm run start
```

## وضعیت مهاجرت

این نسخه، migration foundation است:

- App Router
- TypeScript
- RTL layout
- Login screen
- Dashboard
- Tasks
- Long-term tasks
- Recurring tasks
- CEO requests
- Meetings overview
- Users overview
- AI settings
- Messenger settings
- اتصال به APIهای backend فعلی

مرحله بعدی باید تبدیل فرم های کامل، تقویم Jalali پیشرفته، modalها و interactionهای کامل نسخه قبلی به کامپوننت های جدا باشد.
