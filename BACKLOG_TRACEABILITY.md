# CEO Office AI Coordinator - Backlog Traceability

Source backlog:

`CEO_Office_AI_Coordinator_Backlog_v4_English_Persian_RTL_Jalali.xlsx`

## Rule

No page should pretend to be complete with mock data.

If a feature needs backend/API/Bale/AI/database and that service is not connected, the UI must show `Backend Required` instead of fake records.

## Current Implementation Status

| Phase | Name | Current Status | Notes |
| --- | --- | --- | --- |
| P0 | Persian, RTL, Jalali foundation | Partially real | UI is Persian/RTL/Jalali. Needs automated RTL/Jalali regression tests. |
| P1 | Core backend, users, roles, groups | Local MVP | Node backend has users, groups, roles, audit logs, JSON persistence. Not production auth/JWT/Postgres. |
| P2 | Bale/Telegram text bot MVP | Bale local MVP only | Bale webhook endpoint exists. Real Bale API send-message and Telegram adapter are not complete. |
| P3 | Online AI text understanding | Fallback parser only | Backend parser endpoint exists. Real online AI provider is not connected. |
| P4 | Task workflow | Local MVP | Backend task creation, multi-assignee assignment, accept/reject/done and notifications exist. |
| P5 | CEO request isolation | Local MVP | Backend blocks non-CEO direct CEO assignment and supports CEO request route. Needs deeper API tests. |
| P6 | Meetings and calendar | Local MVP | Backend meetings exist. UI has month/week/day calendar. Needs reminder scheduler. |
| P7 | Smart notifications and analytics | Local MVP | Analytics and smart suggestion endpoints exist. Needs scheduler and production reports. |
| P8 | Web dashboard and mobile app polish | Web only | Web shell exists. Mobile app is not implemented. |
| P9 | Free hosting/domain release | Artifacts only | Render/GitHub Pages docs/config exist. Backend is not deployed yet. |
| P10 | Offline AI/internal static IP | Planning/config only | Offline settings and guide exist. No local model is bundled. |

## No-Mock UI Policy Applied

The public static UI no longer silently shows local demo data for backend-dependent pages.

Backend-dependent pages now require a backend connection:

- Dashboard
- Tasks
- CEO Requests
- Meetings calendar
- Messenger and AI
- Bale bot settings
- Analytics
- Deployment settings
- Offline AI settings
- Users
- Access rules

## Backend Routes Implemented

```text
GET    /api/health
GET    /api/phase-coverage
GET    /api/settings/bale
PUT    /api/settings/bale
GET    /api/settings/ai
PUT    /api/settings/ai
GET    /api/settings/deployment
PUT    /api/settings/deployment
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
POST   /api/messages/parse
POST   /api/webhooks/bale
GET    /api/messages
GET    /api/notifications
GET    /api/audit-logs
GET    /api/analytics/overview
GET    /api/smart-notifications/suggestions
POST   /api/smart-notifications/run
GET    /api/offline/status
```

## Still Not Done

These are not mockable and must be implemented/deployed for a real product:

- Real authentication and session/JWT flow
- PostgreSQL schema and migrations
- Real Bale API outbound send-message
- Telegram webhook/adapter equivalent
- Online AI provider with strict JSON schema validation
- Reminder scheduler/worker
- Mobile app
- Production deployment and environment secrets
- Offline local AI model
- Full automated test suite for every access rule and backlog user story
