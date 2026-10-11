'use client';

import { useEffect, useState } from 'react';
import Office3D from '@/app/components/Office3D';
import { useApi } from '@/contexts/ApiContext';
import { Clock, Activity, User, MessageSquare } from 'lucide-react';

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

interface ActivityEvent {
  id: string;
  time: string;
  agent: string;
  action: string;
  type: 'task' | 'status' | 'meeting' | 'break';
}

export default function OfficePage() {
  const { dashboard, refresh } = useApi();
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Station | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Simulate activity timeline from real agent events
  useEffect(() => {
    if (stations.length === 0) return;
    const events: ActivityEvent[] = stations.slice(0, 5).map((s, i) => ({
      id: `evt-${i}`,
      time: new Date(Date.now() - i * 120000).toLocaleTimeString(),
      agent: s.name,
      action: s.status === 'Running' ? 'Started task' : 'Went offline',
      type: s.status === 'Running' ? 'task' : 'status',
    }));
    setActivities(events);
  }, [stations]);

  const activeCount = stations.filter((s) => s.status === 'Running').length;
  const meetingCount = stations.filter((s) => s.room.toLowerCase() === 'meeting').length;
  const loungeCount = stations.filter((s) => s.room.toLowerCase() === 'lounge').length;

  const handleAgentClick = (agent: Station) => {
    setSelectedAgent(agent);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task': return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'meeting': return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'break': return <User className="w-4 h-4 text-amber-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Virtual Office</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Interactive 3D workspace · {stations.length} agents
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm">
            {stations.length} Agents
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">
            {activeCount} Active
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm">
            {meetingCount} Meeting
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-5 min-h-0">
        {/* 3D Office */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 min-h-[500px] relative">
          <Office3D
            agents={stations}
            onAgentClick={handleAgentClick}
          />
          
          {/* Quick stats overlay */}
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 text-xs border border-slate-700">
            <div className="text-slate-400 space-y-0.5">
              <div>🖱️ Right-click: Orbit</div>
              <div>🖱️ Scroll: Zoom</div>
              <div>⇧+Drag: Pan</div>
              <div>👆 Click: Select</div>
            </div>
          </div>
        </div>

        {/* Right panel: Detail + Timeline */}
        <div className="w-80 flex flex-col gap-4 flex-shrink-0">
          {/* Agent Detail Panel */}
          <div className="bg-slate-900/95 backdrop-blur rounded-xl border border-slate-700 p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Agent Details</h2>
              {selectedAgent && (
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedAgent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                    style={{ backgroundColor: selectedAgent.color }}
                  >
                    {selectedAgent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selectedAgent.name}</p>
                    <p className="text-slate-400 text-sm">{selectedAgent.model}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-slate-500 text-xs">Status</p>
                    <p className={`font-medium ${selectedAgent.status === 'Running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {selectedAgent.status === 'Running' ? '● Working' : '○ Offline'}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-slate-500 text-xs">Location</p>
                    <p className="text-white font-medium">{selectedAgent.room}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-slate-500 text-xs">Seat</p>
                    <p className="text-white font-medium">{selectedAgent.seat}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-slate-500 text-xs">Task</p>
                    <p className="text-white font-medium truncate">
                      {selectedAgent.task || 'None'}
                    </p>
                  </div>
                </div>

                {selectedAgent.task && (
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-500 text-xs mb-1">Current Task</p>
                    <p className="text-white text-sm">{selectedAgent.task}</p>
                    {selectedAgent.taskStatus && (
                      <p className="text-slate-400 text-xs mt-1">
                        Status: {selectedAgent.taskStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click an agent to view details</p>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-slate-900/95 backdrop-blur rounded-xl border border-slate-700 p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Activity Timeline</h2>
              <Activity className="w-4 h-4 text-slate-500" />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activities.length > 0 ? (
                activities.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 text-sm">
                    {getActivityIcon(evt.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">
                        <span className="font-medium">{evt.agent}</span>
                        {' '}{evt.action}
                      </p>
                      <p className="text-slate-500 text-xs">{evt.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">No recent activity</p>
              )}
            </div>
          </div>

          {/* Zone Legend */}
          <div className="bg-slate-900/95 backdrop-blur rounded-xl border border-slate-700 p-4">
            <h2 className="text-white font-semibold text-sm mb-3">Office Zones</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500"></div>
                  <span className="text-slate-300">Workspace</span>
                </div>
                <span className="text-slate-500">
                  {stations.filter(s => s.room.toLowerCase() === 'workspace').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></div>
                  <span className="text-slate-300">Meeting Room</span>
                </div>
                <span className="text-slate-500">{meetingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></div>
                  <span className="text-slate-300">Lounge</span>
                </div>
                <span className="text-slate-500">{loungeCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom legend */}
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
          <span className="text-slate-400">Selected</span>
        </div>
      </div>
    </div>
  );
}
