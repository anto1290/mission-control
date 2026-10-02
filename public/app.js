/* Mission Control SPA — vanilla JS, no build step, no external deps.
 * All data comes from the /api/* aggregation layer (real Hermes sources). */
'use strict';

const REFRESH_MS = 30000;
let currentView = 'dashboard';
let lastUpdated = null;

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tsFmt = iso => iso ? new Date(iso).toLocaleString() : '—';
const secFmt = s => {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  if (s < 86400) return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`;
  return `${Math.floor(s/86400)}d ${Math.floor(s%86400/3600)}h`;
};

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

function pillFor(state) {
  if (!state) return '<span class="pill off"><span class="dot"></span>unknown</span>';
  const cls = state === 'up' ? 'up' : (state === 'connected' ? 'up' : state === 'disconnected' ? 'down' : state === 'retrying' ? 'retrying' : state.includes('down') ? 'down' : 'off');
  return `<span class="pill ${cls}"><span class="dot"></span>${esc(state)}</span>`;
}

/* ============================ DASHBOARD ============================ */
async function renderDashboard(el) {
  const d = await api('/api/dashboard');
  el.innerHTML = `
    <h2>Dashboard</h2>
    <p class="desc">Team health at a glance — services, platforms, tasks, sessions.</p>
    <div class="grid cols-4" id="dash-kpis"></div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card">
        <h3>Hermes Services</h3>
        <div id="dash-services"></div>
      </div>
      <div class="card">
        <h3>Platform Connections (default gateway)</h3>
        <div id="dash-platforms"></div>
      </div>
    </div>
    <div class="grid cols-3" style="margin-top:14px">
      <div class="card"><h3>Task Board</h3><div id="dash-tasks"></div></div>
      <div class="card"><h3>OpenCode</h3><div id="dash-oc"></div></div>
      <div class="card"><h3>Sessions / Cost</h3><div id="dash-sessions"></div></div>
    </div>`;

  const up = d.services.filter(s => s.state === 'up').length;
  const open = (d.session_totals || []).reduce((a, s) => a + (s.stats?.sessions_open || 0), 0);
  $('#dash-kpis').innerHTML = `
    <div class="card"><div class="big">${up}/${d.services.length}</div><div class="small">services up</div></div>
    <div class="card"><div class="big">${d.task_total}</div><div class="small">active kanban tasks</div></div>
    <div class="card"><div class="big">${open}</div><div class="small">open sessions</div></div>
    <div class="card"><div class="big">${d.opencode.present ? (d.opencode.version || 'yes') : 'no'}</div><div class="small">opencode installed</div></div>`;

  $('#dash-services').innerHTML = d.services.map(s => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span class="mono">${esc(s.name)}</span>
      <span>${pillFor(s.state === 'up' ? 'up' : s.state)} ${s.seconds != null ? `<span class="muted mono">${secFmt(s.seconds)}</span>` : ''}</span>
    </div>`).join('');

  $('#dash-platforms').innerHTML = (d.platforms?.length ? d.platforms : []).map(p => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span>${esc(p.platform)} ${p.error_code ? `<span class="muted mono">(${esc(p.error_code)})</span>` : ''}</span>
      ${pillFor(p.state)}
    </div>`).join('') || '<div class="empty-note">No platform data available</div>';

  const counts = d.task_counts_by_status || {};
  const order = ['running','ready','triage','todo','blocked','scheduled','review'];
  $('#dash-tasks').innerHTML = order.filter(k => counts[k]).map(k =>
    `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>${esc(k)}</span><b>${counts[k]}</b></div>`
  ).join('') + (d.task_total === 0 ? '<div class="empty-note">Board is empty — create a task from the Task Board view.</div>' : `<div class="muted" style="margin-top:6px;font-size:12px">${d.task_total} total (excl. done/archived)</div>`);

  const oc = d.opencode || {};
  $('#dash-oc').innerHTML = `
    <div style="font-size:13px">Installed: <b>${oc.present ? 'yes' : '<span class="muted">no</span>'}</b></div>
    ${oc.version ? `<div class="mono muted" style="font-size:12px">v${esc(oc.version)}</div>` : ''}
    ${oc.config_model ? `<div style="font-size:12px;margin-top:6px">model: <span class="mono">${esc(oc.config_model)}</span></div>` : ''}
    <div style="font-size:12px;margin-top:6px">sessions: <b>${(oc.sessions||[]).length}</b></div>
    ${!oc.present ? '<div class="notice">Not installed — run the OpenCode prerequisite step.</div>' : ''}`;

  $('#dash-sessions').innerHTML = (d.session_totals || []).map(s => {
    const st = s.stats;
    return `
      <div style="font-size:13px;margin-bottom:8px">
        <b>${esc(s.profile)}</b>
        <div class="mono muted" style="font-size:11px">${st ? `${st.sessions_total} sessions · ${st.messages_total} msgs` : 'no state.db'}</div>
        ${st?.last_activity_ts ? `<div class="muted" style="font-size:11px">last: ${new Date(st.last_activity_ts*1000).toLocaleString()}</div>` : ''}
      </div>`;
  }).join('');
}

/* ============================ AGENTS ============================ */
async function renderAgents(el) {
  const { agents } = await api('/api/agents');
  el.innerHTML = `
    <h2>Agents</h2>
    <p class="desc">Team composition: user → Lead Agent → Lead Engineer → OpenCode.</p>
    <div class="card" style="margin-bottom:14px">
      <div class="agent-row">
        <div class="agent-avatar">👤</div>
        <div class="agent-body">
          <div class="name">You (Owner)</div>
          <div class="role">Principal — sets objectives, approves specs & builds</div>
          <div class="agent-meta"><span class="tag">human</span><span class="tag">delegates to Lead Agent</span></div>
        </div>
      </div>
    </div>
    <div class="grid cols-1" style="display:grid;gap:14px">
      ${agents.map((a, i) => agentCard(a, i)).join('')}
    </div>`;
}

function agentCard(a, i) {
  const isOC = !!a.opencode;
  const health = isOC
    ? (a.opencode.present ? '<span class="pill up"><span class="dot"></span>installed</span>' : '<span class="pill down"><span class="dot"></span>missing</span>')
    : (a.service ? pillFor(a.service.state) : '<span class="pill off"><span class="dot"></span>not supervised</span>');
  const gw = a.gateway ? `gateway: ${a.gateway.state}` : (isOC ? `config model: ${esc(a.model?.default_model || '—')}` : '');
  const sess = a.sessions ? `${a.sessions.sessions_open} open · ${a.sessions.sessions_total} total sessions` : null;
  const claimed = a.claimed_tasks?.length
    ? `<div style="margin-top:8px;font-size:12px"><b>Claimed:</b> ${a.claimed_tasks.map(t => `<span class="tag mono">${esc(t.id)}</span> ${esc(t.title)}`).join(' ')}</div>`
    : (a.open_tasks > 0 ? `<div style="margin-top:8px;font-size:12px" class="muted">${a.open_tasks} open task(s) on board</div>` : '');
  const platforms = a.gateway?.platforms
    ? `<div class="agent-meta">${Object.entries(a.gateway.platforms).map(([k,v]) => `<span class="tag">${esc(k)}: ${esc(v.state)}</span>`).join('')}</div>` : '';
  return `
    <div class="card">
      <div class="agent-row">
        <div class="agent-avatar" style="color:${['#4da3ff','#37c871','#b48cff'][i] || '#4da3ff'}">${isOC ? '⚙' : (i === 0 ? '🧭' : '🛠')}</div>
        <div class="agent-body">
          <div class="name">${esc(a.label)} <span class="tag mono">${esc(a.name)}</span></div>
          <div class="role">${esc(a.role)}</div>
          <div class="agent-meta">
            ${health}
            ${a.service?.pid ? `<span class="tag mono">pid ${a.service.pid} · ${secFmt(a.service.seconds)}</span>` : ''}
            ${a.model?.default_model ? `<span class="tag mono">${esc(a.model.provider || '')} ${esc(a.model.default_model)}</span>` : ''}
            ${a.gateway ? `<span class="tag">${a.gateway.active_agents ?? 0} active agents</span>` : ''}
          </div>
          ${platforms}
          ${sess ? `<div style="margin-top:8px;font-size:12px" class="muted">${sess}</div>` : ''}
          ${claimed}
          ${isOC && a.opencode?.sessions?.length ? `<div style="margin-top:8px;font-size:12px">opencode sessions: ${a.opencode.sessions.map(s => `<span class="tag mono">${esc(s.id)} · ${esc(s.title || '')}</span>`).join(' ')}</div>` : ''}
        </div>
      </div>
    </div>`;
}

/* ============================ TASK BOARD ============================ */
const COLS = [
  { key: 'ready', label: 'Ready' },
  { key: 'running', label: 'Running' },
  { key: 'blocked', label: 'Blocked / Scheduled' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done / Archived' },
];
function taskToCol(status) {
  if (status === 'blocked' || status === 'scheduled' || status === 'triage' || status === 'todo') return 'blocked';
  return COLS.some(c => c.key === status) ? status : null;
}

async function renderBoard(el) {
  const { tasks } = await api('/api/board');
  el.innerHTML = `
    <h2>Task Board</h2>
    <p class="desc">Shared Hermes Kanban board (real data — writes go through the kanban CLI).</p>
    <div class="inline-form">
      <input id="tb-title" placeholder="New task title" style="flex:1;min-width:220px">
      <select id="tb-assignee">
        <option value="">no assignee</option>
        <option value="leadenginer">leadenginer</option>
        <option value="default">default</option>
      </select>
      <button onclick="createTask()">Create</button>
      <button class="ghost" onclick="renderBoard($('#view-board'))">⟳</button>
    </div>
    <div class="board" id="board-cols"></div>`;
  const cols = {};
  for (const c of COLS) cols[c.key] = tasks.filter(t => taskToCol(t.status) === c.key);
  $('#board-cols').innerHTML = COLS.map(c => `
    <div class="col">
      <h4><span>${c.label}</span><span class="count">${(cols[c.key]||[]).length}</span></h4>
      ${(cols[c.key]||[]).map(t => `
        <div class="task" onclick="openTask('${esc(t.id)}')">
          <div class="t-title">${esc(t.title)}</div>
          <div class="t-meta">
            <span class="t-id">${esc(t.id)}</span>
            ${t.assignee ? `<span class="tag">${esc(t.assignee)}</span>` : ''}
            <span class="muted">${esc(t.status)}</span>
            ${t.n_comments ? `<span class="muted">💬${t.n_comments}</span>` : ''}
            ${t.n_runs ? `<span class="muted">▶${t.n_runs}</span>` : ''}
          </div>
        </div>`).join('') || '<div class="empty-note" style="font-size:11px">none</div>'}
    </div>`).join('');
}

window.createTask = async function() {
  const title = $('#tb-title').value.trim();
  if (!title) return;
  const r = await api('/api/board/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, assignee: $('#tb-assignee').value || undefined }),
  });
  if (r.ok) { $('#tb-title').value = ''; renderBoard($('#view-board')); }
  else alert('Create failed: ' + (r.stderr || r.stdout));
};

window.openTask = async function(id) {
  const t = await api(`/api/board/task?id=${encodeURIComponent(id)}`);
  const back = $('#view-board');
  const backHtml = back.innerHTML;
  back.innerHTML = `
    <div class="modal-back" onclick="if(event.target===this)this.remove()">
      <div class="modal">
        <h3>${esc(t.title)}</h3>
        <div class="m-meta">
          <span class="tag mono">${esc(t.id)}</span>
          <span class="pill ${t.status==='done'||t.status==='archived'?'up':t.status==='blocked'?'warn':'warn'}"><span class="dot"></span>${esc(t.status)}</span>
          ${t.assignee ? `<span class="tag">assignee: ${esc(t.assignee)}</span>` : '<span class="tag">unassigned</span>'}
          <span class="tag">${esc(t.created_at_iso || '')}</span>
        </div>
        ${t.body ? `<div style="white-space:pre-wrap;font-size:13px;margin:8px 0">${esc(t.body)}</div>` : ''}
        <section><h4>Comments (${t.comments.length})</h4>
          ${t.comments.map(c => `<div class="comment"><div class="c-meta mono">${esc(c.author)} · ${tsFmt(c.created_at_iso)}</div>${esc(c.body)}</div>`).join('') || '<div class="muted" style="font-size:12px">no comments</div>'}
        </section>
        ${t.runs.length ? `<section><h4>Runs (${t.runs.length})</h4>${t.runs.map(r => `<div class="tag mono" style="margin:2px">${esc(r.id)} · ${esc(r.status)} · ${esc(r.profile||'')}</div>`).join('')}</section>` : ''}
        ${t.events.length ? `<section><h4>Events (${t.events.length})</h4><div class="mono muted" style="font-size:11px;max-height:140px;overflow:auto">${t.events.map(e => `<div>${esc(e.created_at_iso||'')} · ${esc(e.kind)} ${e.payload ? esc(String(e.payload).slice(0,120)) : ''}</div>`).join('')}</div></section>` : ''}
        <div class="m-actions">
          <button class="primary" onclick="actTask('${esc(t.id)}','complete','')">Complete</button>
          <button onclick="actTask('${esc(t.id)}','assign','leadenginer')">Assign → leadenginer</button>
          <button onclick="actTask('${esc(t.id)}','assign','default')">Assign → default</button>
          <button onclick="actTask('${esc(t.id)}','schedule','by owner')">Schedule</button>
          <button onclick="actTask('${esc(t.id)}','unblock','')">Unblock</button>
          <button onclick="promptComment('${esc(t.id)}')">Comment</button>
          <button class="ghost" style="margin-left:auto" onclick="closeTask()">< Esc>Close</button>
        </div>
      </div>
    </div>`;
  window._backHtml = backHtml;
};

window.promptComment = function(id) {
  const text = prompt('Comment:');
  if (text) actTask(id, 'comment', text, 'user');
};

window.closeTask = function() {
  const back = $('#view-board');
  back.innerHTML = window._backHtml || '';
  renderBoard(back);
};

window.actTask = async function(id, action, arg, author) {
  const ep = action === 'complete' ? '/api/board/task/complete'
           : action === 'assign' ? '/api/board/task/assign'
           : action === 'schedule' ? '/api/board/task/schedule'
           : action === 'unblock' ? '/api/board/task/unblock'
           : '/api/board/task/comment';
  const body = { id };
  if (action === 'assign') body.profile = arg;
  if (action === 'schedule') body.reason = arg;
  if (action === 'unblock') body.reason = arg;
  if (action === 'comment') { body.text = arg; body.author = author || 'user'; }
  const r = await api(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) alert('Action failed: ' + (r.stderr || r.error));
  window.closeTask();
};

/* ============================ CALENDAR ============================ */
async function renderCalendar(el) {
  const d = await api('/api/calendar');
  const now = new Date();
  // week grid: current week (Mon–Sun)
  const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 864e5));
  el.innerHTML = `
    <h2>Calendar</h2>
    <p class="desc">Scheduled kanban tasks & cron jobs. (No external calendar backend — derived from real data.)</p>
    <div class="cal-head">
      <div class="day-label">Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
      <div class="calendar-legend">
        <span><span class="sw" style="background:rgba(77,163,255,.5)"></span>today</span>
        <span><span class="sw" style="background:rgba(255,180,84,.6)"></span>scheduled task</span>
      </div>
    </div>
    <div class="cal-grid">
      ${days.map(day => {
        const isToday = day.toDateString() === now.toDateString();
        const sched = d.scheduled_tasks.filter(t => {
          const ts = t.completed_at_iso ? new Date(t.completed_at_iso) : null;
          return ts && ts.toDateString() === day.toDateString();
        });
        return `<div class="cal-cell ${isToday ? 'today' : ''}">
          <div class="dow">${day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
          <div class="dnum">${day.getDate()}</div>
          ${sched.map(t => `<div class="ev sched" title="${esc(t.title)}">⏱ ${esc(t.title).slice(0,28)}</div>`).join('')}
          ${isToday ? `<div class="ev">● today</div>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card"><h3>Cron Jobs</h3>
        ${d.cron_jobs?.length ? d.cron_jobs.map(j => `<div style="font-size:13px;padding:4px 0"><span class="mono">${esc(j.profile || 'default')}</span> · <b>${esc(j.name || j.job_id || 'unnamed')}</b> <span class="muted">${esc(j.schedule || j.cron || '')}</span> ${j.enabled === false ? '<span class="tag">disabled</span>' : ''}</div>`).join('') : '<div class="empty-note">No cron jobs defined (jobs.json not present yet).</div>'}
      </div>
      <div class="card"><h3>Scheduled Kanban Tasks</h3>
        ${d.scheduled_tasks?.length ? d.scheduled_tasks.map(t => `<div style="font-size:13px;padding:4px 0">${esc(t.title)} <span class="tag mono">${esc(t.id)}</span> ${t.assignee ? `<span class="tag">${esc(t.assignee)}</span>` : ''}</div>`).join('') : '<div class="empty-note">None scheduled.</div>'}
      </div>
    </div>`;
}

/* ============================ ACTIVITY ============================ */
async function renderActivity(el) {
  const d = await api('/api/activity');
  el.innerHTML = `
    <h2>Activity</h2>
    <p class="desc">Unified feed: sessions, kanban events, cron runs & heartbeats (newest first, real data).</p>
    <div class="feed" id="feed"></div>`;
  const feed = $('#feed');
  if (!d.items?.length) {
    feed.innerHTML = '<div class="empty-note">No activity recorded yet — activity appears as agents work (sessions start, tasks move, cron fires).</div>';
    return;
  }
  feed.innerHTML = d.items.map(i => `
    <div class="feed-item">
      <span class="f-kind ${esc(i.kind)}">${esc(i.kind.replace('-', ' '))}</span>
      <span class="f-title">${esc(i.title || i.task_id || '')}</span>
      ${i.detail ? `<span class="f-detail">${esc(String(i.detail).slice(0, 160))}</span>` : ''}
      ${i.profile ? `<span class="f-ts mono">${esc(i.profile)}</span>` : ''}
      <span class="f-ts">${i.ts ? new Date(i.ts).toLocaleString() : '—'}</span>
    </div>`).join('');
}

/* ============================ MEMORY / KNOWLEDGE ============================ */
async function renderMemory(el) {
  const d = await api('/api/memory');
  el.innerHTML = `
    <h2>Memory / Knowledge</h2>
    <p class="desc">Persistent memory files and the shared skills catalog. Empty = genuinely nothing stored (not simulated).</p>
    <div class="grid cols-2">
      ${d.profiles.map(p => `
        <div class="card">
          <h3>Profile: ${esc(p.profile)}</h3>
          <h4 style="font-size:11px;color:var(--muted);margin:6px 0">${p.has_memory_md ? 'MEMORY.md' : 'MEMORY.md (not present)'}</h4>
          ${p.memory_md ? `<div class="mem-block">${esc(p.memory_md)}</div>` : '<div class="mem-empty">No memory stored yet.</div>'}
          <h4 style="font-size:11px;color:var(--muted);margin:12px 0 6px">USER.md</h4>
          ${p.user_md ? `<div class="mem-block">${esc(p.user_md)}</div>` : '<div class="mem-empty">No user profile stored yet.</div>'}
        </div>`).join('')}
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Skills Catalog — ${d.skills.count} reusable procedures</h3>
      <div style="max-height:420px;overflow:auto">
        <table class="skill-table">
          <tbody>
            ${d.skills.skills.map(s => `
              <tr><td>${esc(s.name)}</td><td>${esc(s.description || '—')}<br><span class="cat">${esc(s.category)}</span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ============================ 2D OFFICE ============================ */
async function renderOffice(el) {
  const d = await api('/api/office');
  const colors = { working: '#37c871', idle: '#4da3ff', offline: '#ff5d5d' };
  el.innerHTML = `
    <h2>2D Office</h2>
    <p class="desc">Top-down office of the AI team. Desk colors reflect <b>live service state</b> (idle / working / offline).</p>
    <div class="office-wrap">
      <svg class="office" viewBox="0 0 400 200">
        <rect x="4" y="4" width="392" height="192" rx="14" fill="#0f141c" stroke="#1e2836"/>
        <rect x="30" y="150" width="340" height="34" rx="8" fill="#121821" stroke="#1e2836"/>
        <text x="40" y="172" fill="#7d8da0" font-size="10" font-family="monospace">MEETING / SHARED TABLE — humans + agents</text>
        ${d.desks.map(dk => `
          <g>
            <rect x="${300 + (parseInt(dk.x) - 10) * 0}" y="0" width="0" height="0" fill="none"/>
            <!-- desk positioned from percentage x -->
            <g transform="translate(${parseInt(dk.x) * 4 - 60}, 40)">
              <ellipse cx="60" cy="46" rx="52" ry="26" fill="${colors[dk.status] || '#555'}" opacity="0.15"/>
              <rect x="12" y="18" width="96" height="44" rx="8" fill="#121821" stroke="${colors[dk.status] || '#555'}" stroke-width="1.5"/>
              <rect x="28" y="4" width="64" height="22" rx="4" fill="#1e2836"/>
              <circle cx="60" cy="86" r="16" fill="${colors[dk.status] || '#555'}" opacity="0.9"/>
              <text x="60" y="91" text-anchor="middle" fill="#0b0f14" font-size="11" font-weight="bold">${esc(dk.label.charAt(0))}</text>
              <text x="60" y="112" text-anchor="middle" class="desk-label" fill="#d7e2ee" font-size="11">${esc(dk.label)}</text>
              <text x="60" y="126" text-anchor="middle" class="desk-status" fill="${colors[dk.status] || '#7d8da0'}" font-size="9">${esc(dk.status.toUpperCase())}</text>
              ${dk.claimed?.length ? `<text x="60" y="138" text-anchor="middle" fill="#7d8da0" font-size="8">${dk.claimed.length} task(s) claimed</text>` : ''}
            </g>
          </g>`).join('')}
      </svg>
    </div>
    <div class="office-legend">
      <span><span class="sw" style="background:${colors.working}"></span>working (claimed task / active)</span>
      <span><span class="sw" style="background:${colors.idle}"></span>idle (up, no active work)</span>
      <span><span class="sw" style="background:${colors.offline}"></span>offline / not installed</span>
    </div>`;
}

/* ============================ NAVIGATION + LOOP ============================ */
const VIEWS = {
  dashboard: renderDashboard,
  agents: renderAgents,
  board: renderBoard,
  calendar: renderCalendar,
  activity: renderActivity,
  memory: renderMemory,
  office: renderOffice,
};

function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  refreshCurrent();
}

async function refreshCurrent() {
  const el = $(`#view-${currentView}`);
  const fn = VIEWS[currentView];
  el.innerHTML = '<div class="card"><div class="muted">Loading…</div></div>';
  try {
    await fn(el);
    lastUpdated = new Date();
    $('#updated').textContent = lastUpdated.toLocaleTimeString();
    $('#foot-status').textContent = `updated ${lastUpdated.toLocaleTimeString()}`;
  } catch (e) {
    el.innerHTML = `<div class="card"><h3>Failed to load</h3><div class="notice">${esc(e.message)}</div></div>`;
    $('#foot-status').textContent = `error: ${e.message}`;
  }
}

document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('#refresh').addEventListener('click', refreshCurrent);

// hash-based view (so links survive refresh)
function viewFromHash() {
  const h = location.hash.replace('#', '');
  return VIEWS[h] ? h : 'dashboard';
}
window.addEventListener('hashchange', () => showView(viewFromHash()));

setInterval(() => { if (document.visibilityState === 'visible') refreshCurrent(); }, REFRESH_MS);

// boot
location.hash = viewFromHash();
showView(viewFromHash());
