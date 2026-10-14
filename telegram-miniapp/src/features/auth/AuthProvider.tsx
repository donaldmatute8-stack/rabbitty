'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  sessionToken: string | null;
  isTelegram: boolean;
  isNative: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sessionToken: null,
  isTelegram: false,
  isNative: false,
  checkAuth: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const PUBLIC_ROUTES = ['/onboarding', '/signup', '/login', '/welcome', '/privacy'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isTelegram = typeof window !== 'undefined' ? PlatformBridge.isTelegram() : false;
  const isNative = typeof window !== 'undefined' ? PlatformBridge.isNative() : false;

  const checkAuth = useCallback(async () => {
    try {
      // 1. TELEGRAM FLOW
      if (PlatformBridge.isTelegram()) {
        try {
          const mod = await import('@twa-dev/sdk');
          const app = mod.default;

          if (app.initData) {
            // Cryptographic HMAC validation via /api/auth/telegram
            const tgRes = await fetch('/api/auth/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData: app.initData }),
            });
            const tgData = await tgRes.json();
            if (tgData.success && tgData.user) {
              // Fetch full profile (with levels, balances, etc.)
              const profRes = await fetch(`/api/auth/profile?telegramId=${tgData.user.telegramId}`);
              const profData = await profRes.json();
              const fullProfile = profData.profile || tgData.user;
              setUser(fullProfile);
              if (tgData.sessionToken) {
                setSessionToken(tgData.sessionToken);
                await PlatformBridge.setSessionToken(tgData.sessionToken);
              }
              return;
            }
          }

          // Fallback if initData is raw unsafe during dev
          const tgId = app.initDataUnsafe?.user?.id?.toString();
          if (tgId) {
            const res = await fetch(`/api/auth/profile?telegramId=${tgId}`);
            const data = await res.json();
            if (data.profile) {
              setUser(data.profile);
              return;
            }
          }
        } catch (tgError) {
          console.warn('[AuthProvider] Telegram auth error:', tgError);
        }
      }

      // 2. NATIVE / WEB PERSISTENT SESSION FLOW
      const storedToken = await PlatformBridge.getSessionToken();
      if (storedToken) {
        setSessionToken(storedToken);
        const res = await fetch('/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setUser(data.profile);
            return;
          }
        } else {
          // Token is expired or revoked by server
          console.log('[AuthProvider] Session expired or invalid, clearing local session');
          await PlatformBridge.clearSession();
          setSessionToken(null);
        }
      }

      // 3. UNAUTHENTICATED
      setUser(null);
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.replace('/onboarding');
      }
    } catch (e) {
      console.error('[AuthProvider] Auth check failed:', e);
      setUser(null);
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.replace('/onboarding');
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  const logout = async () => {
    try {
      const token = sessionToken || (await PlatformBridge.getSessionToken());
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionToken: token }),
        });
      }
    } catch (e) {
      console.warn('[AuthProvider] Logout network call error', e);
    } finally {
      await PlatformBridge.clearSession();
      setUser(null);
      setSessionToken(null);
      router.replace('/onboarding');
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading || (!user && !PUBLIC_ROUTES.includes(pathname))) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #333', borderTopColor: '#E91E63', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionToken, isTelegram, isNative, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
