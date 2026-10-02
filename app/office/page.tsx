'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useApi } from '@/contexts/ApiContext';

interface Agent {
  name: string;
  label: string;
  status: 'working' | 'idle' | 'offline';
  task?: string;
  color: string;
}

export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { agents } = useApi();
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const processAgents = useCallback((rawAgents: any[]): Agent[] => {
    return rawAgents.map(a => {
      let status: 'working' | 'idle' | 'offline' = 'offline';
      let task = undefined;
      
      if (a.opencode) {
        status = a.opencode.present ? 'idle' : 'offline';
        task = a.claimed_tasks?.[0]?.title;
      } else if (a.service) {
        if (a.service.state === 'up') {
          status = a.claimed_tasks?.length ? 'working' : 'idle';
          task = a.claimed_tasks?.[0]?.title;
        }
      }
      
      return {
        name: a.name,
        label: a.label,
        status,
        task,
        color: a.name === 'default' ? '#5b9bd5' : a.name === 'leadenginer' ? '#4fb986' : '#9f7aea',
      };
    });
  }, []);

  const drawOffice = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0b0e0c');
    gradient.addColorStop(1, '#151916');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Apply transforms
    ctx.save();
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Draw isometric floor
    drawIsometricFloor(ctx, 400, 300);
    
    // Draw desks and agents
    const processedAgents = processAgents(agents);
    const cols = 4;
    const rows = Math.ceil(processedAgents.length / cols);
    
    processedAgents.forEach((agent, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = -120 + col * 80;
      const y = -60 + row * 70;
      
      drawDesk(ctx, x, y);
      drawAgent(ctx, agent, x, y + 30);
    });
    
    // Draw plants
    drawPlant(ctx, -180, -80);
    drawPlant(ctx, 180, -80);
    drawPlant(ctx, -180, 120);
    drawPlant(ctx, 180, 120);
    
    ctx.restore();
  }, [agents, rotation, zoom, offset, processAgents]);

  const drawIsometricFloor = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Floor base
    ctx.fillStyle = '#1a211c';
    ctx.fillRect(-width / 2, -height / 2, width, height);
    
    // Grid lines
    ctx.strokeStyle = '#2a332d';
    ctx.lineWidth = 1;
    
    for (let x = -width / 2; x <= width / 2; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, -height / 2);
      ctx.lineTo(x, height / 2);
      ctx.stroke();
    }
    
    for (let y = -height / 2; y <= height / 2; y += 40) {
      ctx.beginPath();
      ctx.moveTo(-width / 2, y);
      ctx.lineTo(width / 2, y);
      ctx.stroke();
    }
  };

  const drawDesk = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Desk top
    ctx.fillStyle = '#3d2f1c';
    ctx.fillRect(x - 30, y - 15, 60, 30);
    
    // Desk legs
    ctx.fillStyle = '#2a1f14';
    ctx.fillRect(x - 28, y + 15, 4, 15);
    ctx.fillRect(x + 24, y + 15, 4, 15);
    
    // Monitor
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(x - 10, y - 35, 20, 20);
    
    // Screen glow
    ctx.fillStyle = 'rgba(91, 155, 213, 0.6)';
    ctx.fillRect(x - 8, y - 33, 16, 16);
  };

  const drawAgent = (ctx: CanvasRenderingContext2D, agent: Agent, x: number, y: number) => {
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
    
    // Pulse animation for working
    if (agent.status === 'working') {
      ctx.strokeStyle = 'rgba(79, 185, 134, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 10, y - 40, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const drawPlant = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Pot
    ctx.fillStyle = '#6b5230';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 10);
    ctx.lineTo(x + 8, y + 10);
    ctx.lineTo(x + 6, y - 5);
    ctx.lineTo(x - 6, y - 5);
    ctx.closePath();
    ctx.fill();
    
    // Leaves
    ctx.fillStyle = '#4f9c7a';
    ctx.beginPath();
    ctx.arc(x, y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x - 6, y - 5, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x + 6, y - 5, 7, 0, Math.PI * 2);
    ctx.fill();
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        drawOffice();
      }
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    return () => window.removeEventListener('resize', resize);
  }, [drawOffice]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * factor)));
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const processedAgents = processAgents(agents);
    let found: Agent | null = null;
    
    processedAgents.forEach((agent, index) => {
      const cols = 4;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const agentX = -120 + col * 80 + offset.x;
      const agentY = -60 + row * 70 + offset.y;
      
      const dx = (x - canvas.width / 2) / zoom - agentX;
      const dy = (y - canvas.height / 2) / zoom - agentY;
      
      if (Math.abs(dx) < 25 && Math.abs(dy) < 35) {
        found = agent;
      }
    });
    
    setSelectedAgent(found);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">3D Office</h1>
          <p className="text-dark-400 mt-1">Interactive isometric view of your AI team</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRotation(r => r - 15)} className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white text-sm">↺ Rotate</button>
          <button onClick={() => { setRotation(0); setZoom(1); setOffset({ x: 0, y: 0 }); }} className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white text-sm">Reset</button>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden" style={{ height: '600px' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
        />
        
        {/* Info overlay */}
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="px-3 py-1 rounded-full bg-dark-800/80 backdrop-blur text-dark-300 text-xs">
            Drag to pan
          </span>
          <span className="px-3 py-1 rounded-full bg-dark-800/80 backdrop-blur text-dark-300 text-xs">
            Scroll to zoom
          </span>
        </div>
        
        {/* Agent tooltip */}
        {selectedAgent && (
          <div className="absolute top-4 right-4 glass-card rounded-lg p-4 max-w-xs">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: selectedAgent.color }}
              >
                {selectedAgent.label.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-white">{selectedAgent.label}</div>
                <div className="text-xs text-dark-400">{selectedAgent.status}</div>
              </div>
            </div>
            {selectedAgent.task && (
              <div className="mt-2 pt-2 border-t border-dark-700 text-sm text-dark-300">
                {selectedAgent.task}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}