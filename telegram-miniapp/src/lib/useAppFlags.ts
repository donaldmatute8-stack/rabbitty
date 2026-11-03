'use client';

/**
 * ── useAppFlags ── toggles de producto que controla el founder desde Admin God.
 *
 * Fuente: GET /api/settings (tabla systemSettings del core). Se cachea a nivel
 * de módulo para que home + discover + cualquier superficie que lo consuma
 * hagan UNA sola petición por sesión.
 *
 * Regla: todo lo que dependa de un flag se OCULTA por defecto (false) hasta que
 * el server confirme lo contrario — así el founder puede lanzar features por
 * goteo sin tocar código ni redeployar el cliente.
 */

import { useEffect, useState } from 'react';

export interface AppFlags {
  vibe_passport_enabled: boolean;
}

const DEFAULTS: AppFlags = { vibe_passport_enabled: false };

let cache: AppFlags | null = null;
let inFlight: Promise<AppFlags> | null = null;

async function fetchFlags(): Promise<AppFlags> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = fetch('/api/settings', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => {
      const next: AppFlags = {
        vibe_passport_enabled: d?.vibe_passport_enabled === true,
      };
      cache = next;
      return next;
    })
    .catch(() => DEFAULTS)
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function useAppFlags(): AppFlags {
  const [flags, setFlags] = useState<AppFlags>(cache ?? DEFAULTS);
  useEffect(() => {
    let alive = true;
    void fetchFlags().then((f) => { if (alive) setFlags(f); });
    return () => { alive = false; };
  }, []);
  return flags;
}

/** Invalida la caché (p. ej. tras cambiar un flag en admin y volver al feed). */
export function invalidateAppFlags() {
  cache = null;
}
