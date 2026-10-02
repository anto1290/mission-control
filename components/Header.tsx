'use client';

import { useApi } from '@/contexts/ApiContext';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { RefreshCw, Clock, LogOut, LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Header() {
  const { refresh, loading } = useApi();
  const { authenticated, loading: authLoading, login, logout } = useAuth();
  const [lastUpdate, setLastUpdate] = useState<string>('—');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'password' | 'oauth'>('password');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLastUpdate(now.toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    const success = await login(username, password);
    if (success) setShowAuthModal(false);
    return success;
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="glass border-b border-dark-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white hidden sm:block">
            Mission Control
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {/* Last update */}
          <div className="flex items-center gap-2 text-dark-400 text-sm">
            <Clock size={14} />
            <span>Updated: {lastUpdate}</span>
          </div>

          {/* Auth status */}
          <div className="flex items-center gap-2">
            {authLoading ? (
              <span className="flex items-center gap-2 text-sm text-yellow-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                Checking...
              </span>
            ) : authenticated ? (
              <span className="flex items-center gap-2 text-sm text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Authenticated
              </span>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition-colors"
              >
                <LogIn size={14} />
                Login
              </button>
            )}
            {authenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
              >
                <LogOut size={14} />
                Logout
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg
              bg-dark-800 hover:bg-dark-700 border border-dark-700
              text-white text-sm font-medium
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLogin={handleLogin}
          initialMode={loginMode}
          onSwitchMode={setLoginMode}
        />
      )}
    </header>
  );
}
