# AGENTS.MD

## Project Context

This repository contains the CEOOfficeAI task management service. The original implementation is an HTML application (`index.html` and related backend code). The migration target is the Next.js application in `frontend-next`.

The migration goal is feature parity with the HTML version, not a visual or functional redesign. Before changing `frontend-next`, compare against the HTML implementation and the Excel feature audit supplied by the user:

- Source workbook: `C:\Users\Data\Downloads\CEOOfficeAI_Feature_Audit_EN_Acceptance_Criteria.xlsx`
- Target folder: `frontend-next`
- Primary HTML baseline: `index.html`
- Backend baseline: `backend/server.js`

## Migration Rules

- Preserve the Persian RTL product experience from the HTML version.
- Keep visible UI labels Persian-localized and avoid leaking English API terms such as `task` into the end-user UI.
- Use the backend APIs already present in `backend/server.js`; do not replace real flows with mock-only UI.
- Sensitive pages/actions must be hidden in the frontend and protected by backend authorization.
- Jalali calendar/date picker behavior must be consistent across tasks, recurring tasks, meetings, filters, and reports.
- Bale messenger and AI settings are core product features, not optional placeholders.
- Ordinary users should see only their own allowed work; Admin/CEO users get broader management views.
- The CEO must not be directly assignable through normal task assignment; CEO requests are the proper path.
- Do not hardcode secrets. Admin credentials and AI/Bale keys must come from environment/configuration.

## Extracted Feature Checklist From Workbook

