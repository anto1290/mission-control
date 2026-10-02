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

/* ============================ PIXEL ART OFFICE ============================ */

function processAgentData(rawAgents) {
  return rawAgents.map(a => {
    let status = 'offline';
    if (a.opencode) {
      status = a.opencode.present ? 'idle' : 'offline';
    } else if (a.service) {
      if (a.service.state === 'up') {
        status = a.claimed_tasks?.length ? 'working' : 'idle';
      }
    }
    return {
      name: a.name,
      label: a.label,
      role: a.role,
      status,
      task: a.claimed_tasks?.[0]?.title || null,
      model: a.model?.default_model || null,
      service: a.service,
      claimed: a.claimed_tasks || [],
    };
  });
}

const AGENT_COLORS = {
  default: { primary: '#4da3ff', secondary: '#2d5aa0', accent: '#7db8ff' },
  leadenginer: { primary: '#37c871', secondary: '#1e8a4a', accent: '#6dd89a' },
  opencode: { primary: '#b48cff', secondary: '#7d4fbf', accent: '#d4b8ff' },
};

function renderPixelRoom(room) {
  const container = document.getElementById('pixel-room');
  if (!container || !window._pixelAgents) return;
  
  const SCALE = 4;
  const COLORS = {
    floor: '#8b7355', floorDark: '#6b5540', wall: '#4a5568', wallLight: '#5a6578',
    ceiling: '#2d3748', window: '#87ceeb', windowFrame: '#4a5568', windowPane: '#b8e4f7',
    door: '#6b4423', doorFrame: '#4a3728', doorHandle: '#c9a227',
    desk: '#8b6914', deskTop: '#a07818', deskLeg: '#6b4423',
    chair: '#4a5568', chairSeat: '#5a6578',
    monitor: '#1a202c', monitorScreen: '#2d3748',
    plant: '#48bb78', plantDark: '#2f855a', pot: '#8b6914',
    cooler: '#63b3ed', coolerWater: '#90cdf4',
    shelf: '#6b5540', book1: '#e53e3e', book2: '#38a169', book3: '#3182ce', book4: '#d69e2e',
    whiteboard: '#e2e8f0', whiteboardFrame: '#4a5568', rug: '#744210',
    clock: '#e2e8f0', clockFace: '#f7fafc', clockHand: '#2d3748',
    sofa: '#744210', sofaBack: '#8b5e3c', sofaArm: '#5c3317',
    tv: '#1a202c', tvScreen: '#2d3748',
  };
  
  const W = 200, H = 140;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="pixel-svg" xmlns="http://www.w3.org/2000/svg">`;
  
  if (room === 'workspace') {
    // Floor
    svg += `<rect x="0" y="80" width="${W}" height="60" fill="${COLORS.floor}"/>`;
    svg += `<rect x="0" y="80" width="${W}" height="4" fill="${COLORS.floorDark}"/>`;
    // Wall
    svg += `<rect x="0" y="0" width="${W}" height="80" fill="${COLORS.wall}"/>`;
    svg += `<rect x="0" y="0" width="${W}" height="4" fill="${COLORS.wallLight}"/>`;
    svg += `<rect x="0" y="76" width="${W}" height="4" fill="${COLORS.wallLight}"/>`;
    
    // Windows
    // Left window
    svg += `<rect x="10" y="12" width="36" height="32" fill="${COLORS.windowFrame}"/>`;
    svg += `<rect x="14" y="16" width="28" height="24" fill="${COLORS.window}"/>`;
    svg += `<rect x="26" y="16" width="2" height="24" fill="${COLORS.windowFrame}"/>`;
    svg += `<rect x="14" y="26" width="28" height="2" fill="${COLORS.windowFrame}"/>`;
    svg += `<rect x="16" y="18" width="10" height="6" fill="${COLORS.windowPane}"/>`;
    svg += `<rect x="32" y="18" width="10" height="6" fill="${COLORS.windowPane}"/>`;
    // Right window
    svg += `<rect x="154" y="12" width="36" height="32" fill="${COLORS.windowFrame}"/>`;
    svg += `<rect x="158" y="16" width="28" height="24" fill="${COLORS.window}"/>`;
    svg += `<rect x="170" y="16" width="2" height="24" fill="${COLORS.windowFrame}"/>`;
    svg += `<rect x="158" y="26" width="28" height="2" fill="${COLORS.windowFrame}"/>`;
    svg += `<rect x="160" y="18" width="10" height="6" fill="${COLORS.windowPane}"/>`;
    svg += `<rect x="176" y="18" width="10" height="6" fill="${COLORS.windowPane}"/>`;
    
    // Door
    svg += `<rect x="82" y="20" width="36" height="56" fill="${COLORS.doorFrame}"/>`;
    svg += `<rect x="86" y="24" width="28" height="48" fill="${COLORS.door}"/>`;
    svg += `<rect x="108" y="44" width="4" height="4" fill="${COLORS.doorHandle}"/>`;
    svg += `<rect x="86" y="48" width="28" height="2" fill="#5a3a1a"/>`;
    svg += `<rect x="86" y="72" width="28" height="2" fill="#5a3a1a"/>`;
    
    // Clock
    svg += `<rect x="94" y="8" width="12" height="12" fill="${COLORS.clock}"/>`;
    svg += `<rect x="96" y="10" width="8" height="8" fill="${COLORS.clockFace}"/>`;
    svg += `<rect x="99" y="10" width="2" height="4" fill="${COLORS.clockHand}"/>`;
    svg += `<rect x="99" y="10" width="4" height="2" fill="${COLORS.clockHand}"/>`;
    
    // Bookshelf
    svg += `<rect x="4" y="40" width="6" height="36" fill="${COLORS.shelf}"/>`;
    svg += `<rect x="10" y="36" width="16" height="4" fill="${COLORS.shelf}"/>`;
    svg += `<rect x="10" y="64" width="16" height="4" fill="${COLORS.shelf}"/>`;
    svg += `<rect x="12" y="40" width="4" height="20" fill="${COLORS.book1}"/>`;
    svg += `<rect x="17" y="42" width="4" height="18" fill="${COLORS.book2}"/>`;
    svg += `<rect x="22" y="38" width="4" height="22" fill="${COLORS.book3}"/>`;
    svg += `<rect x="14" y="48" width="3" height="12" fill="${COLORS.book4}"/>`;
    
    // Whiteboard
    svg += `<rect x="174" y="36" width="20" height="28" fill="${COLORS.whiteboardFrame}"/>`;
    svg += `<rect x="176" y="38" width="16" height="24" fill="${COLORS.whiteboard}"/>`;
    svg += `<rect x="178" y="42" width="12" height="2" fill="#a0aec0"/>`;
    svg += `<rect x="178" y="48" width="10" height="2" fill="#a0aec0"/>`;
    svg += `<rect x="178" y="54" width="14" height="2" fill="#a0aec0"/>`;
    
    // Water cooler
    svg += `<rect x="92" y="52" width="16" height="24" fill="${COLORS.cooler}"/>`;
    svg += `<rect x="94" y="54" width="12" height="18" fill="${COLORS.coolerWater}"/>`;
    svg += `<rect x="96" y="56" width="8" height="14" fill="#bee3f8"/>`;
    svg += `<rect x="98" y="72" width="4" height="4" fill="${COLORS.cooler}"/>`;
    
    // Desks (2 rows)
    const desks = [
      {x:20,y:68}, {x:60,y:68}, {x:120,y:68}, {x:160,y:68},
      {x:20,y:100}, {x:60,y:100}, {x:120,y:100}, {x:160,y:100},
    ];
    desks.forEach((d, i) => {
      svg += `<rect x="${d.x}" y="${d.y}" width="32" height="8" fill="${COLORS.deskTop}"/>`;
      svg += `<rect x="${d.x}" y="${d.y+8}" width="32" height="12" fill="${COLORS.desk}"/>`;
      svg += `<rect x="${d.x+2}" y="${d.y+20}" width="4" height="8" fill="${COLORS.deskLeg}"/>`;
      svg += `<rect x="${d.x+26}" y="${d.y+20}" width="4" height="8" fill="${COLORS.deskLeg}"/>`;
      svg += `<rect x="${d.x+10}" y="${d.y-12}" width="12" height="10" fill="${COLORS.monitor}"/>`;
      svg += `<rect x="${d.x+12}" y="${d.y-10}" width="8" height="6" fill="${COLORS.monitorScreen}"/>`;
      svg += `<rect x="${d.x+14}" y="${d.y-8}" width="4" height="2" fill="rgba(77,163,255,0.3)"/>`;
      svg += `<rect x="${d.x+8}" y="${d.y+24}" width="16" height="6" fill="${COLORS.chairSeat}"/>`;
      svg += `<rect x="${d.x+10}" y="${d.y+30}" width="12" height="6" fill="${COLORS.chair}"/>`;
    });
    
    // Plants
    svg += `<rect x="8" y="116" width="8" height="8" fill="${COLORS.pot}"/>`;
    svg += `<rect x="10" y="108" width="4" height="8" fill="${COLORS.plant}"/>`;
    svg += `<rect x="14" y="110" width="4" height="6" fill="${COLORS.plantDark}"/>`;
    svg += `<rect x="12" y="106" width="2" height="2" fill="${COLORS.plant}"/>`;
    svg += `<rect x="184" y="116" width="8" height="8" fill="${COLORS.pot}"/>`;
    svg += `<rect x="186" y="108" width="4" height="8" fill="${COLORS.plant}"/>`;
    svg += `<rect x="190" y="110" width="4" height="6" fill="${COLORS.plantDark}"/>`;
    svg += `<rect x="188" y="106" width="2" height="2" fill="${COLORS.plant}"/>`;
    
    // Rug
    svg += `<rect x="60" y="96" width="80" height="12" fill="${COLORS.rug}"/>`;
    svg += `<rect x="62" y="98" width="76" height="8" fill="#8b5e3c"/>`;
    
  } else { // lounge - improved pixel art style
    // Floor with plank lines
    svg += `<rect x="0" y="80" width="${W}" height="60" fill="#8b6f47"/>`;
    svg += `<rect x="0" y="80" width="${W}" height="2" fill="#6b5235"/>`; // base shadow
    // Plank lines
    for (let i = 0; i < 60; i += 12) {
      svg += `<rect x="0" y="${80 + i}" width="${W}" height="1" fill="#7a5f3a"/>`;
    }
    // Floor edge
    svg += `<rect x="0" y="138" width="${W}" height="2" fill="#5a4228"/>`;
    
    // Wall (dark purple-gray)
    svg += `<rect x="0" y="0" width="${W}" height="80" fill="#4a3f5c"/>`;
    svg += `<rect x="0" y="0" width="${W}" height="4" fill="#5a4f6c"/>`; // wall top
    svg += `<rect x="0" y="76" width="${W}" height="4" fill="#3a2f4c"/>`; // wall bottom
    
    // Two windows (left and right of door)
    // Left window
    svg += `<rect x="16" y="12" width="32" height="32" fill="#2d2d3a"/>`; // frame
    svg += `<rect x="20" y="16" width="24" height="24" fill="#87ceeb"/>`; // glass
    svg += `<rect x="30" y="16" width="2" height="24" fill="#2d2d3a"/>`; // vertical divider
    svg += `<rect x="20" y="26" width="24" height="2" fill="#2d2d3a"/>`; // horizontal divider
    svg += `<rect x="22" y="18" width="8" height="6" fill="#b8e4f7"/>`; // reflection
    svg += `<rect x="34" y="18" width="8" height="6" fill="#b8e4f7"/>`;
    svg += `<rect x="18" y="44" width="28" height="2" fill="#2d2d3a"/>`; // sill
    
    // Right window
    svg += `<rect x="152" y="12" width="32" height="32" fill="#2d2d3a"/>`;
    svg += `<rect x="156" y="16" width="24" height="24" fill="#87ceeb"/>`;
    svg += `<rect x="166" y="16" width="2" height="24" fill="#2d2d3a"/>`;
    svg += `<rect x="156" y="26" width="24" height="2" fill="#2d2d3a"/>`;
    svg += `<rect x="158" y="18" width="8" height="6" fill="#b8e4f7"/>`;
    svg += `<rect x="170" y="18" width="8" height="6" fill="#b8e4f7"/>`;
    svg += `<rect x="154" y="44" width="28" height="2" fill="#2d2d3a"/>`;
    
    // Door (center)
    svg += `<rect x="82" y="20" width="36" height="56" fill="#3a2a1a"/>`; // frame
    svg += `<rect x="86" y="24" width="28" height="48" fill="#6b4423"/>`; // door
    svg += `<rect x="108" y="44" width="4" height="4" fill="#c9a227"/>`; // handle
    svg += `<rect x="86" y="48" width="28" height="2" fill="#5a3a1a"/>`; // panel line
    svg += `<rect x="86" y="72" width="28" height="2" fill="#5a3a1a"/>`;
    svg += `<rect x="86" y="76" width="28" height="2" fill="#2d2d3a"/>`; // shadow
    
    // Clock (above door)
    svg += `<rect x="92" y="6" width="16" height="16" fill="#e2e8f0"/>`;
    svg += `<rect x="94" y="8" width="12" height="12" fill="#f7fafc"/>`;
    svg += `<rect x="99" y="8" width="2" height="5" fill="#2d3748"/>`; // hour hand
    svg += `<rect x="99" y="8" width="5" height="2" fill="#2d3748"/>`; // minute hand
    svg += `<rect x="99" y="11" width="2" height="2" fill="#c9a227"/>`; // center
    
    // TV (center below door, wall-mounted)
    svg += `<rect x="86" y="52" width="28" height="20" fill="#1a202c"/>`; // TV body
    svg += `<rect x="88" y="54" width="24" height="16" fill="#2d3748"/>`; // screen
    svg += `<rect x="92" y="58" width="8" height="4" fill="#ff6b9d"/>`; // pink lines
    svg += `<rect x="102" y="62" width="6" height="3" fill="#4da3ff"/>`; // blue lines
    svg += `<rect x="94" y="66" width="12" height="2" fill="#48bb78"/>`; // green line
    svg += `<rect x="96" y="72" width="8" height="4" fill="#4a5568"/>`; // stand
    
    // Blue couch (facing TV)
    svg += `<rect x="16" y="68" width="56" height="12" fill="#4299e1"/>`; // seat
    svg += `<rect x="16" y="60" width="56" height="8" fill="#3182ce"/>`; // back
    svg += `<rect x="12" y="68" width="4" height="16" fill="#2b6cb0"/>`; // arm left
    svg += `<rect x="68" y="68" width="4" height="16" fill="#2b6cb0"/>`; // arm right
    svg += `<rect x="20" y="80" width="4" height="6" fill="#1a4a7a"/>`; // leg
    svg += `<rect x="60" y="80" width="4" height="6" fill="#1a4a7a"/>`;
    svg += `<rect x="16" y="80" width="56" height="2" fill="#1a365d"/>`; // shadow
    
    // Purple armchair (left side)
    svg += `<rect x="4" y="64" width="16" height="12" fill="#9f7aea"/>`; // seat
    svg += `<rect x="4" y="56" width="16" height="8" fill="#805ad5"/>`; // back
    svg += `<rect x="0" y="64" width="4" height="12" fill="#6b46c1"/>`; // arm
    svg += `<rect x="8" y="76" width="3" height="6" fill="#44337a"/>`; // leg
    svg += `<rect x="18" y="76" width="3" height="6" fill="#44337a"/>`;
    
    // Coffee table (in front of couch)
    svg += `<rect x="28" y="84" width="32" height="4" fill="#a07818"/>`; // top
    svg += `<rect x="32" y="88" width="3" height="8" fill="#6b4423"/>`; // leg
    svg += `<rect x="55" y="88" width="3" height="8" fill="#6b4423"/>`;
    svg += `<rect x="28" y="96" width="32" height="2" fill="#2d2d3a"/>`; // shadow
    
    // Blue rug (under coffee table)
    svg += `<rect x="24" y="98" width="40" height="12" fill="#4299e1"/>`;
    svg += `<rect x="26" y="100" width="36" height="8" fill="#63b3ed"/>`;
    
    // Plants (corners)
    // Left plant
    svg += `<rect x="6" y="108" width="10" height="10" fill="#8b6914"/>`; // pot
    svg += `<rect x="8" y="96" width="6" height="12" fill="#48bb78"/>`; // leaves
    svg += `<rect x="14" y="98" width="6" height="8" fill="#2f855a"/>`;
    svg += `<rect x="10" y="92" width="4" height="4" fill="#48bb78"/>`; // top
    
    // Right plant
    svg += `<rect x="184" y="108" width="10" height="10" fill="#8b6914"/>`;
    svg += `<rect x="186" y="96" width="6" height="12" fill="#48bb78"/>`;
    svg += `<rect x="192" y="98" width="6" height="8" fill="#2f855a"/>`;
    svg += `<rect x="188" y="92" width="4" height="4" fill="#48bb78"/>`;
    
    // Baseboard shadow
    svg += `<rect x="0" y="76" width="${W}" height="4" fill="#2d2d3a"/>`;
  }
  
  // Render agents
  const workingAgents = window._pixelAgents.filter(a => a.status === 'working');
  const idleAgents = window._pixelAgents.filter(a => a.status === 'idle');
  const offlineAgents = window._pixelAgents.filter(a => a.status === 'offline');
  
  // Working agents at desks (top row)
  workingAgents.forEach((agent, i) => {
    if (i < 4) {
      const pos = [20, 60, 120, 160][i];
      svg += renderAgentPixel(pos, 56, agent);
    }
  });
  
  // Idle agents on couch in lounge
  idleAgents.forEach((agent, i) => {
    // Position along couch (y=56 is top of couch back)
    const positions = [
      { x: 20, y: 52 }, // left on couch
      { x: 32, y: 52 },
      { x: 44, y: 52 },
      { x: 56, y: 52 },
      { x: 68, y: 52 }, // right on couch
    ];
    const pos = positions[i] || positions[0];
    svg += renderAgentPixelCouch(pos.x, pos.y, agent);
  });
  
  // Offline agents dimmed (at desks)
  offlineAgents.forEach((agent, i) => {
    const pos = [160, 60, 20][i] || 20;
    svg += renderAgentPixel(pos, 56, agent, true);
  });
  
  svg += '</svg>';
  container.innerHTML = svg;
  container.classList.add('room-enter');
  
  // Add click handlers
  container.querySelectorAll('.agent-pixel').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = el.dataset.agent;
      const agent = window._pixelAgents.find(a => a.name === name);
      if (agent) showAgentPopup(agent, e);
    });
  });
}

function renderAgentPixel(x, y, agent, offline = false) {
  const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.default;
  const opacity = offline ? 'opacity="0.3"' : '';
  const statusColor = offline ? '#666' : (agent.status === 'working' ? '#48bb78' : colors.primary);
  
  return `
    <g class="agent-pixel" data-agent="${agent.name}" ${opacity}>
      <!-- Body -->
      <rect x="${x+4}" y="${y+8}" width="8" height="12" fill="${colors.primary}"/>
      <!-- Head -->
      <rect x="${x+6}" y="${y+0}" width="6" height="6" fill="${colors.accent}"/>
      <!-- Eyes -->
      <rect x="${x+8}" y="${y+2}" width="2" height="2" fill="#0b0f14"/>
      <rect x="${x+12}" y="${y+2}" width="2" height="2" fill="#0b0f14"/>
      <!-- Arms -->
      <rect x="${x+0}" y="${y+10}" width="4" height="8" fill="${colors.secondary}"/>
      <rect x="${x+12}" y="${y+10}" width="4" height="8" fill="${colors.secondary}"/>
      <!-- Status dot -->
      <rect x="${x+7}" y="${y-4}" width="2" height="2" fill="${statusColor}"/>
      <!-- Name label -->
      <rect x="${x+2}" y="${y+22}" width="12" height="4" fill="#1a202c" rx="1"/>
      <text x="${x+8}" y="${y+25}" text-anchor="middle" fill="${colors.primary}" font-size="3" font-family="monospace">${esc(agent.label).slice(0,6)}</text>
    </g>`;
}

function renderAgentPixelCouch(x, y, agent) {
  const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.default;
  
  return `
    <g class="agent-pixel" data-agent="${agent.name}">
      <!-- Body (seated, smaller) -->
      <rect x="${x+3}" y="${y+6}" width="8" height="10" fill="${colors.primary}"/>
      <!-- Head -->
      <rect x="${x+4}" y="${y+0}" width="6" height="6" fill="${colors.accent}"/>
      <!-- Eyes -->
      <rect x="${x+6}" y="${y+2}" width="2" height="2" fill="#0b0f14"/>
      <rect x="${x+10}" y="${y+2}" width="2" height="2" fill="#0b0f14"/>
      <!-- Arms (relaxed) -->
      <rect x="${x}" y="${y+8}" width="3" height="6" fill="${colors.secondary}"/>
      <rect x="${x+11}" y="${y+8}" width="3" height="6" fill="${colors.secondary}"/>
      <!-- Status dot -->
      <rect x="${x+5}" y="${y-3}" width="2" height="2" fill="${colors.primary}"/>
      <!-- Name label -->
      <rect x="${x+1}" y="${y+16}" width="14" height="4" fill="#1a202c"/>
      <text x="${x+8}" y="${y+19}" text-anchor="middle" fill="${colors.primary}" font-size="3" font-family="monospace">${esc(agent.label).slice(0,6)}</text>
    </g>`;
}

function updateStatusSummary() {
  if (!window._pixelAgents) return;
  const working = window._pixelAgents.filter(a => a.status === 'working').length;
  const idle = window._pixelAgents.filter(a => a.status === 'idle').length;
  const offline = window._pixelAgents.filter(a => a.status === 'offline').length;
  
  document.getElementById('count-working').textContent = working;
  document.getElementById('count-idle').textContent = idle;
  document.getElementById('count-offline').textContent = offline;
}

function updateUserList() {
  if (!window._pixelAgents) return;
  const list = document.getElementById('user-list');
  list.innerHTML = window._pixelAgents.map(a => {
    const colors = AGENT_COLORS[a.name] || AGENT_COLORS.default;
    return `
      <div class="user-item ${a.status}" onclick="showAgentPopupFor('${a.name}')">
        <div class="user-avatar" style="background:${colors.primary}">${a.label.charAt(0)}</div>
        <div class="user-info">
          <div class="user-name">${a.label}</div>
          <div class="user-status ${a.status}">${a.status}</div>
        </div>
      </div>`;
  }).join('');
}

function showAgentPopupFor(name) {
  const agent = window._pixelAgents?.find(a => a.name === name);
  if (!agent) return;
  const fakeEvent = { target: document.activeElement, stopPropagation: () => {} };
  showAgentPopup(agent, fakeEvent);
}

function showAgentPopup(agent, event) {
  const popup = document.getElementById('agent-popup');
  const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.default;
  
  document.getElementById('popup-avatar').innerHTML = `<span style="color:${colors.primary};font-size:16px;font-weight:700">${agent.label.charAt(0)}</span>`;
  document.getElementById('popup-name').textContent = agent.label;
  document.getElementById('popup-role').textContent = agent.role || 'AI Agent';
  document.getElementById('popup-status').innerHTML = `<span class="pill ${agent.status === 'working' ? 'up' : agent.status === 'idle' ? 'warn' : 'down'}"><span class="dot"></span>${agent.status}</span>`;
  document.getElementById('popup-task').textContent = agent.task || 'No active task';
  document.getElementById('popup-model').textContent = agent.model || '—';
  
  const rect = event.target.getBoundingClientRect();
  popup.style.left = `${rect.left + rect.width / 2 - 120}px`;
  popup.style.top = `${rect.top - 10}px`;
  popup.classList.add('visible');
}

document.addEventListener('click', () => {
  document.getElementById('agent-popup')?.classList.remove('visible');
});

function updateChannelList() {
  if (!window._pixelDashboard) return;
  const list = document.getElementById('channel-list');
  const platforms = window._pixelDashboard.platforms || [];
  
  if (!platforms.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted)">No channel data available</div>';
    return;
  }
  
  list.innerHTML = platforms.map(p => `
    <div class="channel-item">
      <span class="channel-name">${p.platform}</span>
      <span class="channel-status ${p.state === 'connected' ? '' : 'disconnected'}">${p.state}</span>
    </div>
  `).join('');
}

function updateMiniFeed() {
  if (!window._pixelActivity) return;
  const feed = document.getElementById('mini-feed');
  const items = window._pixelActivity.items?.slice(0, 5) || [];
  
  if (!items.length) {
    feed.innerHTML = '<div style="font-size:12px;color:var(--muted)">No recent activity</div>';
    return;
  }
  
  feed.innerHTML = items.map(i => {
    const time = i.ts ? new Date(i.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    return `
      <div class="mini-feed-item">
        <span class="mini-feed-kind ${i.kind}">${i.kind.replace('-', ' ')}</span>
        <span class="mini-feed-text">${i.title || ''}</span>
        <span class="mini-feed-time">${time}</span>
      </div>`;
  }).join('');
}

window.switchRoom = function(room) {
  currentRoom = room;
  renderPixelRoom(room);
  document.getElementById('btn-workspace').className = room === 'workspace' ? 'primary' : 'ghost';
  document.getElementById('btn-lounge').className = room === 'lounge' ? 'primary' : 'ghost';
};

async function renderOffice(el) {
  el.innerHTML = `
    <h2>Visual Office</h2>
    <p class="desc">Real-time pixel-art office showing agent states from Hermes data sources.</p>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button id="btn-workspace" class="primary" onclick="switchRoom('workspace')">🖥️ Workspace</button>
      <button id="btn-lounge" class="ghost" onclick="switchRoom('lounge')">🛋️ Lounge</button>
    </div>
    <div class="status-summary" id="status-summary">
      <div class="status-item"><span class="status-dot working"></span><span>Working: <b id="count-working">0</b></span></div>
      <div class="status-item"><span class="status-dot idle"></span><span>Idle: <b id="count-idle">0</b></span></div>
      <div class="status-item"><span class="status-dot offline"></span><span>Offline: <b id="count-offline">0</b></span></div>
    </div>
    <div id="office-container"></div>`;
  
  // Move the container to where we need it
  const container = document.getElementById('office-container');
  container.innerHTML = '<div class="pixel-office-wrap" id="pixel-office-wrap"><div class="pixel-room" id="pixel-room"><div style="padding:40px;text-align:center;color:var(--muted)">Loading office...</div></div><div class="pixel-sidebar"><div class="sidebar-panel"><h4>Team Members</h4><div class="user-list" id="user-list"></div></div><div class="sidebar-panel"><h4>Channels</h4><div class="channel-list" id="channel-list"></div></div><div class="sidebar-panel"><h4>Live Activity</h4><div class="mini-feed" id="mini-feed"></div></div></div></div><div class="agent-popup" id="agent-popup"><div class="popup-header"><div class="popup-avatar" id="popup-avatar"></div><div><div class="popup-name" id="popup-name"></div><div class="popup-role" id="popup-role"></div></div></div><div class="popup-section"><div class="popup-label">Status</div><div class="popup-value" id="popup-status"></div></div><div class="popup-section"><div class="popup-label">Current Task</div><div class="popup-value" id="popup-task"></div></div><div class="popup-section"><div class="popup-label">Model</div><div class="popup-value" id="popup-model"></div></div></div>';
  
  try {
    const [agents, dashboard, activity] = await Promise.all([
      api('/api/agents'),
      api('/api/dashboard'),
      api('/api/activity'),
    ]);
    
    window._pixelAgents = processAgentData(agents.agents);
    window._pixelDashboard = dashboard;
    window._pixelActivity = activity;
    
    renderPixelRoom('workspace');
    updateStatusSummary();
    updateUserList();
    updateChannelList();
    updateMiniFeed();
  } catch (e) {
    el.innerHTML = `<div class="card"><h3>Failed to load office</h3><div class="notice">${esc(e.message)}</div></div>`;
  }
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

// 3D Office view — loads standalone page in iframe
async function renderOffice3D(el) {
  el.innerHTML = `
    <h2>3D Visual Office</h2>
    <p class="desc">Isometric 3D office with real-time agent data. Drag to rotate, scroll to zoom.</p>
    <div style="margin-top:14px">
      <iframe src="/office-3d.html" style="width:100%;height:650px;border:none;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3)"></iframe>
    </div>
    <p class="muted" style="margin-top:12px;font-size:12px">
      Data sources: <a href="/api/agents" target="_blank">/api/agents</a> · 
      <a href="/api/dashboard" target="_blank">/api/dashboard</a> · 
      <a href="/api/activity" target="_blank">/api/activity</a>
    </p>`;
}

VIEWS.office3d = renderOffice3D;

window.addEventListener('hashchange', () => showView(viewFromHash()));

setInterval(() => { if (document.visibilityState === 'visible') refreshCurrent(); }, REFRESH_MS);

// boot
location.hash = viewFromHash();
showView(viewFromHash());
