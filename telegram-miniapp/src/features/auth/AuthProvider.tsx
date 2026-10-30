'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';

export interface UserProfile {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  telegramId?: string;
  tonWalletAddress?: string | null;
  hops?: number;
  role?: string;
  totalBunzEarned?: number;
  totalBunzSpent?: number;
  visitedBusinesses?: number;
  level?: {
    id?: string;
    name?: string;
    requiredHops?: number;
  };
  [key: string]: unknown; // fallback for unmapped properties while providing rich autocomplete
}

interface AuthContextType {
  user: UserProfile | null;
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

const PUBLIC_ROUTES = ['/onboarding', '/signup', '/login', '/welcome', '/privacy', '/magic-link'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
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
              let fullProfile = tgData.user;
              if (tgData.sessionToken) {
                setSessionToken(tgData.sessionToken);
                await PlatformBridge.setSessionToken(tgData.sessionToken);
                // Fetch full profile (with levels, balances, etc.) using the session token
                try {
                  const profRes = await fetch('/api/auth/session', {
                    headers: { 'Authorization': `Bearer ${tgData.sessionToken}` },
                  });
                  if (profRes.ok) {
                    const profData = await profRes.json();
                    if (profData?.profile) fullProfile = profData.profile;
                  }
                } catch (profErr) {
                  console.warn('[AuthProvider] Could not fetch full profile:', profErr);
                }
              }
              setUser(fullProfile);
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
        
        // Timeout de seguridad de 2.5s para evitar cuelgues en arranques nativos o intermitencias de red
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        try {
          const res = await fetch('/api/auth/session', {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data?.profile) {
              setUser(data.profile);
              return;
            }
          } else if (res.status === 401 || res.status === 403) {
            console.log('[AuthProvider] Session expired, clearing local session');
            await PlatformBridge.clearSession();
            setSessionToken(null);
          }
        } catch (fetchErr: unknown) {
          clearTimeout(timeoutId);
          const err = fetchErr as { name?: string };
          if (err?.name === 'AbortError') {
            console.warn('[AuthProvider] Session check timed out. Proceeding to prevent hanging.');
          }
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
      // ── Fast login: stash la sesión para re-entrada con Face ID/PIN ──
      if (token) {
        try {
          const { stashFastLogin } = await import('@/lib/securityVault');
          await stashFastLogin(token);
        } catch { /* noop */ }
      }
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
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth().catch((err) => {
      if (active) console.error('[AuthProvider] Unhandled auth error:', err);
    });
    return () => {
      active = false;
    };
  }, [checkAuth]);

  // Push Notifications native registration (iOS APNs / Android FCM)
  useEffect(() => {
    if (user?.id && PlatformBridge.isNative()) {
      PlatformBridge.initPushNotifications({
        onToken: (token) => {
          // Persist push token to backend for targeting
          PlatformBridge.getAuthHeaders().then((headers) => {
            fetch('/api/notifications/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({ token, platform: PlatformBridge.getPlatform() }),
            }).catch((err) => console.warn('[Push] Error syncing token:', err));
          });
        },
        // Tap del push → deep-link (membresías, chat, conciliación, ofertas…)
        onNotificationTap: (route) => {
          try {
            router.push(route);
          } catch (e) {
            console.warn('[Push] navigate falló:', e);
          }
        },
      });
    }
  }, [user?.id]);

  // Identity gate: a member must complete their name/username before entering the app.
  // New users (created via OTP) are routed to the identity setup, even if they reopen the app.
  useEffect(() => {
    if (loading || !user) return;
    if (!user.firstName && pathname !== '/signup') {
      router.replace('/signup?setup=1');
    }
  }, [user, loading, pathname, router]);

  const needsIdentity = !!user && !user.firstName && pathname !== '/signup';

  if (loading || (!user && !PUBLIC_ROUTES.includes(pathname)) || needsIdentity) {
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
