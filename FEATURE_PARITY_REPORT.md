# CEOOfficeAI Next.js Feature Parity Report

Date: 2026-06-07
Target: `frontend-next`
Baseline: `index.html`, `backend/server.js`, and the Excel feature audit

## Applied In This Review

- Rebuilt task pages as management tables for current, long-term, and recurring tasks.
- Added popup create/edit flows for current, long-term, and recurring tasks.
- Added searchable tag-style assignee selection with removable chips.
- Added backend update endpoints for current/long-term tasks and recurring tasks.
- Added People page user edit popup.
- Added `ورود و دسترسی ها` page for Admin/CEO users.
- Hid CEO Requests navigation from ordinary users.
- Hardened AI/Bale settings access and masked secrets in API responses.
- Confirmed Jalali picker remains in place and no native English date input exists in `frontend-next/app/page.tsx`.

## Status By Feature

| Range | Status |
| --- | --- |
| F001-F005 | Implemented/mostly implemented in Next.js. UI, Persian font, RTL, Persian task labels, and HTML-style icons are present. |
| F006-F007 | Removed from active checklist per user request. |
| F008-F011 | Implemented. AI/Messenger pages are distinct admin pages; Jalali date display and popup picker are used. |
| F012-F019 | Implemented/strongly improved. Meetings now have month/week/day views, navigation, modal creation, and drag/drop reschedule. Browser QA is still needed. |
| F020-F028 | Implemented. Current, long-term, and recurring task workflows now have create/edit/delete/status/assignee tables and backend persistence. |
| F029-F031 | Implemented in UI/backend for Admin/CEO visibility and CEO decisions. |
| F032-F043 | Implemented/mostly implemented. CEO is excluded from direct assignment, people approval and user management are present, and user edit exists. Role model still includes ordinary `User` because backend needs an ordinary access level. |
| F044-F048 | Implemented. Login/password, Bale code login, signup pending approval, page persistence, and modal Escape behavior exist. |
| F049-F057 | Implemented/backend implemented. Bale settings, webhook/test feedback, user identity mapping, reminders, and AI-assisted replies are present. Messenger command parsing remains rule-based with AI fallback. |
| F058-F064 | Implemented/configuration dependent. Online/OpenRouter/OpenAI-compatible/Ollama settings are present; actual Qwen/Ollama runtime requires target environment setup. Missing meeting time/day AI suggestion remains backend-partial. |
| F065-F068 | Implemented/partially implemented. Sensitive UI is hidden for Admin/CEO, backend guards were hardened for settings, task visibility uses backend actor filtering, dashboard and analytics are present. Analytics is still MVP. |
| F069-F076 | Implemented/configuration dependent. Render backend config and JSON persistence exist; free preview/full backend depends on deployment configuration. |
| F077 | Not implemented. Production PostgreSQL/database migration is still a future infrastructure task. |
| F078 | Not implemented. Comprehensive automated tests are still missing; local `node`/`npm` were unavailable in this environment. |
| F079-F080 | Implemented for traceability/reporting through `AGENTS.MD` and this report. |

## Remaining Non-Code Or Infrastructure Items

- F063: Install and expose `qwen3:3b` through Ollama in the target deployment environment.
- F070: Configure a real full preview host with backend and Bale webhook, not GitHub Pages alone.
- F077: Add production database support such as PostgreSQL.
- F078: Add automated test coverage and CI once Node/npm are available.

## Verification Notes

- `Select-String` confirmed no `type="date"` remains in `frontend-next/app/page.tsx`.
- Route checks confirmed backend has `PATCH /api/tasks` and `PATCH /api/recurring-tasks`.
- Build checks could not run here:
  - `node --check backend/server.js`: `Access is denied`
  - `npm run build`: `npm` command not found
