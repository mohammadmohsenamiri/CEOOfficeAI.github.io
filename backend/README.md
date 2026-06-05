# CEO Office AI Coordinator Backend MVP

Dependency-free Node.js backend for the Persian-first CEO Office AI Coordinator.

## Run

```bash
cd backend
node server.js
```

Backend URL:

```text
http://127.0.0.1:4188
```

## Covered phases in this corrected version

- `P0`: Persian-first output conventions, RTL UI, Jalali date picker in the frontend.
- `P1`: Users, access levels, JSON persistence, audit logs.
- `P2`: Bale / بله webhook input normalization and message storage.
- `P3`: AI-backed messenger response endpoint. General messenger answers are not hardcoded; they are generated through the configured AI adapter with access-scoped data.
- `P4`: Task CRUD, assignment actions, status actions, transfer to long-term tasks.
- `P5`: Long-term tasks as their own task type and UI page.
- `P6`: Recurring task templates and generated task instances with repetition cycles.
- `P7`: Meetings CRUD and AI-visible meeting context.
- `P8`: Messenger-executable actions for listing tasks, weekly/date queries, creating tasks, recurring tasks, and transferring tasks to long-term tasks.

## Important limits

- JSON storage is for MVP/demo only; use PostgreSQL for production.
- Bale sending is off by default. Set `BALE_SEND_REPLIES=true` and configure token/endpoint before live use.
- Messenger intelligence needs a configured AI provider. Without `AI_PROVIDER` and API key/local adapter, the backend returns a clear configuration error instead of pretending to answer with AI.
- Scheduled reminder workers and production authentication are still separate production work.

## Useful routes

```text
GET    /api/health
GET    /api/settings/ai
PUT    /api/settings/ai
GET    /api/settings/bale
PUT    /api/settings/bale
POST   /api/webhooks/bale
POST   /api/messages/ask
POST   /api/messages/parse
GET    /api/users
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/transfer-to-long-term
PATCH  /api/tasks/assignment
GET    /api/recurring-tasks
POST   /api/recurring-tasks
PATCH  /api/recurring-tasks/:id
POST   /api/recurring-tasks/:id/generate-next
GET    /api/meetings
POST   /api/meetings
GET    /api/notifications
GET    /api/audit-logs
```

Pass the active user with:

```text
X-Actor-Id: u2
```
