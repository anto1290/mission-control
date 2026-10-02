# Mission Control — Product & Engineering Specification (MVP)

Owner: Lead Engineer (leadenginer profile)
Status: VERIFIED v2 — re-inspected 2026-10-02 ~15:35 UTC, awaiting build approval
Date: 2026-10-02

## 0. Verification log (what actually exists today)
- `/opt/data/mission-control/` — **working skeleton already built in a prior session**:
  - `server/server.js` (582 lines, zero npm deps: node:http + node:sqlite + child_process)
  - `public/` (index.html, app.js 453 lines, style.css) — all 7 views coded
  - `package.json`, git repo initialized, **zero commits yet** (files untracked)
  - **Smoke test run today: all 9 API endpoints returned HTTP 200** on port 9121
    (`/api`, `/api/health`, `/api/dashboard`, `/api/agents`, `/api/board`,
    `/api/board/task`, `/api/calendar`, `/api/activity`, `/api/memory`, `/api/office`)
  - NOT yet supervised as an s6 service; process was killed after smoke test.
- OpenCode: **installed** — `/opt/data/.local/npm-global/bin/opencode` v1.18.34,
  config at `/opt/data/home/.config/opencode/opencode.json` → qlxion
  OpenAI-compatible provider (`https://qlxion.my.id/v1`), model
  `qlxion/cl/anthropic/claude-sonnet-4.6`. Sessions DB exists:
  `/opt/data/home/.local/share/opencode/opencode.db` (262 KB, has data).
  → The old spec's "OpenCode not installed" limitation is **outdated**.
- Services (s6, all up): `main-hermes`, `gateway-default`, `gateway-leadenginer`,
  `dashboard` (port 9119, responds 302→login).
- Kanban: root `/opt/data/kanban.db` has 2 tasks (1 done, 1 archived).
  `/opt/data/profiles/leadenginer/kanban.db` exists, 0 tasks.
- Cron: no `jobs.json` at root or leadenginer (zero jobs — honest empty state);
  ticker heartbeats present (scheduler alive).
- Memory: root `/opt/data/memories/MEMORY.md` exists (~595 chars); `USER.md`
  absent; leadenginer memories dir empty.
- Skills: `/opt/data/skills/` — 17 categories, full catalog present.
- Sessions: root `state.db` — 2 sessions, 298 messages, FTS5 enabled.
  Leadenginer `state.db` — 1 session (telegram), model FreeCombo.
- Models (from each config.yaml): default → `anthropic/claude-opus-4.6`
  (adaCODE router); leadenginer → `FreeCombo` (qlxion router).

## 1. Product Objective
A single simple web interface to observe and operate the user's Hermes-based AI
team (user → Lead Agent → Lead Engineer → OpenCode): see what every agent is
doing, manage the shared task board, review activity, and browse the team's
knowledge — with all data coming from real Hermes sources.

## 2. Main User
The owner (MUHAMMAD NURWIBAWANTO), via browser. One user, local/remote web
access. No multi-user, no SSO in MVP.

Team model (as given, no extra agents):
- **Me (user)** — the principal.
- **Lead Agent** = Hermes `default` profile (gateway-default, main-hermes):
  overall objective & coordination.
- **Lead Engineer** = Hermes `leadenginer` profile (gateway-leadenginer):
  product requirements, environment inspection, MVP definition, data-source
  identification, spec + acceptance criteria, implementation planning.
- **OpenCode** — external coding execution layer invoked by Lead Engineer via
  Hermes terminal/process tools (NOT a Hermes profile; a CLI process).
- No separate Product Manager agent (per requirement).

## 3. MVP Features
Views (single-page app, 30 s polling, hash routing):
1. **Dashboard** — service health (s6), gateway/platform connections, team
   at a glance.
2. **Agents** — each agent (Lead Agent, Lead Engineer, OpenCode) with role,
   model/provider from config, live/last-active state, claimed kanban tasks.
3. **Task Board** — the Hermes Kanban: columns (triage/todo/scheduled/ready/
   running/blocked/review/done), task detail (comments, links, runs, events);
   actions: create, assign, complete, schedule/unblock, comment — all via
   `hermes kanban` CLI.
4. **Activity** — unified feed: recent sessions (state.db), kanban
   task_events, cron runs. Timestamped, most-recent-first.
5. **Memory / Knowledge** — MEMORY.md/USER.md per profile (honest empty state
   when absent), skills catalog counts, model-usage stats.
6. **Calendar** — today/week view derived from cron schedules + kanban
   "scheduled" tasks (no external calendar backend).
7. **2D Office** — top-down SVG office with 3 desks; desk color = live state
   (idle/working/blocked/down); click desk → agent detail. Positions static;
   states real.

