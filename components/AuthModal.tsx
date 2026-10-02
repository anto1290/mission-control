'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HermesOAuth } from '@/lib/oauth';
import { Lock, Unlock } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<boolean>;
  initialMode: 'password' | 'oauth';
  onSwitchMode: (mode: 'password' | 'oauth') => void;
}

export function AuthModal({ onClose, onLogin, initialMode, onSwitchMode }: AuthModalProps) {
  const { config, refreshAuth } = useAuth();
  const [mode, setMode] = useState<'password' | 'oauth'>(initialMode);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const success = await onLogin(username, password);
      if (success) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async () => {
    // For now, just mark as authenticated if OAuth is configured
    setError(null);
    setLoading(true);
    
    // Simulate OAuth success for bypass mode
    setTimeout(async () => {
      await refreshAuth();
      setLoading(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Authentication</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Config info */}
        <div className="mb-4 p-3 bg-dark-800 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Lock size={14} />
            <span>Dashboard: {config.dashboardUrl}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 mt-1">
            <Unlock size={14} className={config.hasToken ? 'text-green-400' : ''} />
            <span>Provider: {config.provider} | Profile: {config.profile}</span>
          </div>
          {config.hasToken && (
            <div className="text-green-400 text-xs mt-1">
              Token configured - OAuth bypass enabled
            </div>
          )}
        </div>

        {/* Mode switch */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('password')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'password' 
                ? 'bg-blue-600 text-white' 
                : 'bg-dark-800 text-gray-400 hover:text-white'
            }`}
          >
            Password
          </button>
          <button
            onClick={() => setMode('oauth')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'oauth' 
                ? 'bg-blue-600 text-white' 
                : 'bg-dark-800 text-gray-400 hover:text-white'
            }`}
          >
            OAuth Bypass
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-dark-700 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              OAuth bypass mode - using configured provider & profile from environment
            </p>
            <button
              onClick={handleOAuth}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-dark-700 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Connecting...' : 'Connect via OAuth'}
            </button>
            <div className="text-center">
              <button
                onClick={() => setMode('password')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Back to password login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
