'use client';

/**
 * ── Bypass de autenticación para desarrollo local ────────────────────────
 *
 * En el simulador no hay Telegram ni sesión web, así que la app se queda en la
 * pantalla de bienvenida y no hay forma de entrar a revisar pantallas.
 *
 * Este módulo permite entrar como un usuario local **sólo cuando la app corre en
 * desarrollo**. El candado real está en el servidor (`serverAuth`): si
 * `NODE_ENV === 'production'` la cabecera `x-dev-user` se ignora por completo, así
 * que aunque alguien la envíe contra producción no sirve de nada.
 *
 * Usuarios útiles en la base local:
 * - `daffee99-…` (deltoro)  → Rabbitter con historial, Bunz y pedidos
 * - `f7178385-…` (iaherrera) → dueño de negocio (panel de afiliado)
 */

const KEY = 'rabbitty_dev_user';

export const DEV_USERS = [
  {
    id: 'daffee99-0c55-4975-a9ea-f167f95a2093',
    label: 'deltoro · Rabbitter',
    hint: 'Bunz, pedidos y check-ins',
  },
  {
    id: 'f7178385-0010-4000-8000-000000000001',
    label: 'iaherrera · Negocio',
    hint: 'Dueño de 626 Café (panel de afiliado)',
  },
] as const;

/** ¿Estamos en desarrollo? (en producción siempre false) */
export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function getDevUserId(): string | null {
  if (!isDevAuthEnabled() || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Atajo para abrir una pantalla concreta en el simulador:
 *   http://localhost:3000/affiliate/<id>?devUser=deltoro
 * Sólo en desarrollo; en producción no hace nada (y el servidor ignora igual la
 * cabecera). Acepta el alias (`deltoro`, `iaherrera`) o el uuid.
 */
export function captureDevUserFromUrl(): string | null {
  if (!isDevAuthEnabled() || typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('devUser');
    if (!raw) return null;
    const alias = DEV_USERS.find((u) => u.label.toLowerCase().startsWith(raw.toLowerCase()));
    const id = alias?.id ?? raw;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function setDevUserId(id: string | null): void {
  if (!isDevAuthEnabled() || typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* modo privado: sin bypass */
  }
}
