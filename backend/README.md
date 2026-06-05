# CEO Office AI Coordinator Backend MVP

This is a dependency-free local backend for the prototype.

## Run

```powershell
node C:\Users\Data\Documents\Codex\2026-06-05\files-mentioned-by-the-user-ceo\outputs\backend\server.js
```

Backend URL:

```text
http://127.0.0.1:4188
```

## Covered v4 Phases

- `P0`: Persian-first output conventions, RTL/Jalali handled in UI, Persian backend messages.
- `P1`: users, groups, CEO/Admin/Employee roles, JSON persistence, audit logs.
- `P2`: normalized Bale text webhook and message storage.
- `P3`: parser endpoint with JSON intent shape and confirmation-ready output.
- `P4`: task CRUD, multi-assignee assignments, accept/reject/done, notifications.
- `P5`: CEO request route, CEO privacy guard, direct CEO assignment block.
- `P6`: meeting CRUD, members, meeting notifications.

## Important Limits

This is a local MVP backend, not production yet:

- No real password login/JWT.
- No real Bale API send call yet.
- No online AI provider call yet; parser is rule-based fallback.
- No database server yet; data is stored in `data.json`.
- No scheduled reminder worker yet.

## Useful Routes

```text
GET    /api/health
GET    /api/settings/bale
PUT    /api/settings/bale
POST   /api/webhooks/bale
POST   /api/messages/parse
GET    /api/users
GET    /api/groups
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/assignment
GET    /api/ceo-requests
POST   /api/ceo-requests
PATCH  /api/ceo-requests/decision
GET    /api/meetings
POST   /api/meetings
GET    /api/notifications
GET    /api/audit-logs
```

Pass the active user with:

```text
X-Actor-Id: u2
```
