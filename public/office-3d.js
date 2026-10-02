/**
 * 3D Isometric Visual Office
 * Renders a low-poly 3D office with real Hermes agent data
 */
'use strict';

class IsometricOffice {
  constructor() {
    this.currentRoom = 'office';
    this.rotation = 0;
    this.agents = [];
    this.container = null;
    
    this.colors = {
      floor: '#DEB887',
      floorDark: '#C4A26C',
      wall: '#F5F5DC',
      wallShadow: '#E8E8D0',
      desk: '#8B4513',
      deskTop: '#A0522D',
      chair: '#4a5568',
      monitor: '#1a202c',
      monitorScreen: '#4da3ff',
      plant: '#48bb78',
      plantPot: '#8B4513',
      sofa: '#4299e1',
      sofaDark: '#2b6cb0',
      arcadesh: '#9f7aea',
      pingpong: '#48bb78',
      kitchenCounter: '#a07818',
    };
    
    this.agentColors = {
      default: '#4da3ff',
      leadenginer: '#37c871',
      opencode: '#b48cff',
    };
  }
  
  async init() {
    this.container = document.getElementById('iso-container');
    if (!this.container) return;
    
    // Load data
    const [agents, dashboard, activity] = await Promise.all([
      fetch('/api/agents').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/activity').then(r => r.json()),
    ]);
    
    this.agents = this.processAgents(agents.agents);
    this.dashboard = dashboard;
    this.activity = activity;
    
    // Setup event listeners
    this.setupControls();
    
    // Initial render
    this.render();
    this.updateStatus();
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
        name: a.name,
        label: a.label,
        role: a.role,
        status,
        task,
        model: a.model?.default_model,
        color: this.agentColors[a.name] || '#4da3ff',
      };
    });
  }
  
  setupControls() {
    // Room selector
    document.querySelectorAll('.iso-room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.iso-room-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRoom = btn.dataset.room;
        this.render();
      });
    });
    
    // Mouse drag to rotate
    let isDragging = false;
    let startX = 0;
    
    this.container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.iso-room-btn') || e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      this.rotate(delta * 0.5);
      startX = e.clientX;
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // Touch support
    this.container.addEventListener('touchstart', (e) => {
      if (e.target.closest('.iso-room-btn') || e.target.closest('button')) return;
      isDragging = true;
      startX = e.touches[0].clientX;
    });
    
    this.container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const delta = e.touches[0].clientX - startX;
      this.rotate(delta * 0.5);
      startX = e.touches[0].clientX;
    });
    
    this.container.addEventListener('touchend', () => {
      isDragging = false;
    });
    
    // Scroll to zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 0.95 : 1.05;
      this.zoom(scale);
    }, { passive: false });
  }
  
  rotate(degrees) {
    this.rotation += degrees;
    this.render();
  }
  
  zoom(factor) {
    const container = this.container;
    const currentScale = parseFloat(container.dataset.scale || 1);
    const newScale = Math.max(0.5, Math.min(2, currentScale * factor));
    container.dataset.scale = newScale;
    container.style.transform = `scale(${newScale})`;
  }
  
  reset() {
    this.rotation = 0;
    const container = this.container;
    container.dataset.scale = 1;
    container.style.transform = 'scale(1) rotateY(0deg)';
    this.render();
  }
  
  updateStatus() {
    const working = this.agents.filter(a => a.status === 'working').length;
    const idle = this.agents.filter(a => a.status === 'idle').length;
    const offline = this.agents.filter(a => a.status === 'offline').length;
    
    document.getElementById('count-working').textContent = working;
    document.getElementById('count-idle').textContent = idle;
    document.getElementById('count-offline').textContent = offline;
  }
  
  render() {
    const container = this.container;
    container.innerHTML = '';
    container.dataset.scale = container.dataset.scale || 1;
    
    // Apply rotation
    const transform = `rotateY(${this.rotation}deg)`;
    container.style.transform = transform;
    
    // Render based on current room
    switch (this.currentRoom) {
      case 'office':
        this.renderOffice(container);
        break;
      case 'lounge':
        this.renderLounge(container);
        break;
      case 'rec':
        this.renderRecRoom(container);
        break;
      case 'kitchen':
        this.renderKitchen(container);
        break;
    }
    
    this.updateStatus();
  }
  
  renderOffice(container) {
    // Office room - main workspace
    const room = this.createRoom('Office', this.colors.floor);
    
    // Add desks with agents
    const deskPositions = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 250, y: 50 },
      { x: 50, y: 150 },
      { x: 150, y: 150 },
      { x: 250, y: 150 },
    ];
    
    this.agents.forEach((agent, i) => {
      if (i < deskPositions.length) {
        const pos = deskPositions[i];
        const desk = this.createDesk(pos.x, pos.y);
        const agentEl = this.createAgent(agent, pos.x + 20, pos.y + 10, agent.status === 'working');
        room.appendChild(desk);
        room.appendChild(agentEl);
      }
    });
    
    // Add plants
    room.appendChild(this.createPlant(20, 20));
    room.appendChild(this.createPlant(320, 20));
    room.appendChild(this.createPlant(20, 220));
    room.appendChild(this.createPlant(320, 220));
    
    container.appendChild(room);
  }
  
  renderLounge(container) {
    const room = this.createRoom('Lounge', '#8B7355');
    
    // Couch
    const couch = document.createElement('div');
    couch.className = 'iso-furniture';
    couch.style.cssText = `
      position: absolute;
      width: 120px;
      height: 40px;
      background: ${this.colors.sofa};
      transform: rotateX(60deg) rotateZ(45deg) translate(100px, 100px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    room.appendChild(couch);
    
    // Coffee table
    const table = document.createElement('div');
    table.className = 'iso-furniture';
    table.style.cssText = `
      position: absolute;
      width: 60px;
      height: 40px;
      background: ${this.colors.deskTop};
      transform: rotateX(60deg) rotateZ(45deg) translate(130px, 160px);
    `;
    room.appendChild(table);
    
    // Idle agents on couch
    const idleAgents = this.agents.filter(a => a.status === 'idle');
    idleAgents.forEach((agent, i) => {
      const pos = 80 + i * 40;
      const agentEl = this.createAgent(agent, pos, 90, false);
      room.appendChild(agentEl);
    });
    
    container.appendChild(room);
  }
  
  renderRecRoom(container) {
    const room = this.createRoom('Rec Room', '#6B5B4B');
    
    // Arcade machine
    const arcade = document.createElement('div');
    arcade.className = 'iso-furniture';
    arcade.style.cssText = `
      position: absolute;
      width: 40px;
      height: 60px;
      background: ${this.colors.arcadesh};
      transform: rotateX(60deg) rotateZ(45deg) translate(200px, 50px);
      box-shadow: 0 0 20px rgba(159, 122, 234, 0.5);
    `;
    room.appendChild(arcade);
    
    // Ping pong table
    const pingpong = document.createElement('div');
    pingpong.className = 'iso-furniture';
    pingpong.style.cssText = `
      position: absolute;
      width: 80px;
      height: 40px;
      background: ${this.colors.pingpong};
      transform: rotateX(60deg) rotateZ(45deg) translate(100px, 120px);
    `;
    room.appendChild(pingpong);
    
    container.appendChild(room);
  }
  
  renderKitchen(container) {
    const room = this.createRoom('Kitchen', '#D2B48C');
    
    // Counter
    const counter = document.createElement('div');
    counter.className = 'iso-furniture';
    counter.style.cssText = `
      position: absolute;
      width: 100px;
      height: 40px;
      background: ${this.colors.kitchenCounter};
      transform: rotateX(60deg) rotateZ(45deg) translate(50px, 50px);
    `;
    room.appendChild(counter);
    
    // Water dispenser
    const dispenser = document.createElement('div');
    dispenser.className = 'iso-furniture';
    dispenser.style.cssText = `
      position: absolute;
      width: 30px;
      height: 50px;
      background: #63b3ed;
      transform: rotateX(60deg) rotateZ(45deg) translate(200px, 50px);
      border-radius: 4px;
    `;
    room.appendChild(dispenser);
    
    container.appendChild(room);
  }
  
  createRoom(label, floorColor) {
    const room = document.createElement('div');
    room.style.cssText = `
      position: absolute;
      width: 400px;
      height: 250px;
      transform-style: preserve-3d;
      transform: rotateX(60deg) rotateZ(45deg) translate(50px, 50px);
    `;
    
    // Floor
    const floor = document.createElement('div');
    floor.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      background: ${floorColor};
      border: 2px solid rgba(0,0,0,0.2);
    `;
    room.appendChild(floor);
    
    // Walls
    const backWall = document.createElement('div');
    backWall.style.cssText = `
      position: absolute;
      width: 100%;
      height: 150px;
      background: ${this.colors.wall};
      transform: translateZ(75px);
      transform-origin: bottom;
      border: 1px solid #DDD;
    `;
    room.appendChild(backWall);
    
    // Room name label
    const roomLabel = document.createElement('div');
    roomLabel.className = 'iso-room-label';
    roomLabel.textContent = label;
    roomLabel.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%) translateZ(100px);
    `;
    room.appendChild(roomLabel);
    
    return room;
  }
  
  createDesk(x, y) {
    const desk = document.createElement('div');
    desk.className = 'iso-furniture';
    desk.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 60px;
      height: 40px;
      transform-style: preserve-3d;
    `;
    
    // Desk top
    const top = document.createElement('div');
    top.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      background: ${this.colors.deskTop};
      transform: rotateX(60deg) rotateZ(45deg);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    desk.appendChild(top);
    
    // Monitor
    const monitor = document.createElement('div');
    monitor.style.cssText = `
      position: absolute;
      width: 20px;
      height: 15px;
      background: ${this.colors.monitor};
      transform: translate(20px, -20px) translateZ(30px);
      border-radius: 2px;
    `;
    desk.appendChild(monitor);
    
    // Screen glow
    const screen = document.createElement('div');
    screen.style.cssText = `
      position: absolute;
      width: 16px;
      height: 11px;
      background: ${this.colors.monitorScreen};
      transform: translate(22px, -18px) translateZ(31px);
      opacity: 0.8;
      border-radius: 1px;
    `;
    desk.appendChild(screen);
    
    return desk;
  }
  
  createAgent(agent, x, y, isActive) {
    const el = document.createElement('div');
    el.className = `iso-agent ${isActive ? 'active' : ''}`;
    el.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      --agent-color: ${agent.color};
    `;
    
    // Head
    const head = document.createElement('div');
    head.className = 'iso-agent-head';
    el.appendChild(head);
    
    // Body
    const body = document.createElement('div');
    body.className = 'iso-agent-body';
    el.appendChild(body);
    
    // Status dot
    const status = document.createElement('div');
    status.className = `iso-status ${agent.status}`;
    el.appendChild(status);
    
    // Speech bubble
    const speech = document.createElement('div');
    speech.className = 'iso-speech';
    speech.textContent = agent.task || agent.status.charAt(0).toUpperCase() + agent.status.slice(1);
    el.appendChild(speech);
    
    // Click handler
    el.addEventListener('click', () => {
      this.showAgentDetail(agent);
    });
    
    return el;
  }
  
  createPlant(x, y) {
    const plant = document.createElement('div');
    plant.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 20px;
      height: 30px;
    `;
    
    // Pot
    const pot = document.createElement('div');
    pot.style.cssText = `
      position: absolute;
      bottom: 0;
      width: 16px;
      height: 10px;
      background: ${this.colors.plantPot};
      border-radius: 0 0 4px 4px;
    `;
    plant.appendChild(pot);
    
    // Leaves
    const leaves = document.createElement('div');
    leaves.style.cssText = `
      position: absolute;
      bottom: 8px;
      left: 2px;
      width: 16px;
      height: 20px;
      background: ${this.colors.plant};
      border-radius: 50% 50% 0 0;
    `;
    plant.appendChild(leaves);
    
    return plant;
  }
  
  showAgentDetail(agent) {
    alert(`
${agent.label} (${agent.name})
Status: ${agent.status}
Task: ${agent.task || 'None'}
Model: ${agent.model || 'N/A'}
Role: ${agent.role}
    `.trim());
  }
}

// Initialize
const isoOffice = new IsometricOffice();
isoOffice.init();