| ID | Domain | Feature | HTML Status | Acceptance Focus |
| --- | --- | --- | --- | --- |
| F001 | Visual design and user experience | Redesign the user interface to resemble the Manus sample and use a professional theme | Implemented | Layout, spacing, colors, cards, navigation, modals, desktop/mobile polish |
| F002 | Visual design and user experience | Use a suitable Persian font / Manus-like font | Partially implemented | Persian font loads, fallback readable, no clipping |
| F003 | RTL and Persian localization | Fully right-align menus, text, and layouts | Implemented | RTL menus, cards, forms, modals, tables, icons, arrows, empty states |
| F004 | RTL and Persian localization | Persian-localize all labels and remove the word "task" from the UI | Implemented | Persian visible labels; English "task" absent from production UI |
| F005 | Icons | Use icons for all menu items and cards | Implemented | Consistent icons for menu items, dashboard cards, action cards, major entries |
| F008 | Separate Messenger and AI pages | Reduce unused Messenger / AI pages | Partially implemented | Messenger/AI pages have clear purpose or are merged/hidden |
| F009 | Jalali calendar | Use the Jalali calendar in all sections | Implemented | Jalali dates in tasks, recurring tasks, meetings, dashboard, filters, reports |
| F010 | Jalali Date Picker | Use a dedicated Jalali Date Picker instead of the Gregorian date picker | Implemented | Every date input uses Jalali picker and saves/reopens correctly |
| F011 | Date Picker popup | Display the Date Picker as a pop-up rather than inside the form | Implemented | Popup near field; closes on outside click/Escape; no modal layout break |
| F012 | Meetings | Meeting calendar similar to Google Calendar | Partially implemented | Usable month/week/day views, create/edit, correct placement |
| F013 | Meetings | Daily, weekly, and monthly meeting views | Implemented | Switch views; correct ranges, counts, placement |
| F014 | Meetings | Navigation to previous/next day, week, and month | Implemented | Navigation updates visible range/title while preserving view |
| F015 | Meetings | Date selection alongside Today/Tomorrow/Day after tomorrow/Next week | Implemented | Manual Jalali picking plus presets store expected dates |
| F016 | Meetings | Move a meeting/calendar item by dragging between days or hours | Implemented | Drag updates UI and persists schedule |
| F017 | Meetings | New meeting form as a modal/popup | Implemented | Meeting form opens as modal; validates and saves |
| F018 | Meetings | Meeting form should only have date, start time, and end time | Implemented | Scheduling fields limited to date/start/end; start before end |
| F019 | Meetings | Fix broken styling on the Meetings page | Partially implemented | No spacing, overlap, hidden button, or unreadable-text regressions |
| F020 | Current tasks | Create a current task with title, description, date, and assignees | Implemented | Create, show correct users, persist after refresh |
| F021 | Current tasks | Tasks should require only a date, with time removed | Implemented | Date required; no time field in UX |
| F022 | Current tasks | Delete tasks | Implemented | Authorized deletion; UI/backend removal; unauthorized blocked |
| F023 | Current tasks | Transfer a current task to long-term tasks | Implemented | Removes date, sets long-term, preserves data/history |
| F024 | Long-term tasks | Separate page for long-term tasks without dates | Implemented | Own page, only undated long-term tasks |
| F025 | Long-term tasks | Create a long-term task from the UI with title, description, and assigned people | Implemented | Create long-term item with no due date |
| F026 | Recurring tasks | Separate page for recurring tasks | Implemented | Own page with create/edit/delete for recurrence definitions |
| F027 | Recurring tasks | Create daily/weekly/monthly recurrence cycles | Implemented | Select/save/display/edit cycles and next run |
| F028 | Recurring tasks | Generate scheduled tasks based on the recurrence cycle | Implemented | Recurrence job creates correct non-duplicate scheduled tasks |
| F029 | CEO requests | CEO request page | Implemented | Real requests load, submit where applicable, status visible |
| F030 | CEO requests | Only the CEO/Admin should see requests and make decisions | Partially implemented | Decision interface/menu only Admin/CEO; requester visibility intentional |
| F031 | CEO requests | Accept, reject, or convert a request into a task | Implemented | Decisions saved and conversion linked to created task |
| F032 | CEO rules | Do not allow direct task assignment to the CEO | Implemented | UI excludes CEO and backend rejects direct CEO assignment |
| F033 | People | People page for approving new Bale users and adding users manually | Implemented | Admin/CEO approve/reject pending users and create manual users |
| F034 | People | Add a new user to pending approval after their first Bale message | Implemented | Unknown Bale message creates pending approval record |
| F035 | People | If an unknown user sends a message, ask for their name and position | Implemented | Unknown Bale user gets prompt; response stored for review |
| F036 | People | Show the Bale ID beside name and position for admin review | Implemented | Cards show name, position, Bale ID/chat ID/username |
| F037 | People | Link to the Bale profile for identity review | Implemented | Clickable Bale profile links with graceful missing-username handling |
| F038 | People | Delete user | Implemented | Authorized delete for non-CEO users; CEO protected |
| F039 | People | Suspend/activate user accounts | Implemented | Admin/CEO suspend/reactivate; suspended users blocked |
| F040 | People | Edit user | Implemented | Edit profile, Bale info, username/password fields as allowed |
| F041 | People | Remove default sample users | Implemented | Sample users absent unless explicitly enabled |
| F042 | Roles | Only two predefined system roles should exist: Admin and CEO | Partially implemented | Role model clear; no conflicting role labels/permissions |
| F043 | Roles | Everyone can see assignable roles/people except the CEO | Implemented | Assignable lists exclude CEO and backend enforces |
| F044 | Authentication | Bale-based login page with code delivery | Implemented | Request Bale code, receive through bot, login, reject failed/expired |
| F045 | Authentication | Login with username and password | Implemented | Env credentials honored; wrong credentials rejected |
| F046 | Authentication | Account creation with pending admin approval | Implemented | Signup creates pending user requiring approval |
| F047 | Authentication | Keep the current page after refresh | Implemented | Refresh preserves active page safely |
| F048 | Modal UX | Close modals with Escape | Implemented | Escape closes modals/date pickers without errors |
| F049 | Messenger settings | Add Bale bot / messenger settings to the UI | Implemented | Required Bale fields save, secrets masked, reload works |
| F050 | Messenger settings | Make Bale connection test buttons provide feedback | Implemented | Send-test/webhook test results show success/error feedback |
| F051 | Bale | Real Bale webhook for receiving messages | Implemented | Webhook receives/validates/maps users/responds cleanly |
| F052 | Bale | Identify Bale users by chat id and @username | Implemented | Chat ID and username matching avoids wrong user links |
| F053 | Bale | Automatically connect chat id when @username matches | Implemented | Recognized username stores chat ID after first message |
| F054 | Bale | Execute current, long-term, and recurring task operations from the messenger | Partially implemented | Messenger can create/view/update/transfer/manage tasks or clarify |
| F055 | Bale | Respond to general requests through AI rather than fixed code | Partially implemented | General questions use AI; protected actions keep permission checks |
| F056 | Bale | Send tomorrow's meetings to people who have meetings | Implemented | Reminder job sends correct meeting summary only to relevant users |
| F057 | Bale | One-hour-before meeting reminder with AI-generated text | Implemented | Detects next-hour meetings, sends once, avoids duplicates |
| F058 | Online AI | Ability to configure the online model from the UI | Implemented | Online mode/provider/model/API settings save and display |
| F059 | Online AI | Test online model connection and automatically connect messenger to AI | Implemented | Test success/failure feedback; AI-assisted enabled only after success |
| F060 | Online AI | Detailed training prompt for the model based on system rules | Implemented | Prompt includes roles, CEO rules, tasks, meetings, language, safety |
| F061 | Online AI | Support OpenAI-compatible/OpenRouter providers | Implemented | Configurable base URL/model/API key including `/v1` handling |
| F062 | Offline AI | Ability to configure Ollama + Qwen3:3b in the UI | Implemented | Ollama/Qwen selectable; backend calls configured endpoint |
| F063 | Offline AI | Use the Ollama + Qwen 3B model | Requires configuration/deployment | Target environment has qwen3:3b installed and reachable |
| F064 | Meeting AI | If the meeting time/day is not specified, AI should suggest a suitable time | Partially implemented | Missing day/time triggers AI suggestion and confirmation workflow |
| F065 | Access control | Sensitive menus should only be shown to Admin or CEO | Implemented | Sensitive pages/actions hidden and backend rejects unauthorized |
| F066 | Access control | Each user should see only their own tasks, while admin sees all tasks | Implemented | User-specific task/recurring visibility; Admin sees all |
| F067 | Dashboard | Overview of tasks, meetings, and requests | Implemented | Dashboard shows real accurate summaries |
| F068 | Analytics and alerts | Smart analytics and alerts page | Partially implemented | Meaningful real metrics, alerts, empty states |
| F069 | Deployment | Deploy backend on Render and fix binding to 0.0.0.0 | Implemented | Backend responds publicly; frontend connects without CORS/network errors |
| F070 | Deployment | Free online preview with backend and bot | Requires configuration/deployment | Preview includes frontend plus backend/bot on supported host |
| F071 | GitHub | Work on the GitHub repo and push to master | Implemented | Intended repo changes committed and pushed |
| F072 | GitHub Pages | Build a GitHub Page for the complete system with backend | Not implemented | Docs clearly explain GitHub Pages static-only limitation |
| F073 | Admin security | Put the default admin password inside the code | Not implemented | No hardcoded admin password or committed secrets |
| F074 | Admin security | Read ADMIN_USERNAME and ADMIN_PASSWORD from Render | Implemented | Environment variables override development defaults safely |
| F075 | Real backend | Remove mock pages and use the real backend | Partially implemented | Mock disabled in production; pages use real endpoints or backend gate |
| F076 | Persistence | Store data in the backend | Implemented | Data persists for tasks, users, meetings, requests, settings, recurrence |
| F077 | Production database | Use a production database such as PostgreSQL | Not implemented | PostgreSQL or production DB integration with schema/migrations |
| F078 | Automated testing | Comprehensive automated tests for all user stories | Not implemented | Repeatable tests cover permissions, APIs, Bale, AI, frontend interactions |
| F079 | Product quality | Full traceability from backlog to implementation | Partially implemented | Every backlog item maps to status/evidence/risk/acceptance criteria |
| F080 | Final report | Complete list of requested capabilities with status in Excel | Implemented | Reviewable report contains capability list, status, evidence, risks |

## Expected Deliverables For This Migration Pass

- Update `frontend-next` toward HTML feature parity.
- Keep this `AGENTS.MD` current when requirements discovered from the workbook affect implementation.
- Produce a feature-by-feature status report for `frontend-next`, using the workbook IDs.
- Mention any features that remain backend-only, deployment-only, configuration-only, or not implemented.
