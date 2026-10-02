'use client';

export const dynamic = 'force-dynamic';

import { useApi } from '@/contexts/ApiContext';

export default function HomePage() {
  const { runtime, dashboard, loading } = useApi();

  const profiles = runtime?.profiles?.data || [];
  const activeProfiles = profiles.filter(p => p.gateway === 'Running').length;
  
  const taskTotal = dashboard?.tasks.total || 0;
  const calendarTotal = dashboard?.calendar.total || 0;
  const activityTotal = dashboard?.activity.total || 0;
  const officeActive = dashboard?.office.active || 0;
  const channelsConnected = dashboard?.channels.connected || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Real-time overview of your AI team</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            LIVE
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Agents"
          value={activeProfiles}
          total={profiles.length}
          icon="🤖"
          color="blue"
        />
        <KpiCard
          label="Tasks"
          value={taskTotal}
          icon="📋"
          color="amber"
        />
        <KpiCard
          label="Cron Jobs"
          value={calendarTotal}
          icon="⏰"
          color="purple"
        />
        <KpiCard
          label="Channels"
          value={channelsConnected}
          icon="🔌"
          color="green"
        />
      </div>

      {/* Agent Status */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Agent Status</h2>
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div key={profile.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  profile.gateway === 'Running' ? 'bg-emerald-500' : 'bg-slate-500'
                }`} />
                <div>
                  <p className="text-white font-medium">{profile.name}</p>
                  <p className="text-slate-400 text-sm">{profile.model}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                profile.gateway === 'Running' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {profile.gateway}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Office Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Office Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-slate-800/50">
            <p className="text-3xl font-bold text-emerald-400">{dashboard?.office.active}</p>
            <p className="text-slate-400 text-sm">Active</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-slate-800/50">
            <p className="text-3xl font-bold text-amber-400">{dashboard?.office.idle}</p>
            <p className="text-slate-400 text-sm">Idle</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-slate-800/50">
            <p className="text-3xl font-bold text-slate-400">{dashboard?.office.offline}</p>
            <p className="text-slate-400 text-sm">Offline</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-slate-800/50">
            <p className="text-3xl font-bold text-blue-400">{dashboard?.office.declared}</p>
            <p className="text-slate-400 text-sm">Total</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {dashboard?.activity.latest && (
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="p-4 rounded-lg bg-slate-800/50">
            <p className="text-white font-medium">{dashboard.activity.latest.title}</p>
            <p className="text-slate-400 text-sm mt-1">{dashboard.activity.latest.preview}</p>
            <p className="text-slate-500 text-xs mt-2">{dashboard.activity.latest.lastActive}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, total, icon, color }: {
  label: string;
  value: number;
  total?: number;
  icon: string;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'red';
}) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
  };

  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${colors[color]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">
            {value}
            {total !== undefined && <span className="text-lg text-slate-500">/{total}</span>}
          </p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}