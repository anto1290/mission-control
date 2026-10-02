'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useApi } from '@/contexts/ApiContext';

interface Station {
  id: string;
  name: string;
  role: string;
  room: 'Workspace' | 'Lounge';
  roomPosition: string;
  seat: number;
  state: 'Idle' | 'Working' | 'Reviewing' | 'Collaborating' | 'Offline' | 'Unknown';
  currentTask: string;
  recentActivity: string;
  activity: string;
  provenance: string;
  freshness: string;
}

export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { dashboard, runtime, loading } = useApi();
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Get office stations from dashboard or fetch separately
  const [stations, setStations] = useState<Station[]>([]);

  // Fetch stations
  useEffect(() => {
    fetch('/api/office')
      .then(r => r.json())
      .then(data => setStations(data.stations || []))
      .catch(console.error);
  }, []);

  // Fetch stations if not available
  useEffect(() => {
    if (stations.length === 0) {
      fetch('http://localhost:3001/api/office')
        .then(r => r.json())
        .then(data => {
          // This would need a separate state, but for now we use dashboard
        })
        .catch(console.error);
    }
  }, [stations.length]);

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
    
    // Draw desks and agents from stations
    const cols = 4;
    stations.forEach((station, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = -120 + col * 80;
      const y = -60 + row * 70;
      
      drawDesk(ctx, x, y);
      drawAgent(ctx, station, x, y + 30);
    });
    
    // Draw plants
    drawPlant(ctx, -180, -80);
    drawPlant(ctx, 180, -80);
    drawPlant(ctx, -180, 120);
    drawPlant(ctx, 180, 120);
    
    ctx.restore();
  }, [stations, rotation, zoom, offset]);

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

  const drawAgent = (ctx: CanvasRenderingContext2D, station: Station, x: number, y: number) => {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 35, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    const color = station.id === 'default' ? '#5b9bd5' : station.id === 'leadenginer' ? '#4fb986' : '#9f7aea';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 25, 20, 35, 4);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(x, y - 35, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Status indicator
    const statusColor = station.state === 'Working' || station.state === 'Collaborating' || station.state === 'Reviewing'
      ? '#4fb986' 
      : station.state === 'Idle' ? '#eab474' : '#5c655d';
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(x + 10, y - 40, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pulse animation for working
    if (station.state === 'Working' || station.state === 'Collaborating') {
      ctx.strokeStyle = 'rgba(79, 185, 134, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 10, y - 40, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Name label
    ctx.fillStyle = '#e5e1d8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(station.name, x, y + 50);
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
    
    const cols = 4;
    let found: Station | null = null;
    
    stations.forEach((station, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const agentX = -120 + col * 80 + offset.x;
      const agentY = -60 + row * 70 + offset.y;
      
      const dx = (x - canvas.width / 2) / zoom - agentX;
      const dy = (y - canvas.height / 2) / zoom - agentY;
      
      if (Math.abs(dx) < 25 && Math.abs(dy) < 35) {
        found = station;
      }
    });
    
    setSelectedStation(found);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">3D Office</h1>
          <p className="text-slate-400 mt-1">Interactive isometric view of your AI team</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRotation(r => r - 15)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm">↺ Rotate</button>
          <button onClick={() => { setRotation(0); setZoom(1); setOffset({ x: 0, y: 0 }); }} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm">Reset</button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-700" style={{ height: '600px' }}>
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
          <span className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-slate-300 text-xs">
            Drag to pan
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-slate-300 text-xs">
            Scroll to zoom
          </span>
        </div>
        
        {/* Station tooltip */}
        {selectedStation && (
          <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur rounded-lg p-4 max-w-xs border border-slate-700">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: selectedStation.id === 'default' ? '#5b9bd5' : selectedStation.id === 'leadenginer' ? '#4fb986' : '#9f7aea' }}
              >
                {selectedStation.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-white">{selectedStation.name}</div>
                <div className="text-xs text-slate-400">{selectedStation.state}</div>
              </div>
            </div>
            {selectedStation.activity && (
              <div className="mt-2 pt-2 border-t border-slate-700 text-sm text-slate-300">
                {selectedStation.activity}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Station info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((station) => (
          <div key={station.id} className="card cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => setSelectedStation(station)}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: station.id === 'default' ? '#5b9bd5' : station.id === 'leadenginer' ? '#4fb986' : '#9f7aea' }}
              >
                {station.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium">{station.name}</p>
                <p className="text-slate-400 text-sm">{station.role}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                station.state === 'Working' || station.state === 'Collaborating'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : station.state === 'Idle'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {station.state}
              </span>
              <span className="text-xs text-slate-500">{station.room}</span>
            </div>
            {station.activity && (
              <p className="mt-2 text-xs text-slate-400">{station.activity}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}