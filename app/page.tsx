'use client';

export const dynamic = 'force-dynamic';

import { useApi } from '@/contexts/ApiContext';

export default function HomePage() {
  const { agents, dashboard, loading } = useApi();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-dark-400 mt-1">Real-time overview of your AI team</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400 text-sm font-medium">
            LIVE
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Services Up"
          value={dashboard?.services.filter(s => s.state === 'up').length || 0}
          total={dashboard?.services.length || 0}
          icon="⚡"
          color="green"
        />
        <StatCard
          label="Active Agents"
          value={agents.filter(a => a.status === 'working').length}
          total={agents.length}
          icon="🤖"
          color="blue"
        />
        <StatCard
          label="Open Tasks"
          value={Object.values(dashboard?.task_counts_by_status || {}).reduce((a, b) => a + b, 0)}
          icon="📋"
          color="amber"
        />
        <StatCard
          label="Platforms"
          value={dashboard?.platforms.filter(p => p.state === 'connected').length || 0}
          total={dashboard?.platforms.length || 0}
          icon="🔌"
          color="purple"
        />
      </div>

      {/* Agents & Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentsPanel agents={agents} loading={loading} />
        <ServicesPanel services={dashboard?.services || []} platforms={dashboard?.platforms || []} loading={loading} />
      </div>
    </div>
  );
}

function StatCard({ label, value, total, icon, color }: any) {
  const colors: Record<string, string> = {
    green: 'from-green-500/20 to-green-600/5 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  };

  return (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {total !== undefined && (
          <span className="text-dark-400 text-sm">{value}/{total}</span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-dark-400 text-sm">{label}</div>
      </div>
    </div>
  );
}

function AgentsPanel({ agents, loading }: any) {
  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-dark-700"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-dark-700 rounded w-1/3"></div>
                <div className="h-3 bg-dark-800 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">AI Agents</h2>
      <div className="space-y-3">
        {agents.map((agent: any) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: any }) {
  const statusColors = {
    working: 'bg-green-500',
    idle: 'bg-amber-500',
    offline: 'bg-dark-500',
  };

  const colors: Record<string, string> = {
    default: 'from-blue-500 to-blue-600',
    leadenginer: 'from-green-500 to-green-600',
    opencode: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-colors">
      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[agent.name] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-sm`}>
        {agent.label.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{agent.label}</span>
          <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]} ${agent.status === 'working' ? 'animate-pulse' : ''}`}></span>
        </div>
        <p className="text-dark-400 text-sm truncate">{agent.role?.split('—')[0]?.trim()}</p>
      </div>
      {agent.task && (
        <div className="text-right hidden sm:block">
          <p className="text-dark-300 text-sm max-w-[200px] truncate">{agent.task}</p>
        </div>
      )}
    </div>
  );
}

function ServicesPanel({ services, platforms, loading }: any) {
  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-dark-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Services & Platforms</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-dark-400 mb-2">Hermes Services</h3>
          <div className="space-y-2">
            {services.map((svc: any) => (
              <div key={svc.name} className="flex items-center justify-between p-2 rounded bg-dark-800/50">
                <span className="text-dark-300 text-sm font-mono">{svc.name}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${svc.state === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {svc.state}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-dark-400 mb-2">Platforms</h3>
          <div className="space-y-2">
            {platforms.map((p: any) => (
              <div key={p.platform} className="flex items-center justify-between p-2 rounded bg-dark-800/50">
                <span className="text-dark-300 text-sm">{p.platform}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${p.state === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {p.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}