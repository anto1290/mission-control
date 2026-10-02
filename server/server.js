#!/usr/bin/env node
/**
 * Mission Control — standalone read-mostly API for the Hermes AI team.
 *
 * Architecture (per approved spec):
 *   - Zero external npm dependencies (Node stdlib only: http, child_process,
 *     node:sqlite, fs).
 *   - Read-only aggregation over real Hermes data sources:
 *       s6 service supervision, gateway_state.json, state.db, kanban.db,
 *       cron jobs.json, memory files, skills.
 *   - Kanban writes go through `hermes kanban` CLI (keeps lock semantics
 *     consistent with the dispatcher); everything else is read-only.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.MC_PORT || 9120);
const HOST = process.env.MC_HOST || '0.0.0.0';
const ROOT = '/opt/data';
const VENV_HERMES = '/opt/hermes/.venv/bin/hermes';

/** Profiles we manage. 'default' = Lead Agent, 'leadenginer' = Lead Engineer. */
const PROFILES = [
  { name: 'default', label: 'Lead Agent', home: ROOT },
  { name: 'leadenginer', label: 'Lead Engineer', home: path.join(ROOT, 'profiles', 'leadenginer') },
];

/** Hermes s6 service names that are always present. */
const SERVICES = ['main-hermes', 'gateway-default', 'gateway-leadenginer', 'dashboard'];

const S6_SVSTAT = '/command/s6-svstat';
const S6_SVC = '/command/s6-svc';

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

// ---------------------------------------------------------------------------
// s6 service state
// ---------------------------------------------------------------------------

function serviceState(name) {
  // svstat prints e.g. "up (pid 2657 pgid 2657) 1518 seconds" or
  // "down (exitcode 1) 0 seconds, normally up, want up, ready 0 seconds".
  // A service that was created but never started reports "down (not started yet)".
  const out = safe(() => execFileSync(S6_SVSTAT, [`/run/service/${name}`], { encoding: 'utf8' }).trim(), '');
  if (out === '') {
    return { name, present: false, state: 'not-supervised', pid: null, seconds: null };
  }
  const up = /^up \(pid (\d+) pgid \d+\) (\d+) seconds/i.test(out);
  const mUp = out.match(/^up \(pid (\d+) pgid \d+\) (\d+) seconds/i);
  const mDown = out.match(/^down \((?:exitcode (\d+)|not started yet)\)/i);
  let state;
  if (up) state = 'up';
  else if (mDown && mDown[1]) state = 'down';
  else state = out.includes('not started yet') ? 'down' : 'down';
  // s6 can pause a service ("up (...), paused").
  if (/paused/i.test(out)) state = state + '-paused';
  return {
    name,
    present: true,
    state,
    pid: mUp ? Number(mUp[1]) : null,
    seconds: mUp ? Number(mUp[2]) : null,
    raw: out,
  };
}

// ---------------------------------------------------------------------------
// Gateway / platform state (real JSON files, written by the gateways)
// ---------------------------------------------------------------------------

function gatewayState(profile) {
  const f = path.join(profile.home, 'gateway_state.json');
  return safe(() => JSON.parse(fs.readFileSync(f, 'utf8')), null);
}

// ---------------------------------------------------------------------------
// Sessions (per-profile state.db, read-only)
// ---------------------------------------------------------------------------

function openDb(file, readOnly = true) {
  return safe(() => new DatabaseSync(file, readOnly ? { readOnly: true } : {}), null);
}

function recentSessions(profile, limit = 10) {
  const db = openDb(path.join(profile.home, 'state.db'));
  if (!db) return { sessions: [], error: 'state.db not readable' };
  try {
    const rows = db.prepare(`
      SELECT id, source, chat_id, display_name, title, model,
             started_at, ended_at, message_count, api_call_count,
             estimated_cost_usd, handoff_state
      FROM sessions
      ORDER BY COALESCE(ended_at, started_at) DESC
      LIMIT ?
    `).all(limit);
    return { sessions: rows.map(r => ({
      ...r,
      started_at_iso: r.started_at ? new Date(r.started_at * 1000).toISOString() : null,
      ended_at_iso: r.ended_at ? new Date(r.ended_at * 1000).toISOString() : null,
      open: r.ended_at === null,
    })), error: null };
  } finally { db.close(); }
}

