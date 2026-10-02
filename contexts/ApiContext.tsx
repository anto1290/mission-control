'use client';

import { createContext, useContext, useState, useEffect } from 'react';

export interface Agent {
  name: string;
  label: string;
  role: string;
  status: 'working' | 'idle' | 'offline';
  task?: string;
  model?: string;
  service?: { state: string; pid?: number; seconds?: number };
  opencode?: { present: boolean; running: boolean };
}

export interface DashboardData {
  services: Array<{ name: string; state: string }>;
  platforms: Array<{ platform: string; state: string }>;
  task_counts_by_status: Record<string, number>;
  task_total: number;
  opencode: { present: boolean; version?: string };
}

interface ApiContextType {
  agents: Agent[];
  dashboard: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ApiContext = createContext<ApiContextType | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [agentsRes, dashboardRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/dashboard'),
      ]);
      
      if (!agentsRes.ok || !dashboardRes.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const agentsData = await agentsRes.json();
      const dashboardData = await dashboardRes.json();
      
      setAgents(agentsData.agents || []);
      setDashboard(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ApiContext.Provider value={{ agents, dashboard, loading, error, refresh: fetchAll }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used within ApiProvider');
  return context;
}