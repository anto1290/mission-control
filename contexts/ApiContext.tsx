'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    data: Array<{ id: string; title: string; status: string; assignee: string }>;
  };
  calendar: {
    availability: string;
    total: number;
    active: number;
    paused: number;
    data: any[];
  };
  activity: {
    availability: string;
    total: number;
    latest?: { title: string; preview: string; lastActive: string; id: string };
    data: Array<{ id: string; title: string | null; preview: string; lastActive: string; isActive: boolean }>;
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
    data: Array<{ name: string; status: string }>;
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

export function ApiProvider({ children }: { children: ReactNode }) {
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
      
      // Transform API response to expected shape
      const transformedDashboard: DashboardData = {
        ...dashboardData,
        tasks: {
          ...dashboardData.tasks,
          total: dashboardData.tasks.tasks?.data?.length || 0,
          data: dashboardData.tasks.tasks?.data || []
        },
        calendar: {
          ...dashboardData.calendar,
          total: dashboardData.calendar.jobs?.data?.length || 0,
          data: dashboardData.calendar.jobs?.data || []
        },
        activity: {
          ...dashboardData.activity,
          total: dashboardData.activity.sessions?.data?.length || 0,
          latest: dashboardData.activity.sessions?.data?.[0],
          data: dashboardData.activity.sessions?.data || []
        },
        channels: {
          ...dashboardData.channels,
          total: dashboardData.channels.channels?.data?.length || 0,
          connected: dashboardData.channels.channels?.data?.filter((c: any) => c.status === 'Connected').length || 0,
          data: dashboardData.channels.channels?.data || []
        }
      };
      
      setRuntime(runtimeData);
      setDashboard(transformedDashboard);
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