function sessionStats(profile) {
  const db = openDb(path.join(profile.home, 'state.db'));
  if (!db) return null;
  try {
    const total = db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c;
    const open = db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE ended_at IS NULL').get().c;
    const msgs = db.prepare('SELECT COUNT(*) AS c FROM messages').get().c;
    const cost = db.prepare('SELECT COALESCE(SUM(estimated_cost_usd),0) AS c FROM sessions').get().c;
    const last = db.prepare('SELECT MAX(COALESCE(ended_at, started_at)) AS c FROM sessions').get().c;
    return { sessions_total: total, sessions_open: open, messages_total: msgs, estimated_cost_usd: cost, last_activity_ts: last };
  } finally { db.close(); }
}

// ---------------------------------------------------------------------------
// Kanban (shared board). Reads: read-only SQL. Writes: hermes CLI.
// ---------------------------------------------------------------------------

function kanbanTasks() {
  const db = openDb(path.join(ROOT, 'kanban.db'));
  if (!db) return { tasks: [], error: 'kanban.db not readable' };
  try {
    const rows = db.prepare(`
      SELECT t.id, t.title, t.status, t.assignee, t.priority,
             t.created_at, t.started_at, t.completed_at,
             (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS n_comments,
             (SELECT COUNT(*) FROM task_runs r WHERE r.task_id = t.id) AS n_runs
      FROM tasks t
      ORDER BY
        CASE t.status
          WHEN 'running' THEN 0 WHEN 'ready' THEN 1 WHEN 'triage' THEN 2
          WHEN 'todo' THEN 3 WHEN 'blocked' THEN 4 WHEN 'scheduled' THEN 5
          WHEN 'review' THEN 6 ELSE 7
        END,
        t.priority DESC, t.created_at DESC
    `).all();
    return { tasks: rows.map(r => ({
      ...r,
      created_at_iso: r.created_at ? new Date(r.created_at * 1000).toISOString() : null,
    })), error: null };
  } finally { db.close(); }
}

function kanbanTaskDetail(id) {
  const db = openDb(path.join(ROOT, 'kanban.db'));
  if (!db) return null;
  try {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!t) return null;
    t.comments = db.prepare('SELECT id, author, body, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at ASC').all(id)
      .map(c => ({ ...c, created_at_iso: c.created_at ? new Date(c.created_at * 1000).toISOString() : null }));
    t.events = db.prepare('SELECT id, kind, payload, created_at FROM task_events WHERE task_id = ? ORDER BY created_at DESC LIMIT 50').all(id)
      .map(e => ({ ...e, created_at_iso: e.created_at ? new Date(e.created_at * 1000).toISOString() : null }));
    t.runs = db.prepare('SELECT id, profile, step_key, status, worker_pid, started_at, ended_at, outcome, summary FROM task_runs WHERE task_id = ? ORDER BY id DESC LIMIT 20').all(id)
      .map(r => ({ ...r, started_at_iso: r.started_at ? new Date(r.started_at * 1000).toISOString() : null, ended_at_iso: r.ended_at ? new Date(r.ended_at * 1000).toISOString() : null }));
    t.links = db.prepare(`
      SELECT parent_id, child_id FROM task_links WHERE parent_id = ? OR child_id = ?
    `).all(id, id);
    return t;
  } finally { db.close(); }
}

function runKanbanCli(args) {
  // Writes go through the official CLI so dispatcher lock/claim semantics hold.
  const r = spawnSync(VENV_HERMES, ['kanban', ...args], { encoding: 'utf8', timeout: 60000 });
  return {
    ok: r.status === 0,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    exit: r.status,
  };
}

