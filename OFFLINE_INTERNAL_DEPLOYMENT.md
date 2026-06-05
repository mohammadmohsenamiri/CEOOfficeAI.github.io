# Offline AI and Internal Static IP Phase

This document covers the final phase (`P10`) for internal/on-premise deployment.

## Current MVP Coverage

Implemented:

- Backend AI mode setting: `online` or `offline`
- Offline model path setting
- Fallback parser status
- `/api/offline/status`
- UI page: `فاز آفلاین`

Not bundled:

- Real local LLM
- GPU runtime
- Local speech-to-text
- Production Docker stack

## Internal Deployment Target

Recommended internal architecture:

```text
Users / Bale / Telegram
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

## Static IP Checklist

- Reserve static IP or internal DNS name.
- Configure HTTPS certificate.
- Put backend behind Nginx or Caddy.
- Move JSON storage to PostgreSQL.
- Configure scheduled backup.
- Store secrets outside source code.
- Restrict admin endpoints by network and role.
- Add monitoring for API health, webhook failures, and notification jobs.

## Offline AI Adapter Contract

The local model adapter should accept:

```json
{
  "text": "برای سارا تسک گزارش فروش تا فردا بساز",
  "locale": "fa-IR",
  "timezone": "Asia/Tehran",
  "schema": "intent-v1"
}
```

And return:

```json
{
  "intent": "create_task",
  "title": "گزارش فروش",
  "assignees": ["u3"],
  "dueAt": "2026-06-06T08:00:00.000Z",
  "confidence": 0.82,
  "needsConfirmation": true
}
```

## Important Rule

Offline AI must still pass through the same server-side permission guards:

- CEO direct assignment block
- CEO private task isolation
- group membership checks
- user/person matching
- confirmation before write
