'use client';

import { useEffect, useState, useCallback } from 'react';
import Office3D from '@/app/components/Office3D';

interface Station {
  id: string;
  name: string;
  model: string;
  status: 'Running' | 'Stopped';
  room: string;
  seat: number;
  color: string;
  task?: string;
  taskStatus?: string;
  reason?: 'task' | 'scheduled' | 'idle' | string;
  scheduledJob?: string;
}

interface ActivitySession {
  id: string;
  title: string;
  preview?: string;
  lastActive?: string;
  isActive?: boolean;
}

const REASON_LABEL: Record<string, string> = {
  task: 'On task',
  scheduled: 'Scheduled',
  idle: 'Idle',
};

const REASON_STYLE: Record<string, string> = {
  task: 'bg-blue-500/20 text-blue-400',
  scheduled: 'bg-purple-500/20 text-purple-400',
  idle: 'bg-slate-500/20 text-slate-400',
};

export default function OfficePage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Station | null>(null);
  const [activity, setActivity] = useState<ActivitySession[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/office')
        .then((r) => r.json())
        .then((data: any) => {
          if (cancelled) return;
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
                task: s.task,
                taskStatus: s.taskStatus,
                reason: s.reason,
                scheduledJob: s.scheduledJob,
              })),
            );
          }
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    load();
    // Live refresh: movement is driven by real state changes, so poll the
    // office state periodically to let agents react to new tasks / status.
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const r = await fetch('/api/activity');
      const data: any = await r.json();
      setActivity(Array.isArray(data.activity?.data) ? data.activity.data : []);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const handleAgentClick = useCallback(
    (agent: Station | null) => {
      setSelected(agent);
      if (agent) loadActivity();
    },
    [loadActivity],
  );

  const activeCount = stations.filter((s) => s.status === 'Running').length;
  const selReason = selected?.reason || '';

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

      <div className="flex-1 flex gap-4 min-h-[500px] overflow-hidden">
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700">
          <Office3D
            agents={stations}
            onAgentClick={handleAgentClick}
          />
        </div>

        {selected && (
          <div className="w-80 flex-shrink-0 rounded-xl border border-slate-700 bg-slate-900/80 flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                  <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                </div>
                <p className="text-slate-500 text-xs mt-1 font-mono">{selected.model}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white text-lg leading-none mt-0.5" aria-label="Close panel">✕</button>
            </div>

            <div className="px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${selected.status === 'Running' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className={`text-sm font-medium ${selected.status === 'Running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {selected.status === 'Running' ? 'Online' : 'Offline'}
                </span>
                {selReason && (
                  <span className={`ml-auto px-2 py-0.5 rounded text-xs ${REASON_STYLE[selReason] || REASON_STYLE.idle}`}>
                    {REASON_LABEL[selReason] || selReason}
                  </span>
                )}
              </div>
            </div>

            <div className="px-4 py-3 space-y-3 border-b border-slate-800 text-sm flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-500 text-xs">Room</p>
                  <p className="text-white">{selected.room}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Seat</p>
                  <p className="text-white">#{selected.seat}</p>
                </div>
              </div>

              {selected.task && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Current Task</p>
                  <p className="text-blue-400">{selected.task}</p>
                  {selected.taskStatus && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs">
                      {selected.taskStatus}
                    </span>
                  )}
                </div>
              )}

              {selected.scheduledJob && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Scheduled Job</p>
                  <p className="text-purple-400">{selected.scheduledJob}</p>
                </div>
              )}

              <div>
                <p className="text-slate-500 text-xs mb-2">Recent Sessions</p>
                {activityLoading ? (
                  <p className="text-slate-600 text-xs">Loading…</p>
                ) : activity.length === 0 ? (
                  <p className="text-slate-600 text-xs">No sessions recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {activity.slice(0, 8).map((s) => (
                      <li key={s.id} className="pl-3 relative">
                        <span className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${s.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <p className="text-sm text-white truncate">{s.title || s.id}</p>
                        {s.lastActive && <p className="text-slate-500 text-xs">{s.lastActive}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
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
          <div className="w-3 h-3 rounded-full bg-purple-400"></div>
          <span className="text-slate-400">Scheduled (cron)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-slate-400">Click agent for details</span>
        </div>
      </div>
    </div>
  );
}
