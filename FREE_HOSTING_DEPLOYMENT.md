# Free Online Preview Deployment

## Option A: Fullstack Preview on Render Free

Use this when you want both UI and backend API online.

1. Create a GitHub repository.
2. Put these files in the repo root or deploy the `outputs/backend` folder as the service root:
   - `server.js`
   - `package.json`
   - `render.yaml`
   - `../ceo-office-ai-coordinator-mvp.html` if keeping the current folder layout.
3. In Render, create a new Web Service from the repo.
4. Set:
   - Runtime: Node
   - Start command: `node server.js`
   - Free plan
5. After deploy, open:

```text
https://YOUR-SERVICE.onrender.com/
```

Bale webhook preview URL:

```text
https://YOUR-SERVICE.onrender.com/api/webhooks/bale
```

## Option B: Frontend-only Preview

Use GitHub Pages, Vercel, or Cloudflare Pages if you only need the UI.

Deploy:

```text
ceo-office-ai-coordinator-mvp.html
```

Limit:

The backend settings, Bale webhook, analytics, and offline settings will not work unless the backend is hosted separately.

## MVP Limitation

Render free filesystem is temporary on many setups. This preview uses JSON storage, so it is suitable for demos only. For a more stable free setup, replace `data.json` with a managed PostgreSQL provider such as Supabase or Neon.
