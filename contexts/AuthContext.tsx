'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  user: any;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);

  // Config from environment
  const config = {
    username: process.env.NEXT_PUBLIC_AUTH_USER || 'agent-IYXFRf42',
    password: process.env.NEXT_PUBLIC_AUTH_PASSWORD || '',
    provider: process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'basic',
    dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:9119',
  };

  useEffect(() => {
    checkAuthInternal();
  }, []);

  const checkAuthInternal = async () => {
    setLoading(true);
    try {
      // Try to get current session first
      const result = await checkAuth();
      
      if (result.authenticated) {
        setAuthenticated(true);
        setUser(result.user);
        return;
      }
      
      // If no session and we have credentials, auto-login
      if (config.password) {
        const success = await doLogin(config.username, config.password);
        if (success) {
          const authResult = await checkAuth();
          setAuthenticated(authResult.authenticated);
          setUser(authResult.user);
          return;
        }
      }
      
      setAuthenticated(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth check failed');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const doLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${config.dashboardUrl}/auth/password-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, provider: config.provider }),
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const checkAuth = async (): Promise<{ authenticated: boolean; user: any }> => {
    try {
      const response = await fetch(`${config.dashboardUrl}/api/auth/me`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const user = await response.json();
        return { authenticated: true, user };
      }
      return { authenticated: false, user: null };
    } catch {
      return { authenticated: false, user: null };
    }
  };

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const success = await doLogin(username, password);
      if (success) {
        const result = await checkAuth();
        setAuthenticated(result.authenticated);
        setUser(result.user);
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

  const handleLogout = async () => {
    try {
      await fetch(`${config.dashboardUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore
    }
    setAuthenticated(false);
    setUser(null);
  };

  const refreshAuth = async () => {
    const result = await checkAuth();
    setAuthenticated(result.authenticated);
    setUser(result.user);
  };

  // Show loading screen while checking auth
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      authenticated,
      loading,
      error,
      user,
      login: handleLogin,
      logout: handleLogout,
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
