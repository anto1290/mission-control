'use client';

export const dynamic = 'force-dynamic';

import { useApi } from '@/contexts/ApiContext';

export default function AgentsPage() {
  const { runtime, loading } = useApi();
  const profiles = runtime?.profiles?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Agents</h1>
        <p className="text-slate-400 mt-1">Manage your AI crew members</p>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <div key={profile.name} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                  profile.gateway === 'Running' 
                    ? 'bg-emerald-500/20' 
                    : 'bg-slate-700'
                }`}>
                  {profile.name === 'default' ? '🤖' : '⚡'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{profile.name}</h3>
                  <p className="text-slate-400">{profile.model}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                profile.gateway === 'Running' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {profile.gateway}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}