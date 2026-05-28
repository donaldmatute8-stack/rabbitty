'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const PUBLIC_ROUTES = ['/onboarding', '/signup', '/welcome'];

  const checkAuth = async () => {
    try {
      const mod = await import('@twa-dev/sdk');
      const app = mod.default;
      
      let tgId = 'dev_user_123'; // Fallback
      if (typeof window !== 'undefined' && app.initDataUnsafe?.user?.id) {
        tgId = app.initDataUnsafe.user.id.toString();
      }

      const res = await fetch(`/api/auth/profile?telegramId=${tgId}`);
      const data = await res.json();

      if (data.profile) {
        setUser(data.profile);
      } else {
        setUser(null);
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.replace('/onboarding');
        }
      }
    } catch (e) {
      console.error('Auth check failed', e);
      setUser(null);
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.replace('/onboarding');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  if (loading || (!user && !PUBLIC_ROUTES.includes(pathname))) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #333', borderTopColor: '#E91E63', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