## 4. Required Data (all verified to exist — no invented APIs)
| Source | Path / command | Used by |
|---|---|---|
| Service/agent liveness | `/command/s6-svstat /run/service/<svc>` | Dashboard, Agents, Office |
| Gateway + platform state | `<home>/gateway_state.json` (+ `channel_directory.json`) | Dashboard |
| Tasks | read-only SQL on `/opt/data/kanban.db` + `hermes kanban` CLI writes | Task Board, Agents, Office, Activity |
| Sessions/activity | read-only SQL on `<profile>/state.db` (sessions, messages, session_model_usage; timestamps UTC float-seconds ×1000) | Activity, Agents |
| Cron jobs | `<home>/cron/jobs.json` (absent ⇒ empty), `cron/output/`, ticker heartbeats | Calendar, Activity |
| Memory files | `/opt/data/memories/`, `/opt/data/profiles/leadenginer/memories/` | Memory/Knowledge |
| Skills | `/opt/data/skills/**/SKILL.md` frontmatter | Memory/Knowledge |
| Model config | per-profile `config.yaml` model block | Agents |
| OpenCode | binary + `~/.local/share/opencode/opencode.db` (session counts; spawn cost → cache) | Agents, Office |

## 5. What Hermes Already Provides (reuse, do not rebuild)
- **Task board**: Hermes Kanban — persistent shared SQLite board; Mission
  Control renders it; all writes via `hermes kanban` CLI (never direct SQL).
- **Scheduling**: `hermes cron` (Calendar + Activity sources).
- **Activity log**: session store `state.db` (+ FTS5).
- **Memory/knowledge**: MEMORY.md/USER.md + skills registry.
- **Platform health**: `gateway_state.json`, channel directory, s6 supervision.
- **Agent execution layer**: Hermes terminal/process tools driving OpenCode.
- Existing `hermes dashboard` (port 9119) stays untouched; Mission Control is
  a separate service on its own port.

## 6. What Requires Custom Implementation
1. **Mission Control service** — mostly done (skeleton at
   `/opt/data/mission-control/`, smoke-tested):
   - Backend: zero-dep Node API server, 9 GET endpoints + kanban POST
     endpoints; read-only data layer with per-source try/catch isolation.
   - Frontend: static vanilla-JS SPA, 7 views, no build step.
   - Remaining: register as s6 longrun service `mission-control` on port
     9120 (local bind + tunnel, same hardening as `dashboard`), git commit.
2. **2D office renderer** — SVG in app.js (coded; needs visual QA).
3. **Calendar view** — derived cells from cron + scheduled tasks (coded;
   currently honest-empty since zero cron jobs exist).

## 7. Acceptance Criteria
- [ ] `GET /api/health` s6 states + gateway_state.json values match reality
      at query time.
- [ ] All 7 views render real data (spot-check: board rows ==
      `hermes kanban list`; sessions == state.db).
- [ ] Task Board create → assign(leadenginer) → complete through the UI
      appears in `hermes kanban list`.
- [ ] Agents view shows default + leadenginer with correct model/provider
      from config.yaml and live up/down state; OpenCode listed with
      install/health status.
- [ ] Activity feed newest-first; kanban task event + session entry present.
- [ ] Calendar shows today's cron runs and any scheduled kanban task (empty
      state OK today).
- [ ] 2D office desks reflect current state (restart a service → desk red
      within one poll cycle).
- [ ] No file under `/opt/hermes/` modified; Mission Control runs as its own
      s6 service, starts/stops independently.
- [ ] All sources read-only except kanban writes via CLI.
- [ ] Honest empty states (cron, USER.md, leadenginer memory) — nothing
      fabricated.

## 8. Important Limitations
- **No real-time agent introspection**: "agent state" = process liveness +
  last session activity + claimed tasks, not a live heartbeat API.
- **No external calendar**: derived view only; no iCal/Google in MVP.
- **OpenCode session DB** is out of scope for deep rendering — UI shows
  installed/running + session count, not per-session content.
- **Memory/Knowledge is thin today**: root MEMORY.md ~600 chars, no USER.md,
  leadenginer empty — the view will mostly show empty states until the team
  accumulates knowledge. Correct, not a bug.
- **kanban.db concurrency**: UI reads read-only; writes only via kanban CLI
  (dispatcher claim/lock semantics preserved).
- **Single-machine scope**; WhatsApp bridge currently disconnected (does
  not affect Mission Control).
- **No auth beyond the dashboard pattern** in MVP (local bind + tunnel).
- OpenCode `session list`/`stats` can be slow (seconds) → cached, not
  per-request.

## 9. Recommended Build Order (updated with current state)
1. ~~Prereq: install OpenCode~~ — **DONE** (v1.18.34 + qlxion provider
   configured + opencode.db populated).
2. ~~Data layer~~ — **DONE + smoke-tested** (all 9 endpoints 200).
3. ~~Register s6 service~~ `mission-control` (port 9120, local bind, pattern
   of the `dashboard` service) + **git commit** the repo.
4. ~~Visual QA + polish~~ of all 7 views in a browser (endpoints verified;
   UI not yet browser-verified).
5. ~~Run the acceptance pass~~ (§7) end-to-end, including a kanban
   create/assign/complete cycle from the UI.
6. ~~Hand off~~ via tunnel URL; document the team structure in the spec.

Later, if the team grows (more profiles/roles): a dedicated Product Manager
agent as its own Hermes profile + a generic agent registry in Mission
Control (reads profiles instead of the hardcoded pair).

## Readiness
READY TO BUILD. Remaining work is steps 3–6 above: s6 registration, git
commit, browser QA, acceptance pass. No Hermes-core changes required. No new
prerequisites outstanding.
