'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';
import { readSettings, subscribeSettings } from '@/lib/userSettings';

import { captureAffiliateIntent } from '@/lib/affiliateIntent';
import { captureDevUserFromUrl, getDevUserId } from '@/lib/devAuth';

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
  distinctBusinesses?: number;
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
// Rutas públicas por prefijo: los legales deben abrirse sin sesión para poder
// compartirse por enlace (antes /legal rebotaba a /onboarding en el navegador).
const PUBLIC_ROUTE_PREFIXES = ['/legal'];
const isPublicRoute = (path: string) =>
  PUBLIC_ROUTES.includes(path) || PUBLIC_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));

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

      // 1.5 DEV BYPASS (solo desarrollo local; el servidor lo ignora en prod)
      // Acepta `?devUser=deltoro` para abrir una pantalla concreta en el simulador.
      captureDevUserFromUrl();
      const devUserId = getDevUserId();
      if (devUserId) {
        try {
          const res = await fetch('/api/auth/session', {
            headers: await PlatformBridge.getAuthHeaders(),
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.profile) {
              setUser(data.profile);
              return;
            }
          }
        } catch (devErr) {
          console.warn('[AuthProvider] Dev bypass falló:', devErr);
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
      if (!isPublicRoute(pathname)) {
        router.replace('/onboarding');
      }
    } catch (e) {
      console.error('[AuthProvider] Auth check failed:', e);
      setUser(null);
      if (!isPublicRoute(pathname)) {
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
    captureAffiliateIntent();
  }, []);

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

  // Refresca perfil al volver a la app (Bunz, Hops, nivel, visitas) para que los
  // resets y cambios de saldo se reflejen sin cerrar sesión.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkAuth();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkAuth]);

  // Push Notifications native registration (iOS APNs / Android FCM)
  // Gate: respeta los ajustes del usuario (settings → push nativo).
  const [pushSettingVersion, setPushSettingVersion] = useState(0);
  // ── Push en PRIMER PLANO ──
  // iOS no muestra banner si la app está abierta. Sin esto, un cobro
  // (CHARGE_APPROVAL) o una cuenta enviada se pierden visualmente aunque
  // APNs los acepte. Mostramos un banner in-app tappable.
  const [foregroundPush, setForegroundPush] = useState<{ title: string; body: string; route: string } | null>(null);
  useEffect(() => {
    if (user?.id && PlatformBridge.isNative() && readSettings().nativePush) {
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
        // Push recibido con la app ABIERTA: iOS no pinta banner del sistema.
        // Lo mostramos in-app para no perder cobros/avisos.
        onNotificationReceived: (notification: any) => {
          try {
            const data = (notification?.data || {}) as Record<string, unknown>;
            const route = String(data.route || data.link || '');
            setForegroundPush({
              title: String(notification?.title || 'Rabbitty'),
              body: String(notification?.body || ''),
              route,
            });
            PlatformBridge.hapticFeedback('light');
          } catch { /* noop */ }
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
  }, [user?.id, pushSettingVersion]);

  // Heartbeat de primer plano: el worker no manda banner nativo si la app está abierta.
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ping = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      void PlatformBridge.getAuthHeaders()
        .then((headers) => fetch('/api/presence/heartbeat', { method: 'POST', headers }))
        .catch(() => {});
    };
    const start = () => {
      ping();
      if (!timer) timer = setInterval(ping, 60_000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id]);

  // El banner de primer plano se cierra solo a los 14s.
  useEffect(() => {
    if (!foregroundPush) return;
    const t = setTimeout(() => setForegroundPush(null), 14000);
    return () => clearTimeout(t);
  }, [foregroundPush]);

  // Re-registro cuando el usuario re-enciende el push en settings
  useEffect(() => {
    return subscribeSettings((s) => {
      if (s.nativePush) setPushSettingVersion((v) => v + 1);
    });
  }, []);

  // Identity gate: a member must complete their name/username before entering the app.
  // New users (created via OTP) are routed to the identity setup, even if they reopen the app.
  useEffect(() => {
    if (loading || !user) return;
    if (!user.firstName && pathname !== '/signup') {
      router.replace('/signup?setup=1');
    }
  }, [user, loading, pathname, router]);

  const needsIdentity = !!user && !user.firstName && pathname !== '/signup';

  if (loading || (!user && !isPublicRoute(pathname)) || needsIdentity) {
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
      {foregroundPush && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            left: 12,
            right: 12,
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              const route = foregroundPush.route;
              setForegroundPush(null);
              if (route) { try { router.push(route); } catch { /* noop */ } }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { const r = foregroundPush.route; setForegroundPush(null); if (r) router.push(r); } }}
            style={{
              pointerEvents: 'auto',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              maxWidth: 380,
              borderRadius: 20,
              padding: '11px 13px 13px',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              cursor: foregroundPush.route ? 'pointer' : 'default',
              background: 'color-mix(in srgb, var(--bg-elevated, #14101c) 82%, transparent)',
              backdropFilter: 'blur(26px) saturate(180%)',
              WebkitBackdropFilter: 'blur(26px) saturate(180%)',
              border: '1px solid color-mix(in srgb, var(--border-subtle, rgba(255,255,255,0.12)) 85%, transparent)',
              boxShadow: '0 18px 40px -22px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 -10px 30px -24px rgba(233,30,99,0.4)',
            }}
          >
            <span
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, flexShrink: 0, borderRadius: 12, color: '#fff',
                background: 'linear-gradient(140deg, #E91E63 0%, #8B5CF6 100%)',
                boxShadow: '0 8px 18px -8px rgba(233,30,99,0.42)',
              }}
            >
              🎟️
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'color-mix(in srgb, var(--text-muted, rgba(255,255,255,0.55)) 92%, transparent)',
                }}
              >
                Rabbitty
              </span>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, lineHeight: 1.3, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {foregroundPush.title}
              </p>
              {foregroundPush.body && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.6))', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {foregroundPush.body}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={(e) => { e.stopPropagation(); setForegroundPush(null); }}
              style={{
                flexShrink: 0, border: 'none', width: 26, height: 26, borderRadius: 999,
                background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted, rgba(255,255,255,0.6))',
                cursor: 'pointer', fontSize: 12,
              }}
            >
              ✕
            </button>
            <span
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 2,
                background: 'linear-gradient(90deg, #E91E63 0%, #8B5CF6 100%)', opacity: 0.75,
              }}
            />
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
