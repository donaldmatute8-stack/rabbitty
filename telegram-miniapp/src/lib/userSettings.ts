'use client';

/**
 * ── userSettings ── Ajustes del usuario (notificaciones push/in-app/email).
 * UNA sola fuente de verdad: `rabbitty_settings_v1` en localStorage, leída por
 * /settings, el panel de notificaciones, ProfileDrawer y AuthProvider
 * (gating del registro APNs). Cambia → dispara `rabbitty:settings-changed`.
 */

export interface UserSettings {
  /** Push nativo del dispositivo (APNs) — gates registro de token */
  nativePush: boolean;
  /** Feed de notificaciones in-app (campana) */
  inAppBell: boolean;
  /** Email (resúmenes y alertas; infra de envío en fase posterior) */
  email: boolean;
}

export const SETTINGS_KEY = 'rabbitty_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  nativePush: true,
  inAppBell: true,
  email: false,
};

export function readSettings(): UserSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      nativePush: parsed.nativePush !== false,
      inAppBell: parsed.inAppBell !== false,
      email: parsed.email === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: UserSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch { /* almacenamiento lleno/bloqueado: sigue en memoria */ }
  window.dispatchEvent(new CustomEvent('rabbitty:settings-changed', { detail: next }));
}

export function subscribeSettings(cb: (s: UserSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<UserSettings>).detail;
    cb(detail ? detail : readSettings());
  };
  window.addEventListener('rabbitty:settings-changed', handler);
  return () => window.removeEventListener('rabbitty:settings-changed', handler);
}