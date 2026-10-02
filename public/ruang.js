/**
 * Ruang — 3D Virtual Office for Hermes AI Team
 * Clean, smooth isometric office with real-time agent data
 */
'use strict';

class RuangOffice {
  constructor() {
    this.canvas = document.getElementById('office-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.agents = [];
    this.currentRoom = 'workspace';
    this.rotation = 0;
    this.zoom = 1;
    this.offset = { x: 0, y: 0 };
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.hoveredAgent = null;
    this.animFrame = null;
    this.lastUpdate = 0;
    
    this.colors = {
      floor: '#2a332d',
      floorGrid: '#1d221e',
      wall: '#151916',
      wallTop: '#1a211c',
      desk: '#3d2f1c',
      deskTop: '#4f3a28',
      chair: '#2c352e',
      monitor: '#1a202c',
      screen: '#5b9bd5',
      plant: '#4f9c7a',
      sofa: '#3d2f1c',
      arcade: '#9f7aea',
      pingpong: '#4fb986',
      counter: '#6b5230',
    };
    
    this.agentColors = {
      default: '#5b9bd5',
      leadenginer: '#4fb986',
      opencode: '#9f7aea',
    };
    
    this.roomLayouts = {
      workspace: { desks: 8, agents: [] },
      lounge: { seats: 4, agents: [] },
      recreation: { agents: [] },
      kitchen: { agents: [] },
    };
    
    this.init();
  }
  
  async init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupControls();
    await this.loadData();
    this.render();
    this.startAnimation();
  }
  
  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    if (this.canvas.width > 0 && this.canvas.height > 0) {
      this.render();
    }
  }
  
  setupControls() {
    // Mouse drag to pan
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.offset.x += dx;
      this.offset.y += dy;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.render();
    });
    
    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    
    // Scroll to zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.5, Math.min(3, this.zoom * factor));
      this.render();
    }, { passive: false });
    
    // Click to select agent
    this.canvas.addEventListener('click', (e) => {
      const agent = this.getAgentAt(e.clientX, e.clientY);
      if (agent) {
        this.showTooltip(agent, e.clientX, e.clientY);
      } else {
        this.hideTooltip();
      }
    });
    
    // Room selector
    document.querySelectorAll('.room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRoom = btn.dataset.room;
        this.render();
      });
    });
    
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchView(btn.dataset.view);
      });
    });
  }
  
  switchView(view) {
    // Hide all views
    document.querySelectorAll('main.office-view').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Show selected view
    const target = document.getElementById(`${view}-view`);
    if (target) {
      target.classList.remove('hidden');
    }
    
    // Update sync status
    this.updateSyncStatus();
  }
  
  async loadData() {
    try {
      const [agentsData, dashboardData] = await Promise.all([
        fetch('/api/agents').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
      ]);
      
      this.agents = this.processAgents(agentsData.agents);
      this.updateStatus();
      this.updateSyncStatus();
    } catch (e) {
      console.error('Failed to load data:', e);
      this.updateSyncStatus(true);
    }
    
    // Hide loading
    document.getElementById('loading').classList.add('hidden');
  }
  
  processAgents(rawAgents) {
    return rawAgents.map(a => {
      let status = 'offline';
      let task = null;
      
      if (a.opencode) {
        status = a.opencode.present ? 'idle' : 'offline';
        task = a.claimed_tasks?.[0]?.title || null;
      } else if (a.service) {
        if (a.service.state === 'up') {
          status = a.claimed_tasks?.length ? 'working' : 'idle';
          task = a.claimed_tasks?.[0]?.title || null;
        }
      }
      
      return {
        id: a.name,
        name: a.label,
        role: a.role,
        status,
        task,
        color: this.agentColors[a.name] || '#5b9bd5',
        model: a.model?.default_model,
      };
    });
  }
  
  updateStatus() {
    const working = this.agents.filter(a => a.status === 'working').length;
    const idle = this.agents.filter(a => a.status === 'idle').length;
    const offline = this.agents.filter(a => a.status === 'offline').length;
    
    document.getElementById('count-working').textContent = working;
    document.getElementById('count-idle').textContent = idle;
    document.getElementById('count-offline').textContent = offline;
  }
  
  updateSyncStatus(failed = false) {
    const el = document.getElementById('sync-status');
    if (failed) {
      el.textContent = 'API ERROR';
      el.classList.add('stale');
    } else {
      const now = new Date().toLocaleTimeString();
      el.textContent = `SYNCED ${now}`;
      el.classList.remove('stale');
    }
  }
  
  refresh() {
    this.loadData();
  }
  
  rotate(degrees) {
    this.rotation += degrees;
    this.render();
  }
  
  reset() {
    this.rotation = 0;
    this.zoom = 1;
    this.offset = { x: 0, y: 0 };
    this.render();
  }
  
  getAgentAt(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = x - rect.left - rect.width / 2 - this.offset.x;
    const cy = y - rect.top - rect.height / 2 - this.offset.y;
    
    for (const agent of this.agents) {
      const pos = this.getAgentPosition(agent);
      const dx = cx - pos.x;
      const dy = cy - pos.y;
      if (Math.abs(dx) < 25 && Math.abs(dy) < 35) {
        return agent;
      }
    }
    return null;
  }
  
  getAgentPosition(agent) {
    const index = this.agents.indexOf(agent);
    const room = this.currentRoom;
    
    // Different layouts for different rooms
    if (room === 'workspace') {
      const cols = 4;
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        x: -120 + col * 80,
        y: -40 + row * 60,
      };
    } else if (room === 'lounge') {
      const positions = [
        { x: -60, y: 0 },
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: -60, y: 50 },
      ];
      return positions[index % positions.length];
    } else if (room === 'recreation') {
      const positions = [
        { x: -80, y: -50 },
        { x: 0, y: -50 },
        { x: 80, y: -50 },
        { x: -80, y: 30 },
      ];
      return positions[index % positions.length];
    } else {
      return { x: -60 + index * 60, y: 0 };
    }
  }
  
  showTooltip(agent, x, y) {
    const tooltip = document.getElementById('agent-tooltip');
    const rect = this.canvas.getBoundingClientRect();
    
    document.getElementById('tooltip-avatar').textContent = this.getAgentEmoji(agent);
    document.getElementById('tooltip-avatar').style.background = agent.color;
    document.getElementById('tooltip-name').textContent = agent.name;
    document.getElementById('tooltip-role').textContent = agent.role?.split('—')[0]?.trim() || 'Agent';
    document.getElementById('tooltip-state').textContent = agent.status.charAt(0).toUpperCase() + agent.status.slice(1);
    document.getElementById('tooltip-dot').className = `status-dot ${agent.status}`;
    document.getElementById('tooltip-task').textContent = agent.task || 'No active task';
    
    // Position tooltip
    const tx = x - rect.left + 15;
    const ty = y - rect.top - 10;
    tooltip.style.left = `${tx}px`;
    tooltip.style.top = `${ty}px`;
    tooltip.classList.add('visible');
  }
  
  hideTooltip() {
    document.getElementById('agent-tooltip').classList.remove('visible');
  }
  
  getAgentEmoji(agent) {
    if (agent.id === 'default') return '🧭';
    if (agent.id === 'leadenginer') return '🛠️';
    if (agent.id === 'opencode') return '⚙️';
    return '👤';
  }
  
  // ===== RENDERING =====
  
  render() {
    if (!this.ctx) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    
    // Clear
    ctx.clearRect(0, 0, w, h);
    
    // Apply transforms
    ctx.save();
    ctx.translate(w / 2 + this.offset.x, h / 2 + this.offset.y);
    ctx.scale(this.zoom, this.zoom);
    ctx.rotate(this.rotation * Math.PI / 180);
    
    // Draw room
    this.drawRoom(ctx, w, h);
    
    // Draw agents
    for (const agent of this.agents) {
      this.drawAgent(ctx, agent);
    }
    
    ctx.restore();
  }
  
  drawRoom(ctx, w, h) {
    const room = this.currentRoom;
    
    // Floor
    ctx.fillStyle = this.colors.floor;
    ctx.fillRect(-200, -100, 400, 200);
    
    // Floor grid
    ctx.strokeStyle = this.colors.floorGrid;
    ctx.lineWidth = 1;
    for (let x = -200; x <= 200; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, -100);
      ctx.lineTo(x, 100);
      ctx.stroke();
    }
    for (let y = -100; y <= 100; y += 40) {
      ctx.beginPath();
      ctx.moveTo(-200, y);
      ctx.lineTo(200, y);
      ctx.stroke();
    }
    
    // Walls
    ctx.fillStyle = this.colors.wall;
    ctx.fillRect(-200, -150, 400, 50);
    
    ctx.fillStyle = this.colors.wallTop;
    ctx.fillRect(-200, -150, 400, 5);
    
    // Room-specific furniture
    if (room === 'workspace') {
      this.drawWorkspaceFurniture(ctx);
    } else if (room === 'lounge') {
      this.drawLoungeFurniture(ctx);
    } else if (room === 'recreation') {
      this.drawRecreationFurniture(ctx);
    } else if (room === 'kitchen') {
      this.drawKitchenFurniture(ctx);
    }
  }
  
  drawWorkspaceFurniture(ctx) {
    // Desks
    const desks = [
      { x: -120, y: -60 }, { x: -40, y: -60 }, { x: 40, y: -60 }, { x: 120, y: -60 },
      { x: -120, y: 0 }, { x: -40, y: 0 }, { x: 40, y: 0 }, { x: 120, y: 0 },
    ];
    
    for (const desk of desks) {
      // Desk top
      ctx.fillStyle = this.colors.deskTop;
      ctx.fillRect(desk.x - 30, desk.y - 15, 60, 30);
      
      // Desk legs
      ctx.fillStyle = this.colors.desk;
      ctx.fillRect(desk.x - 28, desk.y + 15, 4, 15);
      ctx.fillRect(desk.x + 24, desk.y + 15, 4, 15);
      
      // Monitor
      ctx.fillStyle = this.colors.monitor;
      ctx.fillRect(desk.x - 10, desk.y - 35, 20, 20);
      
      // Screen glow
      ctx.fillStyle = this.colors.screen;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(desk.x - 8, desk.y - 33, 16, 16);
      ctx.globalAlpha = 1;
    }
  }
  
  drawLoungeFurniture(ctx) {
    // Sofa
    ctx.fillStyle = this.colors.sofa;
    ctx.fillRect(-80, -30, 160, 40);
    
    // Cushions
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(-75, -25, 45, 30);
    ctx.fillRect(-25, -25, 45, 30);
    ctx.fillRect(25, -25, 45, 30);
    
    // Coffee table
    ctx.fillStyle = this.colors.deskTop;
    ctx.fillRect(-30, 30, 60, 30);
  }
  
  drawRecreationFurniture(ctx) {
    // Arcade machines
    ctx.fillStyle = this.colors.arcade;
    ctx.fillRect(-100, -50, 40, 60);
    ctx.fillRect(-40, -50, 40, 60);
    
    // Screen glow
    ctx.fillStyle = '#ff9d8f';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-95, -45, 30, 20);
    ctx.fillRect(-35, -45, 30, 20);
    ctx.globalAlpha = 1;
    
    // Ping pong table
    ctx.fillStyle = this.colors.pingpong;
    ctx.fillRect(40, -30, 80, 40);
    
    // Net
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, -30);
    ctx.lineTo(80, 10);
    ctx.stroke();
  }
  
  drawKitchenFurniture(ctx) {
    // Counter
    ctx.fillStyle = this.colors.counter;
    ctx.fillRect(-100, -40, 200, 30);
    
    // Sink
    ctx.fillStyle = '#63b3ed';
    ctx.fillRect(-60, -35, 40, 20);
    
    // Fridge
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(80, -50, 30, 50);
  }
  
  drawAgent(ctx, agent) {
    const pos = this.getAgentPosition(agent);
    const x = pos.x;
    const y = pos.y;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 35, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 25, 20, 35, 4);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(x, y - 35, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Status indicator
    const statusColor = agent.status === 'working' ? '#4fb986' : 
                       agent.status === 'idle' ? '#eab474' : '#5c655d';
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(x + 10, y - 40, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight if hovered
    if (this.hoveredAgent === agent) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 15, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Name label
    ctx.fillStyle = '#e5e1d8';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(agent.name.split(' ')[0], x, y + 50);
  }
  
  startAnimation() {
    const animate = (time) => {
      // Auto-refresh every 30 seconds
      if (time - this.lastUpdate > 30000) {
        this.loadData();
        this.lastUpdate = time;
      }
      
      // Smooth animation loop
      this.animFrame = requestAnimationFrame(animate);
    };
    this.animFrame = requestAnimationFrame(animate);
  }
  
  stopAnimation() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }
}

// Initialize
const ruang = new RuangOffice();