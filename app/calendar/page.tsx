'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';

export default function CalendarPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/calendar');
      const data = await res.json();
      setJobs(data.cron_jobs || []);
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Calendar</h1>
        <div className="glass-card rounded-xl p-6 animate-pulse h-64"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendar</h1>
          <p className="text-dark-400 mt-1">Scheduled cron jobs and tasks</p>
        </div>
        <button
          onClick={fetchJobs}
          className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-6">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              <p className="text-lg mb-2">No scheduled jobs</p>
              <p className="text-sm">Create a cron job to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job, index) => (
                <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-dark-800/50">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <span className="text-primary-400 text-lg">⏰</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{job.name || job.job_id || 'Unnamed job'}</p>
                    <p className="text-dark-400 text-sm">{job.profile || 'default'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-dark-300 font-mono text-sm">{job.schedule || job.cron || '—'}</p>
                    {job.nextRun && (
                      <p className="text-dark-500 text-xs mt-1">{formatRelativeTime(job.nextRun)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Due now';
    if (diff < 60000) return 'In < 1 min';
    if (diff < 3600000) return `In ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `In ${Math.floor(diff / 3600000)}h`;
    return `In ${Math.floor(diff / 86400000)}d`;
  } catch {
    return isoString;
  }
}