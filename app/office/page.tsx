'use client';

import { useEffect, useState } from 'react';

interface Station {
  id: string;
  name: string;
  model: string;
  status: 'Running' | 'Stopped';
  room: string;
  seat: number;
  color: string;
}

export default function OfficePage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const activeCount = stations.filter((s) => s.status === 'Running').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading office...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Office 3D</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Interactive 3D office with agent stations
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm">
          {stations.length} Agents · {activeCount} Active
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-700" style={{ height: '600px' }}>
        {/* Sketchfab 3D Model Embed */}
        <iframe
          src="https://sketchfab.com/models/ea1d5422c80141aa8ec2478cc359fe41/embed?autostart=1&ui_infos=0&ui_watermark=0&ui_watermark_link=0"
          className="w-full h-full"
          style={{ border: 'none' }}
          allow="autoplay; fullscreen;vr"
          title="Office 3D Model"
        />

        {/* Agent Stations Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto">
          {stations.map((station) => (
            <div
              key={station.id}
              className="flex-shrink-0 bg-slate-900/90 backdrop-blur rounded-lg p-3 min-w-[140px] border border-slate-700"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: station.color }}
                >
                  {station.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{station.name}</p>
                  <p className="text-slate-400 text-[10px] truncate">{station.room}</p>
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
                <span className="text-[10px] text-slate-500">Seat {station.seat}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
