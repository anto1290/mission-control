'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { renderOffice, type Station } from '@/lib/office-renderer';

export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(0.9);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [showCards, setShowCards] = useState(true);
  const animationRef = useRef<number>(undefined as unknown as number);

  useEffect(() => {
    fetch('/api/office')
      .then((r) => r.json())
      .then((data: any) => {
        if (Array.isArray(data.stations)) {
          setStations(
            data.stations.map((s: any, i: number) => ({
              id: s.id || s.name || `station-${i}`,
              name: s.name,
              model: s.model || 'Unknown',
              status: s.state === 'Working' ? 'Running' : 'Stopped',
              room: s.room || 'Workspace',
              seat: s.seat || i + 1,
              color: s.color || '#5b9bd5',
            })),
          );
        }
      })
      .catch(console.error);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderOffice(
      canvas,
      stations,
      {
        rotation,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        hovered: hoveredStation,
        selected: selectedStation,
      },
    );
  }, [stations, rotation, zoom, offset, hoveredStation, selectedStation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        draw();
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    const loop = () => {
      setRotation((r) => r + 0.15);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.max(0.4, Math.min(2.5, z * factor)));
  };

  const resetView = () => {
    setRotation(0);
    setZoom(0.9);
    setOffset({ x: 0, y: 0 });
    setSelectedStation(null);
  };

  const activeCount = stations.filter((s) => s.status === 'Running').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Isometric Office</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Drag to pan · Scroll to zoom · Click agents for details
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetView}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              autoRotate
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {autoRotate ? '■ Stop' : '▶ Auto Rotate'}
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-700" style={{ height: '560px' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Status overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <div className="px-3 py-1.5 rounded-full bg-white/85 backdrop-blur text-slate-700 text-xs font-medium shadow-sm">
            {stations.length} Agents · {activeCount} Active
          </div>
          {selectedStation && (
            <div className="px-3 py-2 rounded-lg bg-white/90 backdrop-blur shadow-md text-xs">
              <div className="font-semibold text-slate-800">{selectedStation.name}</div>
              <div className="text-slate-500">{selectedStation.model}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background:
                      selectedStation.status === 'Running' ? '#10b981' : '#d1d5db',
                  }}
                />
                <span className="text-slate-600">{selectedStation.status}</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowCards(!showCards)}
          className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-white/85 backdrop-blur text-slate-600 text-xs font-medium shadow-sm hover:bg-white transition-colors"
        >
          {showCards ? 'Hide Cards' : 'Show Cards'}
        </button>
      </div>

      {showCards && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {stations.map((station) => (
            <div
              key={station.id}
              className="bg-slate-800/60 rounded-xl p-3 cursor-pointer hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-600"
              onClick={() => setSelectedStation(station)}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: station.color }}
                >
                  {station.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{station.name}</p>
                  <p className="text-slate-400 text-xs truncate">{station.model}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    station.status === 'Running'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-600/40 text-slate-400'
                  }`}
                >
                  {station.status}
                </span>
                <span className="text-[10px] text-slate-500">{station.room}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
