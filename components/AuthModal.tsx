'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<boolean>;
  initialMode: 'password' | 'oauth';
  onSwitchMode: (mode: 'password' | 'oauth') => void;
}

export function AuthModal({ onClose, onLogin, initialMode, onSwitchMode }: AuthModalProps) {
  const { startOAuth, pollOAuthStatus, loading: oauthLoading } = useAuth();
  const [mode, setMode] = useState<'password' | 'oauth'>(initialMode);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState('');
  const [oauthSessionId, setOauthSessionId] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<string>('idle');

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const success = await onLogin(username, password);
      if (!success) {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthStart = async () => {
    if (!oauthProvider) return;
    setError(null);
    try {
      const session = await startOAuth(oauthProvider);
      setOauthSessionId(session.sessionId);
      setOauthStatus('pending');
      
      // Auto-poll
      const poll = async () => {
        const connected = await pollOAuthStatus(oauthProvider, session.sessionId);
        if (connected) {
          setOauthStatus('connected');
          onClose();
        } else if (session.status !== 'error') {
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
      setOauthStatus('error');
    }
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
            OAuth
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
              Select a provider to authenticate via OAuth
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setOauthProvider('telegram'); handleOAuthStart(); }}
                className="flex items-center justify-center gap-2 p-4 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.28-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.38-.49 1.05-.75 4.12-1.8 6.87-2.99 8.26-3.57 3.93-1.64 4.75-1.92 5.28-1.93.12 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                </svg>
                Telegram
              </button>
              <button
                onClick={() => { setOauthProvider('whatsapp'); handleOAuthStart(); }}
                className="flex items-center justify-center gap-2 p-4 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
            </div>
            {oauthSessionId && (
              <div className="mt-4 p-3 bg-dark-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    oauthStatus === 'connected' ? 'bg-green-400' : 
                    oauthStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
                  }`}></span>
                  <span className="text-sm text-gray-400">
                    Status: {oauthStatus}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Session: {oauthSessionId}
                </div>
              </div>
            )}
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
