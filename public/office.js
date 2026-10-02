/**
 * Visual Office — Pixel Art Dashboard
 * Renders a retro 2D pixel-art office with real Hermes agent data.
 */
'use strict';

// ==================== STATE ====================
let currentRoom = 'workspace';
let agentsData = null;
let dashboardData = null;
let activityData = null;

// Agent color palette (pixel art style)
const AGENT_COLORS = {
  default: { primary: '#4da3ff', secondary: '#2d5aa0', accent: '#7db8ff' },
  leadenginer: { primary: '#37c871', secondary: '#1e8a4a', accent: '#6dd89a' },
  opencode: { primary: '#b48cff', secondary: '#7d4fbf', accent: '#d4b8ff' },
};

// ==================== PIXEL ART RENDERER ====================

// Pixel dimensions (each "pixel" is 4x4 CSS pixels)
const SCALE = 4;
const ROOM_WIDTH = 200;
const ROOM_HEIGHT = 140;

// Color map
const COLORS = {
  floor: '#8b7355',
  floorDark: '#6b5540',
  wall: '#4a5568',
  wallLight: '#5a6578',
  ceiling: '#2d3748',
  window: '#87ceeb',
  windowFrame: '#4a5568',
  windowPane: '#b8e4f7',
  door: '#6b4423',
  doorFrame: '#4a3728',
  doorHandle: '#c9a227',
  desk: '#8b6914',
  deskTop: '#a07818',
  deskLeg: '#6b4423',
  chair: '#4a5568',
  chairSeat: '#5a6578',
  monitor: '#1a202c',
  monitorScreen: '#2d3748',
  monitorGlow: '#4da3ff',
  plant: '#48bb78',
  plantDark: '#2f855a',
  pot: '#8b6914',
  cooler: '#63b3ed',
  coolerWater: '#90cdf4',
  shelf: '#6b5540',
  book1: '#e53e3e',
  book2: '#38a169',
  book3: '#3182ce',
  book4: '#d69e2e',
  whiteboard: '#e2e8f0',
  whiteboardFrame: '#4a5568',
  rug: '#744210',
  clock: '#e2e8f0',
  clockFace: '#f7fafc',
  clockHand: '#2d3748',
};

function createPixelSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`);
  svg.setAttribute('class', 'pixel-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', 'auto');
  return svg;
}

function pixelRect(x, y, w, h, fill, stroke = null) {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', fill);
  if (stroke) {
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', '1');
  }
  return rect;
}

function renderWorkspace() {
  const svg = createPixelSVG();
  
  // Background - floor
  svg.appendChild(pixelRect(0, 80, ROOM_WIDTH, 60, COLORS.floor));
  svg.appendChild(pixelRect(0, 80, ROOM_WIDTH, 4, COLORS.floorDark)); // floor edge
  
  // Background - wall
  svg.appendChild(pixelRect(0, 0, ROOM_WIDTH, 80, COLORS.wall));
  svg.appendChild(pixelRect(0, 0, ROOM_WIDTH, 4, COLORS.wallLight)); // wall top
  
  // Ceiling line
  svg.appendChild(pixelRect(0, 76, ROOM_WIDTH, 4, COLORS.wallLight));
  
  // Windows (left and right)
  // Left window
  svg.appendChild(pixelRect(10, 12, 36, 32, COLORS.windowFrame));
  svg.appendChild(pixelRect(14, 16, 28, 24, COLORS.window));
  svg.appendChild(pixelRect(26, 16, 2, 24, COLORS.windowFrame)); // vertical pane
  svg.appendChild(pixelRect(14, 26, 28, 2, COLORS.windowFrame)); // horizontal pane
  svg.appendChild(pixelRect(16, 18, 10, 6, COLORS.windowPane)); // reflection
  svg.appendChild(pixelRect(32, 18, 10, 6, COLORS.windowPane)); // reflection
  
  // Right window
  svg.appendChild(pixelRect(154, 12, 36, 32, COLORS.windowFrame));
  svg.appendChild(pixelRect(158, 16, 28, 24, COLORS.window));
  svg.appendChild(pixelRect(170, 16, 2, 24, COLORS.windowFrame));
  svg.appendChild(pixelRect(158, 26, 28, 2, COLORS.windowFrame));
  svg.appendChild(pixelRect(160, 18, 10, 6, COLORS.windowPane));
  svg.appendChild(pixelRect(176, 18, 10, 6, COLORS.windowPane));
  
  // Door (center)
  svg.appendChild(pixelRect(82, 20, 36, 56, COLORS.doorFrame));
  svg.appendChild(pixelRect(86, 24, 28, 48, COLORS.door));
  svg.appendChild(pixelRect(108, 44, 4, 4, COLORS.doorHandle)); // handle
  svg.appendChild(pixelRect(86, 48, 28, 2, '#5a3a1a')); // door panel line
  svg.appendChild(pixelRect(86, 72, 28, 2, '#5a3a1a'));
  
  // Clock (above door)
  svg.appendChild(pixelRect(94, 8, 12, 12, COLORS.clock));
  svg.appendChild(pixelRect(96, 10, 8, 8, COLORS.clockFace));
  svg.appendChild(pixelRect(99, 10, 2, 4, COLORS.clockHand)); // hour hand
  svg.appendChild(pixelRect(99, 10, 4, 2, COLORS.clockHand)); // minute hand
  
  // Bookshelf (left wall)
  svg.appendChild(pixelRect(4, 40, 6, 36, COLORS.shelf));
  svg.appendChild(pixelRect(10, 36, 16, 4, COLORS.shelf)); // shelf top
  svg.appendChild(pixelRect(10, 64, 16, 4, COLORS.shelf)); // shelf bottom
  // Books
  svg.appendChild(pixelRect(12, 40, 4, 20, COLORS.book1));
  svg.appendChild(pixelRect(17, 42, 4, 18, COLORS.book2));
  svg.appendChild(pixelRect(22, 38, 4, 22, COLORS.book3));
  svg.appendChild(pixelRect(14, 48, 3, 12, COLORS.book4));
  
  // Whiteboard (right wall)
  svg.appendChild(pixelRect(174, 36, 20, 28, COLORS.whiteboardFrame));
  svg.appendChild(pixelRect(176, 38, 16, 24, COLORS.whiteboard));
  svg.appendChild(pixelRect(178, 42, 12, 2, '#a0aec0')); // fake text lines
  svg.appendChild(pixelRect(178, 48, 10, 2, '#a0aec0'));
  svg.appendChild(pixelRect(178, 54, 14, 2, '#a0aec0'));
  
  // Water cooler (center back)
  svg.appendChild(pixelRect(92, 52, 16, 24, COLORS.cooler));
  svg.appendChild(pixelRect(94, 54, 12, 18, COLORS.coolerWater));
  svg.appendChild(pixelRect(96, 56, 8, 14, '#bee3f8')); // water shine
  svg.appendChild(pixelRect(98, 72, 4, 4, COLORS.cooler)); // spigot
  
  // Desks (2 rows, 4 desks each)
  const deskPositions = [
    // Top row
    { x: 20, y: 68, agent: null },
    { x: 60, y: 68, agent: null },
    { x: 120, y: 68, agent: null },
    { x: 160, y: 68, agent: null },
    // Bottom row
    { x: 20, y: 100, agent: null },
    { x: 60, y: 100, agent: null },
    { x: 120, y: 100, agent: null },
    { x: 160, y: 100, agent: null },
  ];
  
  deskPositions.forEach((pos, i) => {
    // Desk surface
    svg.appendChild(pixelRect(pos.x, pos.y, 32, 8, COLORS.deskTop));
    // Desk front
    svg.appendChild(pixelRect(pos.x, pos.y + 8, 32, 12, COLORS.desk));
    // Desk legs
    svg.appendChild(pixelRect(pos.x + 2, pos.y + 20, 4, 8, COLORS.deskLeg));
    svg.appendChild(pixelRect(pos.x + 26, pos.y + 20, 4, 8, COLORS.deskLeg));
    // Monitor
    svg.appendChild(pixelRect(pos.x + 10, pos.y - 12, 12, 10, COLORS.monitor));
    svg.appendChild(pixelRect(pos.x + 12, pos.y - 10, 8, 6, COLORS.monitorScreen));
    // Monitor glow (subtle)
    svg.appendChild(pixelRect(pos.x + 14, pos.y - 8, 4, 2, 'rgba(77,163,255,0.3)'));
    // Chair
    svg.appendChild(pixelRect(pos.x + 8, pos.y + 24, 16, 6, COLORS.chairSeat));
    svg.appendChild(pixelRect(pos.x + 10, pos.y + 30, 12, 6, COLORS.chair));
  });
  
  // Plants (corners)
  // Bottom left plant
  svg.appendChild(pixelRect(8, 116, 8, 8, COLORS.pot));
  svg.appendChild(pixelRect(10, 108, 4, 8, COLORS.plant));
  svg.appendChild(pixelRect(14, 110, 4, 6, COLORS.plantDark));
  svg.appendChild(pixelRect(12, 106, 2, 2, COLORS.plant));
  
  // Bottom right plant
  svg.appendChild(pixelRect(184, 116, 8, 8, COLORS.pot));
  svg.appendChild(pixelRect(186, 108, 4, 8, COLORS.plant));
  svg.appendChild(pixelRect(190, 110, 4, 6, COLORS.plantDark));
  svg.appendChild(pixelRect(188, 106, 2, 2, COLORS.plant));
  
  // Rug (center floor)
  svg.appendChild(pixelRect(60, 96, 80, 12, COLORS.rug));
  svg.appendChild(pixelRect(62, 98, 76, 8, '#8b5e3c'));
  
  // Agent avatars at desks
  renderAgents(svg, deskPositions);
  
  return svg;
}

function renderLounge() {
  const svg = createPixelSVG();
  
  // Background - floor
  svg.appendChild(pixelRect(0, 80, ROOM_WIDTH, 60, '#744210'));
  svg.appendChild(pixelRect(0, 80, ROOM_WIDTH, 4, '#5c3317'));
  
  // Background - wall
  svg.appendChild(pixelRect(0, 0, ROOM_WIDTH, 80, '#553c2a'));
  svg.appendChild(pixelRect(0, 0, ROOM_WIDTH, 4, '#6b4c3a'));
  
  // Window (large, center)
  svg.appendChild(pixelRect(60, 16, 80, 40, COLORS.windowFrame));
  svg.appendChild(pixelRect(64, 20, 72, 32, COLORS.window));
  svg.appendChild(pixelRect(98, 20, 2, 32, COLORS.windowFrame));
  svg.appendChild(pixelRect(64, 34, 72, 2, COLORS.windowFrame));
  svg.appendChild(pixelRect(68, 24, 28, 8, COLORS.windowPane));
  svg.appendChild(pixelRect(108, 24, 28, 8, COLORS.windowPane));
  
  // TV (right wall)
  svg.appendChild(pixelRect(160, 24, 32, 24, '#1a202c'));
  svg.appendChild(pixelRect(162, 26, 28, 20, '#2d3748'));
  svg.appendChild(pixelRect(170, 30, 12, 8, 'rgba(77,163,255,0.4)')); // screen glow
  svg.appendChild(pixelRect(172, 48, 8, 4, '#4a5568')); // stand
  
  // Sofa (center-left)
  svg.appendChild(pixelRect(20, 64, 48, 16, '#744210')); // seat
  svg.appendChild(pixelRect(20, 52, 48, 12, '#8b5e3c')); // back
  svg.appendChild(pixelRect(16, 64, 4, 16, '#5c3317')); // arm left
  svg.appendChild(pixelRect(64, 64, 4, 16, '#5c3317')); // arm right
  svg.appendChild(pixelRect(24, 80, 4, 8, '#4a3015')); // leg
  svg.appendChild(pixelRect(56, 80, 4, 8, '#4a3015'));
  
  // Coffee table
  svg.appendChild(pixelRect(76, 72, 24, 4, COLORS.deskTop));
  svg.appendChild(pixelRect(80, 76, 4, 8, COLORS.deskLeg));
  svg.appendChild(pixelRect(92, 76, 4, 8, COLORS.deskLeg));
  
  // Plant
  svg.appendChild(pixelRect(12, 108, 8, 8, COLORS.pot));
  svg.appendChild(pixelRect(14, 100, 4, 8, COLORS.plant));
  svg.appendChild(pixelRect(18, 102, 4, 6, COLORS.plantDark));
  
  // Agents in lounge
  renderAgents(svg, [{ x: 24, y: 52 }, { x: 80, y: 68 }]);
  
  return svg;
}

function renderAgents(svg, positions) {
  if (!agentsData) return;
  
  const workingAgents = agentsData.agents.filter(a => a.status === 'working');
  const idleAgents = agentsData.agents.filter(a => a.status === 'idle');
  const offlineAgents = agentsData.agents.filter(a => a.status === 'offline');
  
  // Place working agents at desks (top row)
  workingAgents.forEach((agent, i) => {
    if (i < positions.length) {
      const pos = positions[i];
      renderAgentAt(svg, agent, pos.x + 14, pos.y - 8);
    }
  });
  
  // Place idle agents at lounge positions
  idleAgents.forEach((agent, i) => {
    const loungePos = i === 0 ? { x: 28, y: 56 } : { x: 84, y: 72 };
    renderAgentAt(svg, agent, loungePos.x, loungePos.y);
  });
  
  // Show offline agents dimmed
  offlineAgents.forEach((agent, i) => {
    const pos = positions[positions.length - 1 + i];
    if (pos) renderAgentAt(svg, agent, pos.x + 14, pos.y - 8, true);
  });
}

function renderAgentAt(svg, agent, x, y, offline = false) {
  const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.default;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', `agent-pixel${offline ? ' offline' : ''}`);
  g.setAttribute('transform', `translate(${x}, ${y})`);
  g.dataset.agent = agent.name;
  
  // Body
  g.appendChild(pixelRect(4, 8, 8, 12, colors.primary));
  // Head
  g.appendChild(pixelRect(6, 0, 6, 6, colors.accent));
  // Eyes
  g.appendChild(pixelRect(8, 2, 2, 2, '#0b0f14'));
  g.appendChild(pixelRect(12, 2, 2, 2, '#0b0f14'));
  // Arms
  g.appendChild(pixelRect(0, 10, 4, 8, colors.secondary));
  g.appendChild(pixelRect(12, 10, 4, 8, colors.secondary));
  
  // Status indicator (above head)
  const statusColor = offline ? '#666' : (agent.status === 'working' ? COLORS.plant : colors.primary);
  g.appendChild(pixelRect(7, -4, 2, 2, statusColor));
  
  // Click handler
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    showAgentPopup(agent, e);
  });
  
  svg.appendChild(g);
}

// ==================== POPUP ====================

function showAgentPopup(agent, event) {
  const popup = document.getElementById('agent-popup');
  const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.default;
  
  document.getElementById('popup-avatar').innerHTML = `<span style="color:${colors.primary}">${agent.label.charAt(0)}</span>`;
  document.getElementById('popup-name').textContent = agent.label;
  document.getElementById('popup-role').textContent = agent.role || 'AI Agent';
  document.getElementById('popup-status').innerHTML = `<span class="pill ${agent.status === 'working' ? 'up' : agent.status === 'idle' ? 'warn' : 'down'}"><span class="dot"></span>${agent.status}</span>`;
  document.getElementById('popup-task').textContent = agent.task || 'No active task';
  document.getElementById('popup-model').textContent = agent.model || '—';
  
  // Position popup
  const rect = event.target.getBoundingClientRect();
  popup.style.left = `${rect.left + rect.width / 2 - 120}px`;
  popup.style.top = `${rect.top - 10}px`;
  popup.classList.add('visible');
}

function hideAgentPopup() {
  document.getElementById('agent-popup').classList.remove('visible');
}

document.addEventListener('click', hideAgentPopup);

// ==================== ROOM SWITCHING ====================

function switchRoom(room) {
  currentRoom = room;
  const roomEl = document.getElementById('pixel-room');
  roomEl.innerHTML = '';
  roomEl.classList.remove('room-enter');
  void roomEl.offsetWidth; // force reflow
  roomEl.classList.add('room-enter');
  
  if (room === 'workspace') {
    roomEl.appendChild(renderWorkspace());
    document.getElementById('btn-workspace').className = 'primary';
    document.getElementById('btn-lounge').className = 'ghost';
  } else {
    roomEl.appendChild(renderLounge());
    document.getElementById('btn-workspace').className = 'ghost';
    document.getElementById('btn-lounge').className = 'primary';
  }
}

// ==================== DATA LOADING ====================

async function loadOfficeData() {
  try {
    const [agents, dashboard, activity] = await Promise.all([
      fetch('/api/agents').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/activity').then(r => r.json()),
    ]);
    
    agentsData = processAgentData(agents.agents);
    dashboardData = dashboard;
    activityData = activity;
    
    updateStatusSummary();
    updateUserList();
    updateChannelList();
    updateMiniFeed();
    
    if (currentRoom === 'workspace') {
      switchRoom('workspace');
    } else {
      switchRoom('lounge');
    }
  } catch (e) {
    console.error('Failed to load office data:', e);
  }
}

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

function updateStatusSummary() {
  if (!agentsData) return;
  const working = agentsData.filter(a => a.status === 'working').length;
  const idle = agentsData.filter(a => a.status === 'idle').length;
  const offline = agentsData.filter(a => a.status === 'offline').length;
  
  document.getElementById('count-working').textContent = working;
  document.getElementById('count-idle').textContent = idle;
  document.getElementById('count-offline').textContent = offline;
}

function updateUserList() {
  if (!agentsData) return;
  const list = document.getElementById('user-list');
  list.innerHTML = agentsData.map(a => {
    const colors = AGENT_COLORS[a.name] || AGENT_COLORS.default;
    return `
      <div class="user-item ${a.status}" onclick="showAgentPopupFor('${a.name}')">
        <div class="user-avatar" style="background:${colors.primary}">${a.label.charAt(0)}</div>
        <div class="user-info">
          <div class="user-name">${a.label}</div>
          <div class="user-status ${a.status}">${a.status}</div>
        </div>
      </div>
    `;
  }).join('');
}

function showAgentPopupFor(name) {
  const agent = agentsData?.find(a => a.name === name);
  if (!agent) return;
  // Create a fake event for positioning
  const fakeEvent = { target: document.activeElement, stopPropagation: () => {} };
  showAgentPopup(agent, fakeEvent);
}

function updateChannelList() {
  if (!dashboardData) return;
  const list = document.getElementById('channel-list');
  const platforms = dashboardData.platforms || [];
  
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
  if (!activityData) return;
  const feed = document.getElementById('mini-feed');
  const items = activityData.items?.slice(0, 5) || [];
  
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
      </div>
    `;
  }).join('');
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
  switchRoom('workspace');
  loadOfficeData();
  
  // Refresh every 30 seconds
  setInterval(loadOfficeData, 30000);
  
  // Also refresh on visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.visibilityState) return;
    loadOfficeData();
  });
});