// ---------------------------------------------------------------------------
// Cron jobs (<home>/cron/jobs.json — may not exist until first job is created)
// ---------------------------------------------------------------------------

function cronJobs(profile) {
  const f = path.join(profile.home, 'cron', 'jobs.json');
  const jobs = safe(() => JSON.parse(fs.readFileSync(f, 'utf8')), null);
  if (jobs) return jobs;
  return [];
}

// ---------------------------------------------------------------------------
// Memory / knowledge
// ---------------------------------------------------------------------------

function memoryFiles(profile) {
  const out = { memory_md: null, user_md: null };
  for (const dir of [profile.home, path.join(profile.home, 'memories')]) {
    out.memory_md = out.memory_md ?? safe(() => fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8'), null);
    out.user_md = out.user_md ?? safe(() => fs.readFileSync(path.join(dir, 'USER.md'), 'utf8'), null);
  }
  return out;
}

function skillsCatalog() {
  const base = path.join(ROOT, 'skills');
  const cats = safe(() => fs.readdirSync(base).filter(n => fs.statSync(path.join(base, n)).isDirectory()), []);
  const skills = [];
  for (const c of cats) {
    for (const d of safe(() => fs.readdirSync(path.join(base, c)), [])) {
      const sk = path.join(base, c, d, 'SKILL.md');
      if (!safe(() => fs.existsSync(sk), false)) continue;
      const text = safe(() => fs.readFileSync(sk, 'utf8'), '');
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      let name = d, description = '';
      if (fm) {
        const nm = fm[1].match(/^name:\s*(.+)$/m);
        const dm = fm[1].match(/^description:\s*"?([\s\S]*?)"?\s*$/m);
        if (nm) name = nm[1].trim();
        if (dm) description = dm[1].trim().replace(/^"|"$/g, '');
      }
      skills.push({ category: c, name, description });
    }
  }
  return { count: skills.length, skills };
}

// ---------------------------------------------------------------------------
// OpenCode (coding execution layer)
// ---------------------------------------------------------------------------

function opencodeStatus() {
  const bin = '/opt/data/.local/npm-global/bin/opencode';
  const present = safe(() => fs.existsSync(bin), false);
  let version = null;
  if (present) version = safe(() => execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim(), null);
  let config = null;
  const cfg = '/opt/data/home/.config/opencode/opencode.json';
  if (safe(() => fs.existsSync(cfg), false)) config = safe(() => JSON.parse(fs.readFileSync(cfg, 'utf8')), null);
  // running sessions: opencode keeps a session DB; list them (bounded).
  let sessions = [];
  if (present) {
    const r = safe(() => spawnSync(bin, ['session', 'list'], { encoding: 'utf8', timeout: 20000 }), null);
    if (r && r.status === 0 && r.stdout) {
      const lines = r.stdout.split('\n').filter(l => l.startsWith('ses_'));
      sessions = lines.map(l => {
        const m = l.match(/^(\S+)\s+(\S+)\s+(\d+\.\d{4}:\d{2}\s+\w{2})/);
        return m ? { id: m[1], title: m[2], updated: m[3] } : { id: l.trim() };
      });
    }
  }
  return { present, version, config_model: config && config.model ? config.model : null, sessions, running: false /* no pid tracking in MVP */ };
}

// ---------------------------------------------------------------------------
// Aggregated agent model
// ---------------------------------------------------------------------------

function buildAgents() {
  const agents = PROFILES.map(p => {
    const svc = serviceState(`gateway-${p.name === 'default' ? 'default' : p.name}`);
    const gw = gatewayState(p);
    const stats = sessionStats(p);
    const cfg = safe(() => {
      const y = fs.readFileSync(path.join(p.home, 'config.yaml'), 'utf8');
      const prov = y.match(/^model:\n(?:\s+\S+:\s*\S+\n)*?\s+provider:\s*(\S+)/m);
      const def = y.match(/^model:\n(?:\s+\S+:\s*\S+\n)*?\s+default:\s*(\S+)/m);
      return { provider: prov ? prov[1] : null, default_model: def ? def[1] : null };
    }, null);
    const mem = memoryFiles(p);
    return {
      name: p.name,
      label: p.label,
      role: p.name === 'default' ? 'Overall objective & coordination' : 'Product spec, environment inspection, MVP & planning',
      service: svc,
      gateway: gw ? { state: gw.gateway_state, active_agents: gw.active_agents, platforms: gw.platforms, updated_at: gw.updated_at } : null,
      sessions: stats,
      model: cfg,
      memory: { has_memory_md: !!mem.memory_md, has_user_md: !!mem.user_md },
    };
  });

  // OpenCode is not a Hermes profile — it is the coding execution layer.
  const oc = opencodeStatus();
  agents.push({
    name: 'opencode',
    label: 'OpenCode',
    role: 'Repository-level coding execution (build / run / test / fix)',
    service: null,
    gateway: null,
    opencode: oc,
    sessions: null,
    model: { provider: 'qlxion router', default_model: oc.config_model },
    memory: null,
  });

  // claimed (running) tasks per assignee
  const tasks = kanbanTasks().tasks;
  for (const a of agents) {
    a.claimed_tasks = tasks.filter(t =>
      (a.name === 'opencode' ? false : t.assignee === a.name && t.status === 'running')
    ).map(t => ({ id: t.id, title: t.title }));
    a.open_tasks = a.name === 'opencode' ? 0 :
      tasks.filter(t => t.assignee === a.name && !['done', 'archived'].includes(t.status)).length;
  }
  return agents;
}

// ---------------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveStatic(res, urlPath) {
  let p = urlPath === '/' ? '/index.html' : urlPath;
  const full = path.join(__dirname, '..', 'public', p);
  if (!full.startsWith(path.join(__dirname, '..', 'public'))) return json(res, 403, { error: 'forbidden' });
  fs.readFile(full, (err, data) => {
    if (err) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

const routes = {
  // ---- GET ----
  'GET /api/health': () => ({
    ts: new Date().toISOString(),
    services: SERVICES.map(serviceState),
    hermes_cli: safe(() => ({ ok: true }), { ok: false }),
  }),
  'GET /api/dashboard': () => {
    const services = SERVICES.map(serviceState);
    const gw = gatewayState(PROFILES[0]); // root gateway_state.json (default profile)
    const perProfile = PROFILES.map(p => ({
      name: p.name,
      gateway_state: safe(() => gatewayState(p)),
      channel_directory: safe(() => JSON.parse(fs.readFileSync(path.join(ROOT, 'channel_directory.json'), 'utf8'))),
    }));
    const tasks = kanbanTasks();
    const byStatus = {};
    for (const t of tasks.tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    return {
      ts: new Date().toISOString(),
      services,
      platforms: gw && gw.platforms ? Object.entries(gw.platforms).map(([k, v]) => ({ platform: k, state: v.state, error_code: v.error_code, updated_at: v.updated_at })) : [],
      task_counts_by_status: byStatus,
      task_total: tasks.tasks.length,
      opencode: opencodeStatus(),
      session_totals: PROFILES.map(p => ({ profile: p.name, stats: sessionStats(p) })),
      channel_directory: safe(() => JSON.parse(fs.readFileSync(path.join(ROOT, 'channel_directory.json'), 'utf8')), null),
      per_profile: perProfile,
    };
  },
  'GET /api/agents': () => ({ agents: buildAgents() }),
  'GET /api/board': () => kanbanTasks(),
  'GET /api/board/task': (req, res, url) => {
    const t = kanbanTaskDetail(url.searchParams.get('id'));
    return t || { error: 'task not found' };
  },
  'GET /api/calendar': () => {
    const crons = PROFILES.map(p => ({ profile: p.name, jobs: cronJobs(p) }));
    const tasks = kanbanTasks().tasks;
    return {
      ts: new Date().toISOString(),
      cron_jobs: crons.flatMap(c => c.jobs.map(j => ({ ...j, profile: c.profile }))),
      scheduled_tasks: tasks.filter(t => t.status === 'scheduled').map(t => ({
        id: t.id, title: t.title, assignee: t.assignee,
        body: t.body, completed_at_iso: t.completed_at ? new Date(t.completed_at * 1000).toISOString() : null,
      })),
    };
  },
  'GET /api/activity': () => {
    const items = [];
    // sessions (both profiles)
    for (const p of PROFILES) {
      const { sessions } = recentSessions(p, 10);
      for (const s of sessions) items.push({
        ts: s.ended_at_iso || s.started_at_iso, profile: p.name, kind: 'session',
        title: s.title || s.id, detail: `${s.model} · ${s.message_count ?? 0} msgs · ${s.open ? 'open' : 'closed'}`,
      });
    }
    // kanban events (newest first)
    const db = openDb(path.join(ROOT, 'kanban.db'));
    if (db) {
      try {
        const ev = db.prepare(`
          SELECT e.kind, e.payload, e.created_at, e.task_id
          FROM task_events e ORDER BY e.created_at DESC LIMIT 20
        `).all();
        for (const e of ev) items.push({
          ts: e.created_at ? new Date(e.created_at * 1000).toISOString() : null,
          profile: null, kind: 'kanban', task_id: e.task_id,
          title: `kanban:${e.kind}`, detail: e.payload ? String(e.payload).slice(0, 200) : null,
        });
      } finally { db.close(); }
    }
    // cron runs (output dir listing)
    for (const p of PROFILES) {
      const outDir = path.join(p.home, 'cron', 'output');
      const files = safe(() => fs.readdirSync(outDir).filter(f => !f.startsWith('.')), []);
      for (const f of files.slice(-10).reverse()) {
        const st = safe(() => fs.statSync(path.join(outDir, f)), null);
        items.push({
          ts: st ? new Date(st.mtimeMs).toISOString() : null,
          profile: p.name, kind: 'cron-run', title: f, detail: null,
        });
      }
      const hb = safe(() => fs.readFileSync(path.join(p.home, 'cron', 'ticker_heartbeat'), 'utf8').trim(), null);
      if (hb) items.push({
        ts: new Date(Number(hb) * 1000).toISOString(), profile: p.name,
        kind: 'cron-heartbeat', title: 'scheduler heartbeat', detail: hb,
      });
    }
    items.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    return { items: items.slice(0, 100) };
  },
  'GET /api/memory': () => {
    const perProfile = PROFILES.map(p => {
      const m = memoryFiles(p);
      return {
        profile: p.name,
        memory_md: m.memory_md,
        user_md: m.user_md,
        has_memory_md: !!m.memory_md,
        has_user_md: !!m.user_md,
      };
    });
    const skills = skillsCatalog();
    return { profiles: perProfile, skills };
  },
  'GET /api/office': () => {
    // 2D office: desks bound to live agent state.
    const agents = buildAgents();
    const desk = (a, x, y) => {
      let status = 'offline';
      if (a.opencode) {
        // OpenCode: working if running with tasks, idle if present but not running
        status = a.opencode.running && a.claimed_tasks?.length ? 'working' : (a.opencode.present ? 'idle' : 'offline');
      } else if (a.service) {
        if (a.service.state === 'up') status = a.claimed_tasks.length ? 'working' : 'idle';
        else status = 'offline';
      }
      return { name: a.name, label: a.label, x, y, status, claimed: a.claimed_tasks };
    };
    return { desks: [desk(agents[0], 12, 18), desk(agents[1], 50, 18), desk(agents[2], 88, 18)] };
  },

  // ---- POST (kanban writes via CLI) ----
  'POST /api/board/task': (req, body) => {
    const { title, body: taskBody, assignee, initial_status } = body || {};
    if (!title) return { ok: false, error: 'title required' };
    const args = ['create', String(title)];
    if (taskBody) args.push('--body', String(taskBody));
    if (assignee) args.push('--assignee', String(assignee));
    if (initial_status) args.push('--initial-status', String(initial_status));
    const r = runKanbanCli(args);
    let createdId = null;
    if (r.ok) {
      const m = r.stdout.match(/t_[0-9a-f]+/);
      if (m) createdId = m[0];
    }
    return { ok: r.ok, task_id: createdId, stdout: r.stdout, stderr: r.stderr };
  },
  'POST /api/board/task/complete': (req, body) => {
    const { id } = body || {};
    if (!id) return { ok: false, error: 'id required' };
    const r = runKanbanCli(['complete', String(id)]);
    return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
  },
  'POST /api/board/task/assign': (req, body) => {
    const { id, profile } = body || {};
    if (!id || !profile) return { ok: false, error: 'id and profile required' };
    const r = runKanbanCli(['assign', String(id), String(profile)]);
    return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
  },
  'POST /api/board/task/schedule': (req, body) => {
    const { id, reason } = body || {};
    if (!id) return { ok: false, error: 'id required' };
    const args = ['schedule', String(id)];
    if (reason) args.push(String(reason));
    const r = runKanbanCli(args);
    return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
  },
  'POST /api/board/task/unblock': (req, body) => {
    const { id, reason } = body || {};
    if (!id) return { ok: false, error: 'id required' };
    const args = ['unblock'];
    if (reason) args.push('--reason', String(reason));
    args.push(String(id));
    const r = runKanbanCli(args);
    return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
  },
  'POST /api/board/task/comment': (req, body) => {
    const { id, text, author } = body || {};
    if (!id || !text) return { ok: false, error: 'id and text required' };
    const args = ['comment'];
    if (author) args.push('--author', String(author));
    args.push(String(id), String(text));
    const r = runKanbanCli(args);
    return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const key = `${req.method} ${url.pathname.replace(/\/$/, '')}`;

  if (key.startsWith('GET /api/') && routes[key]) {
    // Wrap the handler: a failing data source must yield a 500 response,
    // never an uncaught exception that kills the whole process.
    try {
      return json(res, 200, routes[key](req, res, url));
    } catch (e) {
      console.error(`[mission-control] GET ${key} failed:`, e.message);
      return json(res, 500, { error: e.message, endpoint: key });
    }
  }
  if (key.startsWith('POST /api/')) {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'invalid json' }); }
      if (routes[key]) {
        try {
          return json(res, 200, routes[key](req, body, url));
        } catch (e) {
          console.error(`[mission-control] POST ${key} failed:`, e.message);
          return json(res, 500, { error: e.message, endpoint: key });
        }
      }
      json(res, 404, { error: 'unknown endpoint' });
    });
    return;
  }
  if (key === 'GET /api') {
    return json(res, 200, {
      endpoints: Object.keys(routes).filter(k => k.startsWith('GET')),
      service: 'mission-control', version: '0.1.0',
    });
  }
  if (req.method === 'GET' || (req.method === 'HEAD')) {
    return serveStatic(res, url.pathname);
  }
  json(res, 405, { error: 'method not allowed' });
});

// Process-level safety net: log and keep serving instead of dying.
process.on('uncaughtException', (e) => {
  console.error('[mission-control] uncaughtException (suppressed):', e && e.message);
});
process.on('unhandledRejection', (e) => {
  console.error('[mission-control] unhandledRejection (suppressed):', e && (e.message || e));
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[mission-control] listening on http://${HOST}:${PORT}`);
  });
}

module.exports = { server, buildAgents, kanbanTasks, serviceState };
