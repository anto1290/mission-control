'use client';

import { useApi } from '@/contexts/ApiContext';
import { RefreshCw, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Header() {
  const { refresh, loading } = useApi();
  const [lastUpdate, setLastUpdate] = useState<string>('—');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLastUpdate(now.toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    </header>
  );
}