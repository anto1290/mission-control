'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HermesOAuth, getOAuthClient } from '@/lib/oauth';

interface AuthContextType {
  oauth: HermesOAuth;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  startOAuth: (provider: string, profile?: string) => Promise<any>;
  pollOAuthStatus: (provider: string, sessionId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, dashboardUrl }: { children: ReactNode; dashboardUrl?: string }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const oauth = getOAuthClient(dashboardUrl);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const status = await oauth.getAuthStatus();
      setAuthenticated(status.authenticated);
      setAuthChecked(true);
    } catch {
      setAuthenticated(false);
      setAuthChecked(true);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const success = await oauth.loginPassword(username, password);
      if (success) {
        await checkAuth();
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

  const logout = async () => {
    try {
      await fetch(`${dashboardUrl || 'http://localhost:9119'}/auth/logout`, {
        method: 'POST',
      });
      setAuthenticated(false);
      setAuthChecked(false);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const startOAuth = async (provider: string, profile?: string) => {
    setError(null);
    return oauth.startOAuth(provider, profile);
  };

  const pollOAuthStatus = async (provider: string, sessionId: string) => {
    const result = await oauth.pollStatus(provider, sessionId);
    return result.status === 'connected';
  };

  return (
    <AuthContext.Provider value={{
      oauth,
      authenticated,
      loading,
      error,
      login,
      logout,
      startOAuth,
      pollOAuthStatus,
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
