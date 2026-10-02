'use client';

import { createContext, useContext, useState, useEffect } from 'react';

export interface Profile {
  name: string;
  model: string;
  gateway: 'Running' | 'Stopped' | 'Unknown';
}

export interface RuntimeData {
  profiles: {
    availability: 'available' | 'unavailable';
    data: Profile[];
    error?: { code: string; message: string };
  };
  openCode: {
    availability: 'available' | 'unavailable';
    data: string;
    error?: { code: string; message: string };
  };
  fetchedAt: string;
}

export interface DashboardData {
  runtime: RuntimeData;
  tasks: {
    availability: string;
    total: number;
    byStatus: Record<string, number>;
    assigned: number;
  };
  calendar: {
    availability: string;
    total: number;
    active: number;
    paused: number;
  };
  activity: {
    availability: string;
    total: number;
    latest?: { title: string; preview: string; lastActive: string; id: string };
  };
  knowledge: {
    availability: string;
    total: number;
    byCategory: Record<string, number>;
  };
  channels: {
    availability: string;
    total: number;
    connected: number;
  };
  office: {
    declared: number;
    active: number;
    idle: number;
    offline: number;
    unknown: number;
  };
  commands: {
    total: number;
    failed: number;
    averageMs: number;
  };
  fetchedAt: string;
}

interface ApiContextType {
  runtime: RuntimeData | null;
  dashboard: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ApiContext = createContext<ApiContextType | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [runtimeRes, dashboardRes] = await Promise.all([
        fetch('/api/runtime'),
        fetch('/api/dashboard'),
      ]);
      
      if (!runtimeRes.ok || !dashboardRes.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const runtimeData = await runtimeRes.json();
      const dashboardData = await dashboardRes.json();
      
      setRuntime(runtimeData);
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
    <ApiContext.Provider value={{ runtime, dashboard, loading, error, refresh: fetchAll }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used within ApiProvider');
  return context;
}