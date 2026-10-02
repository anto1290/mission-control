'use client';

export const dynamic = 'force-dynamic';

import { useApi } from '@/contexts/ApiContext';

export default function AgentsPage() {
  const { agents, loading } = useApi();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Agents</h1>
        <p className="text-dark-400 mt-1">Detailed information about your AI team members</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-dark-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-dark-700 rounded w-1/2"></div>
                  <div className="h-3 bg-dark-800 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: any }) {
  const statusColors = {
    working: 'bg-green-500 shadow-green-500/50',
    idle: 'bg-amber-500 shadow-amber-500/50',
    offline: 'bg-dark-500',
  };

  const colors: Record<string, string> = {
    default: 'from-blue-500 to-blue-600',
    leadenginer: 'from-green-500 to-green-600',
    opencode: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="glass-card rounded-xl p-6 hover:bg-dark-800/60 transition-all duration-200">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors[agent.name] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
          {agent.label.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{agent.label}</h3>
            <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]} shadow-lg`}></span>
          </div>
          <p className="text-dark-400 text-sm mt-1">{agent.role?.split('—')[0]?.trim()}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {agent.model?.default_model && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-dark-500">Model</span>
            <span className="text-dark-300 font-mono text-xs">{agent.model.default_model}</span>
          </div>
        )}
        
        {agent.task && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-dark-500">Task</span>
            <span className="text-dark-300 text-xs max-w-[200px] truncate">{agent.task}</span>
          </div>
        )}

        {agent.service?.state === 'up' && agent.service?.seconds && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-dark-500">Uptime</span>
            <span className="text-dark-300 font-mono text-xs">{formatSeconds(agent.service.seconds)}</span>
          </div>
        )}
      </div>

      {agent.open_tasks > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-800">
          <div className="text-sm text-dark-400">
            <span className="text-white font-medium">{agent.open_tasks}</span> open tasks
          </div>
        </div>
      )}
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}