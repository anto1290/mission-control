'use client';

import { useState, useEffect, useCallback } from 'react';
import { HermesOAuth, getOAuthClient, OAuthSession } from '@/lib/oauth';

export interface OAuthProvider {
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
}

export interface AuthState {
  authenticated: boolean;
  provider: string | null;
  loading: boolean;
  error: string | null;
}

export function useHermesAuth(dashboardUrl?: string) {
  const [authState, setAuthState] = useState<AuthState>({
    authenticated: false,
    provider: null,
    loading: true,
    error: null,
  });
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [sessions, setSessions] = useState<OAuthSession[]>([]);

  const oauth = getOAuthClient(dashboardUrl);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    try {
      const status = await oauth.getAuthStatus();
      setAuthState({
        authenticated: status.authenticated,
        provider: status.provider,
        loading: false,
        error: null,
      });
    } catch (error) {
      setAuthState({
        authenticated: false,
        provider: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const success = await oauth.loginPassword(username, password);
      if (success) {
        await checkAuth();
        return true;
      }
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: 'Invalid credentials',
      }));
      return false;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      return false;
    }
  };

  const startOAuth = async (provider: string, profile?: string): Promise<OAuthSession> => {
    try {
      const session = await oauth.startOAuth(provider, profile);
      setSessions(prev => [...prev, session]);
      return session;
    } catch (error) {
      throw error;
    }
  };

  const pollOAuthStatus = async (provider: string, sessionId: string): Promise<boolean> => {
    try {
      const result = await oauth.pollStatus(provider, sessionId);
      
      // Update session status
      setSessions(prev => prev.map(s => 
        s.sessionId === sessionId 
          ? { ...s, status: result.status as OAuthSession['status'] }
          : s
      ));

      if (result.status === 'connected') {
        await checkAuth();
        return true;
      }
      return false;
    } catch (error) {
      setSessions(prev => prev.map(s => 
        s.sessionId === sessionId 
          ? { ...s, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
          : s
      ));
      return false;
    }
  };

  const deleteSession = async (provider: string, sessionId: string): Promise<void> => {
    await oauth.deleteSession(provider, sessionId);
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
  };

  const logout = async (): Promise<void> => {
    await fetch(`${dashboardUrl || 'http://localhost:9119'}/auth/logout`, {
      method: 'POST',
    });
    setAuthState({
      authenticated: false,
      provider: null,
      loading: false,
      error: null,
    });
    setSessions([]);
  };

  return {
    authState,
    providers,
    sessions,
    login,
    logout,
    startOAuth,
    pollOAuthStatus,
    deleteSession,
    refreshAuth: checkAuth,
  };
}
