'use client';

import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { useState, useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, loading, login } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!loading && !authenticated) {
      setShowModal(true);
    }
  }, [loading, authenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return showModal ? (
      <AuthModal
        onClose={() => setShowModal(false)}
        onLogin={login}
        initialMode="password"
        onSwitchMode={() => {}}
      />
    ) : null;
  }

  return <>{children}</>;
}
