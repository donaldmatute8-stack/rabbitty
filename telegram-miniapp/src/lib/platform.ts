'use client';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

export type PlatformType = 'telegram' | 'ios' | 'android' | 'web';

const SESSION_TOKEN_KEY = 'rabbitty_auth_session_token';
const USER_CACHE_KEY = 'rabbitty_user_cache';

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { user?: { id?: number } };
  openLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
  };
}

interface WindowWithTelegram extends Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

export const PlatformBridge = {
  /**
   * Determine the runtime platform
   */
  getPlatform(): PlatformType {
    if (typeof window === 'undefined') return 'web';

    // Check Telegram Mini App first
    const tg = (window as WindowWithTelegram).Telegram?.WebApp;
    if (tg && (tg.initData || tg.initDataUnsafe?.user?.id)) {
      return 'telegram';
    }

    // Check Capacitor native
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform() as 'ios' | 'android';
    }

    return 'web';
  },

  isTelegram(): boolean {
    return this.getPlatform() === 'telegram';
  },

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  isIos(): boolean {
    return Capacitor.getPlatform() === 'ios';
  },

  isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  },

  isWeb(): boolean {
    return this.getPlatform() === 'web';
  },

  /**
   * Genera el enlace de retorno inteligente según la plataforma de origen:
   * - En Native Mobile App / Web: Genera el enlace web/universal (https://rabbitty.me/...)
   * - En Telegram Mini App: Genera el enlace de Telegram con startapp (https://t.me/Rabbittyme_bot/app?startapp=...)
   */
  getShareableLink(path: string, tgParam?: string): string {
    const isTg = this.isTelegram();
    if (isTg && tgParam) {
      return `https://t.me/Rabbittyme_bot/app?startapp=${encodeURIComponent(tgParam)}`;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://rabbitty.me${cleanPath}`;
  },

  /**
   * Universal Haptic Feedback across Telegram, Native iOS/Android, and Web
   */
  async hapticFeedback(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
    if (typeof window === 'undefined') return;

    try {
      if (this.isTelegram()) {
        const haptics = (window as WindowWithTelegram).Telegram?.WebApp?.HapticFeedback;
        if (haptics) {
          if (style === 'success' || style === 'warning' || style === 'error') {
            haptics.notificationOccurred(style);
          } else {
            haptics.impactOccurred(style);
          }
          return;
        }
      }

      if (this.isNative()) {
        if (style === 'success' || style === 'warning' || style === 'error') {
          const typeMap = {
            success: NotificationType.Success,
            warning: NotificationType.Warning,
            error: NotificationType.Error,
          };
          await Haptics.notification({ type: typeMap[style] });
        } else {
          const styleMap = {
            light: ImpactStyle.Light,
            medium: ImpactStyle.Medium,
            heavy: ImpactStyle.Heavy,
          };
          await Haptics.impact({ style: styleMap[style] });
        }
        return;
      }

      // Web Fallback
      if ('vibrate' in navigator) {
        navigator.vibrate(style === 'heavy' ? 40 : 15);
      }
    } catch {
      // Haptics should never throw unhandled
    }
  },

  /**
   * Secure Session Token Storage
   * Uses @capacitor/preferences on Native devices, with safe fallback.
   */
  async getSessionToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
      if (this.isNative()) {
        const { value } = await Preferences.get({ key: SESSION_TOKEN_KEY });
        return value || null;
      }

      // Web / Telegram fallback
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } catch (e) {
      console.warn('[PlatformBridge] Failed to read session token', e);
      return null;
    }
  },

  /**
   * Auth headers for API calls. Sends the persistent session token (native/web)
   * and the Telegram WebApp initData so the server can verify the caller either way.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    try {
      const token = await this.getSessionToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      const tg = (window as WindowWithTelegram).Telegram?.WebApp;
      if (tg?.initData) headers['X-Init-Data'] = tg.initData;
    }

    return headers;
  },

  async setSessionToken(token: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (this.isNative()) {
        await Preferences.set({ key: SESSION_TOKEN_KEY, value: token });
        return;
      }

      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch (e) {
      console.warn('[PlatformBridge] Failed to persist session token', e);
    }
  },

  async clearSession(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (this.isNative()) {
        await Preferences.remove({ key: SESSION_TOKEN_KEY });
        await Preferences.remove({ key: USER_CACHE_KEY });
      }

      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    } catch (e) {
      console.warn('[PlatformBridge] Failed to clear session', e);
    }
  },

  async getPreference(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
      if (this.isNative()) {
        const { value } = await Preferences.get({ key });
        return value || null;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setPreference(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if (this.isNative()) {
        await Preferences.set({ key, value });
        return;
      }
      localStorage.setItem(key, value);
    } catch {}
  },

  async removePreference(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if (this.isNative()) {
        await Preferences.remove({ key });
        return;
      }
      localStorage.removeItem(key);
    } catch {}
  },

  /**
   * Safe External Link Opener
   */
  async openExternalUrl(url: string) {
    if (typeof window === 'undefined') return;

    const tg = (window as WindowWithTelegram).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  /**
   * Universal Native Share (iOS / Android Native Sheet or Web Share API)
   */
  async share(options: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      this.hapticFeedback('medium');
      if (this.isNative()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: options.title || 'Rabbitty',
          text: options.text || '',
          url: options.url || '',
          dialogTitle: options.dialogTitle || 'Compartir Rabbitty',
        });
        return true;
      }

      if (navigator.share) {
        await navigator.share({
          title: options.title || 'Rabbitty',
          text: options.text || '',
          url: options.url || '',
        });
        return true;
      }

      if (options.url) {
        await navigator.clipboard.writeText(options.url);
        return true;
      }
    } catch (e) {
      const errName = e instanceof Error ? e.name : '';
      if (errName !== 'AbortError') {
        console.warn('[PlatformBridge] Share error:', e);
      }
    }
    return false;
  },

  /**
   * Initialize and request Native Push Notifications (iOS APNs / Android FCM).
   * Resolves with the device token once the OS returns it, and routes inbound
   * notifications through `onNotificationReceived`.
   */
  async initPushNotifications(handlers?: {
    onToken?: (token: string) => void;
    onNotificationReceived?: (notification: unknown) => void;
  }): Promise<string | null> {
    if (typeof window === 'undefined' || !this.isNative()) return null;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        return null;
      }

      return await new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        PushNotifications.addListener('registration', (token) => {
          const value = token?.value ?? null;
          if (value) {
            handlers?.onToken?.(value);
            finish(value);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.warn('[Push] Registration error:', err);
          finish(null);
        });

        if (handlers?.onNotificationReceived) {
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            handlers.onNotificationReceived?.(notification);
          });
        }

        // Kick off registration AFTER listeners are attached, otherwise the
        // 'registration' event can fire before we are listening and the token
        // would be dropped.
        PushNotifications.register().catch((err) => {
          console.warn('[Push] register() failed:', err);
          finish(null);
        });

        // Safety net: never leave the caller hanging if the OS never answers.
        setTimeout(() => finish(null), 15_000);
      });
    } catch (err) {
      console.warn('[Push] initPushNotifications failed:', err);
      return null;
    }
  },
};

