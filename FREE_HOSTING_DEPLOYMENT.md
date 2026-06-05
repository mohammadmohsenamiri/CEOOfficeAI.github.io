# Free Online Preview Deployment

## Option A: Fullstack preview on Render Free

Use this when you want both the UI and backend API online.

1. Create a GitHub repository.
2. Put these files in the repo root and deploy the `backend` folder as the service root:
   - `server.js`
   - `package.json`
   - `render.yaml`
   - `data.json`
3. In Render, create a Web Service from the repo.
4. Set:
   - Runtime: Node
   - Start command: `node server.js`
   - Free plan
5. Add environment variables:
   - `AI_PROVIDER=openai` or `openai-chat-compatible` or `offline`
   - `AI_MODEL=gpt-5.4-mini` or your selected model
   - `AI_API_KEY=...`
   - `BALE_BOT_TOKEN=...` if you want Bale replies
6. After deploy, open:

```text
https://YOUR-SERVICE.onrender.com/
```

Bale webhook preview URL:

```text
https://YOUR-SERVICE.onrender.com/api/webhooks/bale
```

## Option B: Frontend-only preview

Use GitHub Pages, Vercel, or Cloudflare Pages only if you need the UI preview.

Deploy:

```text
index.html
ceo-office-ai-coordinator-mvp.html
```

Limit: the backend settings, AI messenger, Bale webhook, analytics, and server-side access guards will not work unless the backend is hosted separately.

## MVP limitation

Render free filesystem can be temporary on many setups. This preview uses JSON storage and is suitable for demos. For a stable free setup, replace `data.json` with managed PostgreSQL such as Supabase or Neon.
