'use client';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

export type PlatformType = 'telegram' | 'ios' | 'android' | 'web';

const SESSION_TOKEN_KEY = 'rabbitty_auth_session_token';
const USER_CACHE_KEY = 'rabbitty_user_cache';

export const PlatformBridge = {
  /**
   * Determine the runtime platform
   */
  getPlatform(): PlatformType {
    if (typeof window === 'undefined') return 'web';

    // Check Telegram Mini App first
    const tg = (window as any).Telegram?.WebApp;
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
   * Universal Haptic Feedback across Telegram, Native iOS/Android, and Web
   */
  async hapticFeedback(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
    if (typeof window === 'undefined') return;

    try {
      if (this.isTelegram()) {
        const haptics = (window as any).Telegram?.WebApp?.HapticFeedback;
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
    } catch (e) {
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
    } catch (e) {
      // ignore
    }

    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp;
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

  /**
   * Safe External Link Opener
   */
  async openExternalUrl(url: string) {
    if (typeof window === 'undefined') return;

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },
};
