'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HermesClient, getHermesClient } from '@/lib/hermes-client';

interface AuthContextType {
  client: HermesClient;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  config: {
    dashboardUrl: string;
    provider: string;
    profile: string;
    hasToken: boolean;
  };
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const client = getHermesClient();

  // Check auth status on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  const refreshAuth = async () => {
    setLoading(true);
    try {
      // If we have a token configured, we're authenticated
      const cfg = client.getConfig();
      if (cfg.token) {
        setAuthenticated(true);
        setLoading(false);
        return;
      }

      // Otherwise check via /api/auth/me
      const status = await client.getAuthStatus();
      setAuthenticated(status.authenticated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth check failed');
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const success = await client.loginPassword(username, password);
      if (success) {
        await refreshAuth();
        return true;
      }
      setError('Invalid credentials');
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthenticated(false);
  };

  const config = client.getConfig();

  return (
    <AuthContext.Provider value={{
      client,
      authenticated,
      loading,
      error,
      config: {
        dashboardUrl: config.dashboardUrl,
        provider: config.provider || 'unknown',
        profile: config.profile || 'unknown',
        hasToken: !!config.token,
      },
      login,
      logout,
      refreshAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
