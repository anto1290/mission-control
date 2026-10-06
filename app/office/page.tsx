'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useApi } from '@/contexts/ApiContext';

interface Station {
  id: string;
  name: string;
  model: string;
  gateway: string;
  room: 'Workspace' | 'Lounge' | 'Meeting';
  seat: number;
  color: string;
}

export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { dashboard, loading } = useApi();
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const animationRef = useRef<number>();
  
  // Fetch stations from API
  useEffect(() => {
    fetch('/api/office')
      .then(r => r.json())
      .then(data => {
        if (data.stations) {
          setStations(data.stations.map((s: any, index: number) => ({
            id: s.id || s.name || `station-${index}`,
            name: s.name,
            model: s.model || 'Unknown',
            gateway: s.state === 'Working' ? 'Running' : s.state === 'Offline' ? 'Stopped' : 'Idle',
            room: s.room || 'Workspace',
            seat: s.seat || index + 1,
            color: s.color || '#5b9bd5'
          })));
        }
      })
      .catch(console.error);
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
    
    // Draw office layout
    drawFloor(ctx, -150, -120, 300, 200, '#8B7355');
    drawFloor(ctx, -120, -100, 120, 80, '#A0896C');
    drawFloor(ctx, -120, 20, 80, 60, '#E8E8E8');
    drawFloor(ctx, 40, -100, 80, 80, '#C4B8A0');
    drawFloor(ctx, -120, 80, 100, 60, '#B8A890');
    drawFloor(ctx, 40, 60, 100, 60, '#A09080');
    
    // Walls
    drawWall(ctx, -150, -120, 300, 80, 2, '#E8DCC4');
    drawWall(ctx, -150, -120, 2, 200, 80, '#E8DCC4');
    drawWall(ctx, -40, -40, 2, 60, 40, '#D4C4A8');
    drawWall(ctx, 40, -100, 60, 2, 40, '#D4C4A8');
    drawWall(ctx, -120, 20, 80, 2, 40, '#D4C4A8');
    
    // Reception desk
    drawBox(ctx, -100, 30, 0, 60, 20, 30, '#c4a77d', '#a08050', '#806040');
    
    // Workspace desks
    drawDesk(ctx, -90, -70, 0);
    drawDesk(ctx, -30, -70, 0);
    drawDesk(ctx, 30, -70, 0);
    drawDesk(ctx, -90, -20, 0);
    drawDesk(ctx, -30, -20, 0);
    drawDesk(ctx, 30, -20, 0);
    
    // Chairs
    drawChair(ctx, -90, -45, 0);
    drawChair(ctx, -30, -45, 0);
    drawChair(ctx, 30, -45, 0);
    drawChair(ctx, -90, 5, 0);
    drawChair(ctx, -30, 5, 0);
    drawChair(ctx, 30, 5, 0);
    
    // Plants
    drawPlant(ctx, -110, -95, 0);
    drawPlant(ctx, 50, -95, 0);
    drawPlant(ctx, -130, -110, 0);
    drawPlant(ctx, 110, -110, 0);
    drawPlant(ctx, -130, 130, 0);
    drawPlant(ctx, 110, 130, 0);
    
    // Kitchen tables
    drawTable(ctx, 60, -80, 0);
    drawTable(ctx, 60, -40, 0);
    
    // Lounge sofa
    drawBox(ctx, 60, 70, 0, 50, 20, 15, '#e2e8f0', '#b0bec5', '#90a4ae');
    
    // Classroom tables
    for (let i = 0; i < 3; i++) {
      drawTable(ctx, -100 + i * 30, 95, 0, 25, 40);
    }
    
    // Meeting table
    drawTable(ctx, 70, 70, 0, 50, 50);
    
    // Draw stations
    stations.forEach((station, index) => {
      const pos = getStationPosition(station, index);
      drawAgent(ctx, station, pos.x, pos.y);
    });
    
    ctx.restore();
  }, [stations, rotation, zoom, offset]);
  
  const getStationPosition = (station: Station, index: number) => {
    const positions: Record<string, { x: number; y: number }[]> = {
      'Workspace': [
        { x: -100, y: -80 }, { x: -40, y: -80 }, { x: 20, y: -80 },
        { x: -100, y: -30 }, { x: -40, y: -30 }, { x: 20, y: -30 }
      ],
      'Meeting': [
        { x: -60, y: 40 }, { x: 0, y: 40 }
      ],
      'Lounge': [
        { x: 60, y: 40 }
      ]
    };
    
    const roomPositions = positions[station.room] || positions['Workspace'];
    return roomPositions[Math.min(index, roomPositions.length - 1)] || { x: 0, y: 0 };
  };
  
  // Helper functions for drawing
  const isoProject = (cx: number, cy: number, cz: number = 0) => {
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const isoX = (cx - cy) * 0.866;
    const isoY = (cx + cy) * 0.5 - cz;
    
    const rotX = isoX * cos - isoY * sin;
    const rotY = isoX * sin + isoY * cos;
    
    return {
      x: rotX,
      y: rotY
    };
  };
  
  const drawFloor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, color: string) => {
    const p = [
      isoProject(x, y),
      isoProject(x + w, y),
      isoProject(x + w, y + d),
      isoProject(x, y + d)
    ];
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.lineTo(p[2].x, p[2].y);
    ctx.lineTo(p[3].x, p[3].y);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  
  const drawBox = (ctx: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number, topColor: string, leftColor: string, rightColor: string) => {
    const points = {
      bl: isoProject(x, y, z),
      br: isoProject(x + w, y, z),
      fl: isoProject(x, y + d, z),
      fr: isoProject(x + w, y + d, z),
      tbl: isoProject(x, y, z + h),
      tbr: isoProject(x + w, y, z + h),
      tfbl: isoProject(x, y + d, z + h),
      tfr: isoProject(x + w, y + d, z + h)
    };
    
    // Right face
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(points.bl.x, points.bl.y);
    ctx.lineTo(points.br.x, points.br.y);
    ctx.lineTo(points.tbr.x, points.tbr.y);
    ctx.lineTo(points.tbl.x, points.tbl.y);
    ctx.closePath();
    ctx.fill();
    
    // Left face
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(points.bl.x, points.bl.y);
    ctx.lineTo(points.fl.x, points.fl.y);
    ctx.lineTo(points.tfbl.x, points.tfbl.y);
    ctx.lineTo(points.tbl.x, points.tbl.y);
    ctx.closePath();
    ctx.fill();
    
    // Top face
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(points.tbl.x, points.tbl.y);
    ctx.lineTo(points.tbr.x, points.tbr.y);
    ctx.lineTo(points.tfr.x, points.tfr.y);
    ctx.lineTo(points.tfbl.x, points.tfbl.y);
    ctx.closePath();
    ctx.fill();
  };
  
  const drawDesk = (ctx: CanvasRenderingContext2D, x: number, y: number, z: number) => {
    const deskH = 15;
    const deskW = 40;
    const deskD = 25;
    
    drawBox(ctx, x, y, z, deskW, deskD, deskH, '#8B7355', '#6B5345', '#5B4335');
    
    // Monitor
    drawBox(ctx, x + 10, y + 5, z + deskH, 20, 2, 18, '#1a202c', '#0f172a', '#0f172a');
    
    // Screen glow
    const screenPos = isoProject(x + 15, y + 6, z + deskH + 10);
    ctx.fillStyle = 'rgba(91, 155, 213, 0.4)';
    ctx.fillRect(screenPos.x - 10, screenPos.y - 8, 20, 16);
  };
  
  const drawChair = (ctx: CanvasRenderingContext2D, x: number, y: number, z: number) => {
    drawBox(ctx, x, y, z, 12, 12, 12, '#4a5568', '#374151', '#1f2937');
  };
  
  const drawPlant = (ctx: CanvasRenderingContext2D, x: number, y: number, z: number) => {
    drawBox(ctx, x - 5, y - 5, z, 10, 10, 12, '#6b5230', '#4a3720', '#3d2f1c');
    
    const leafColors = ['#4f9c7a', '#3d7a5f', '#5aaa8a'];
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 6;
      const pos = isoProject(x + offset, y, z + 12);
      ctx.fillStyle = leafColors[i];
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  const drawTable = (ctx: CanvasRenderingContext2D, x: number, y: number, z: number, w = 40, d = 40) => {
    drawBox(ctx, x, y, z, w, d, 5, '#8B7355', '#6B5345', '#5B4335');
    
    const legPositions = [[0, 0], [w, 0], [0, d], [w, d]];
    legPositions.forEach(([lx, ly]) => {
      drawBox(ctx, x + lx - 2, y + ly - 2, z - 25, 4, 4, 25, '#5a4a3a', '#4a3a2a', '#3a2a1a');
    });
  };
  
  const drawWall = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, color: string) => {
    drawBox(ctx, x, y, 0, w, d, h, color, '#c4b8a0', '#a09080');
  };
  
  const drawAgent = (ctx: CanvasRenderingContext2D, station: Station, cx: number, cy: number) => {
    const pos = isoProject(cx, cy, 0);
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 5, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    const isActive = station.gateway === 'Running';
    ctx.fillStyle = isActive ? station.color : '#4a5568';
    ctx.beginPath();
    ctx.roundRect(pos.x - 10, pos.y - 25, 20, 30, 4);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 35, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Status indicator
    const statusColor = isActive ? '#4fb986' : '#5c655d';
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(pos.x + 10, pos.y - 40, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pulse animation for active
    if (isActive) {
      ctx.strokeStyle = 'rgba(79, 185, 134, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x + 10, pos.y - 40, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Name label
    ctx.fillStyle = '#e5e1d8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(station.name, pos.x, pos.y + 45);
    
    // Hover effect
    if (hoveredStation === station) {
      ctx.strokeStyle = '#4fb986';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - 20, 25, 0, Math.PI * 2);
      ctx.stroke();
    }
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
    
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawOffice]);
  
  // Auto rotate
  useEffect(() => {
    if (autoRotate) {
      const animate = () => {
        setRotation(r => r + 0.3);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoRotate]);
  
  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
    
    // Check hover
    checkHover(e);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * factor)));
  };
  
  const checkHover = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let found: Station | null = null;
    stations.forEach((station, index) => {
      const pos = getStationPosition(station, index);
      const canvasPos = isoProject(pos.x, pos.y, 0);
      
      const dx = (x - canvas.width / 2) / zoom - pos.x;
      const dy = (y - canvas.height / 2) / zoom - pos.y;
      
      if (Math.abs(dx) < 25 && Math.abs(dy) < 35) {
        found = station;
      }
    });
    
    if (found !== hoveredStation) {
      setHoveredStation(found);
      canvas.style.cursor = found ? 'pointer' : 'grab';
      drawOffice();
    }
  };
  
  const handleClick = (e: React.MouseEvent) => {
    if (hoveredStation) {
      setSelectedStation(hoveredStation);
    }
  };
  
  const resetView = () => {
    setRotation(0);
    setZoom(0.8);
    setOffset({ x: 0, y: 0 });
  };
  
  const activeCount = stations.filter(s => s.gateway === 'Running').length;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">3D Office</h1>
          <p className="text-slate-400 mt-1">Interactive isometric view of your AI team</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={resetView} 
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors"
          >
            Reset View
          </button>
          <button 
            onClick={() => setAutoRotate(!autoRotate)} 
            className={`px-4 py-2 rounded-lg text-white text-sm transition-colors ${autoRotate ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {autoRotate ? 'Stop Rotate' : 'Auto Rotate'}
          </button>
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
          onClick={handleClick}
        />
        
        {/* Info badges */}
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-slate-300 text-xs">
            Stations: {stations.length}
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-slate-300 text-xs">
            Active: {activeCount}
          </span>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-slate-300 text-xs">
            Drag to pan
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-slate-300 text-xs">
            Scroll to zoom
          </span>
        </div>
        
        {/* Selected station tooltip */}
        {selectedStation && (
          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg p-4 max-w-xs border border-slate-700">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: selectedStation.color }}
              >
                {selectedStation.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-white">{selectedStation.name}</div>
                <div className="text-xs text-slate-400">{selectedStation.model}</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                selectedStation.gateway === 'Running'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {selectedStation.gateway}
              </span>
              <span className="text-xs text-slate-500">{selectedStation.room}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Station info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((station, index) => (
          <div 
            key={station.id} 
            className="card cursor-pointer hover:border-emerald-500/50 transition-colors"
            onClick={() => setSelectedStation(station)}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: station.color }}
              >
                {station.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium">{station.name}</p>
                <p className="text-slate-400 text-sm">{station.model}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                station.gateway === 'Running'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : station.gateway === 'Stopped'
                  ? 'bg-slate-500/20 text-slate-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {station.gateway}
              </span>
              <span className="text-xs text-slate-500">{station.room}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
