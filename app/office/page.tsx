'use client';

import { useEffect, useState } from 'react';
import Office3D from '@/app/components/Office3D';

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
        if (Array.isArray(data.office?.data)) {
          setStations(
            data.office.data.map((s: any, i: number) => ({
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
    <div className="space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Virtual Office</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Interactive 3D workspace for your AI agents
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm">
            {stations.length} Agents
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">
            {activeCount} Active
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 min-h-[500px]">
        <Office3D 
          agents={stations}
          onAgentClick={(agent) => console.log('Clicked:', agent.name)}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-slate-400">Active Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-500"></div>
          <span className="text-slate-400">Offline Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-slate-400">Click to select</span>
        </div>
      </div>
    </div>
  );
}
