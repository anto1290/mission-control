'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';

interface Session {
  id: string;
  title: string;
  model: string;
  message_count: number;
  started_at_iso: string;
  ended_at_iso?: string;
  open: boolean;
}

export default function ActivityPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/activity');
      const data = await res.json();
      const sessionsData = data.items?.filter((item: any) => item.kind === 'session') || [];
      setSessions(sessionsData);
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Activity</h1>
        <div className="glass-card rounded-xl p-6 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-dark-800 rounded mb-3"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Activity</h1>
          <p className="text-dark-400 mt-1">Recent sessions and activities</p>
        </div>
        <button
          onClick={fetchSessions}
          className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="divide-y divide-dark-800">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-dark-500">
              No activity recorded yet
            </div>
          ) : (
            sessions.slice(0, 20).map((session) => (
              <div key={session.id} className="p-4 hover:bg-dark-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${session.open ? 'bg-green-500 animate-pulse' : 'bg-dark-600'}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{session.title || 'Untitled session'}</p>
                    <p className="text-dark-400 text-sm">{session.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-dark-300 text-sm">{session.message_count} msgs</p>
                    <p className="text-dark-500 text-xs">{formatTime(session.started_at_iso)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}