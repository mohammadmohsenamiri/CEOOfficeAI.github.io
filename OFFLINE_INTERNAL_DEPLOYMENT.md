# Offline AI and Internal Static IP Phase

This document covers the final phase for internal/on-premise deployment.

## Current MVP coverage

Implemented:

- Backend AI mode setting: `online/openai`, `openai-chat-compatible`, `offline`, or `disabled`.
- Offline adapter mode through `AI_PROVIDER=offline` and `AI_BASE_URL=http://your-local-adapter/...`.
- Same permission guards for UI and messenger.
- UI pages for normal tasks, long-term tasks, recurring tasks, meetings, messenger, and settings.

Not bundled:

- Real local LLM weights.
- GPU runtime.
- Local speech-to-text.
- Production Docker stack.

## Internal deployment target

Recommended internal architecture:

```text
Users / Bale / Internal Messenger
        |
Public HTTPS or internal reverse proxy
        |
Nginx / Caddy
        |
Node Backend API
        |
PostgreSQL + Redis
        |
Optional Local AI Adapter
```

## Static IP checklist

- Reserve static IP or internal DNS name.
- Configure HTTPS certificate.
- Put backend behind Nginx or Caddy.
- Move JSON storage to PostgreSQL.
- Configure scheduled backup.
- Store secrets outside source code.
- Restrict admin endpoints by network and role.
- Add monitoring for API health, webhook failures, and notification jobs.

## Offline AI adapter contract

The local model adapter can accept:

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "locale": "fa-IR",
  "timezone": "Asia/Tehran",
  "schema": "messenger-intent-v1"
}
```

It should return either plain text or JSON matching:

```json
{
  "responseText": "تسک‌های قابل مشاهده شما...",
  "action": "list_week_tasks",
  "params": {}
}
```

## Important rule

Offline AI must still pass through the same server-side permission guards:

- CEO direct assignment block if you later enable that policy.
- CEO private task isolation.
- Group and assignee visibility checks.
- User/person matching.
- Confirmation before risky write actions, if added in production.
