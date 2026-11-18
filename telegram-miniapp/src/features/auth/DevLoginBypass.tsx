'use client';

/**
 * ── Selector de usuario para desarrollo local ─────────────────────────────
 *
 * Aparece sólo en desarrollo (`isDevAuthEnabled`). Permite entrar como Rabbitter
 * o como dueño de negocio sin Telegram ni contraseña, y recuerda la elección para
 * que el resto de la app mande la cabecera `x-dev-user`.
 *
 * El servidor ignora esa cabecera cuando `NODE_ENV === 'production'`, así que este
 * componente no puede abrir nada en la app real; incluso si se renderizara, el
 * backend no lo reconocería.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';
import { DEV_USERS, getDevUserId, isDevAuthEnabled, setDevUserId } from '@/lib/devAuth';
import { useAuth } from '@/features/auth/AuthProvider';

export function DevLoginBypass() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActive(getDevUserId());
  }, []);

  if (!isDevAuthEnabled()) return null;

  const enter = async (id: string) => {
    setBusy(true);
    try {
      setDevUserId(id);
      setActive(id);
      PlatformBridge.hapticFeedback('success');
      await checkAuth().catch(() => null);
      router.push('/');
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => {
    setBusy(true);
    try {
      setDevUserId(null);
      setActive(null);
      await PlatformBridge.setSessionToken?.('').catch(() => null);
      await checkAuth().catch(() => null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-4 w-full max-w-[420px] rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/[0.06] p-3">
      <p className="m-0 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/80">
        Solo desarrollo · bypass de login
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {DEV_USERS.map((user) => (
          <button
            key={user.id}
            type="button"
            disabled={busy}
            onClick={() => void enter(user.id)}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition-colors ${
              active === user.id
                ? 'border-amber-300/50 bg-amber-300/10 text-amber-100'
                : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]'
            }`}
          >
            <span>
              {user.label}
              <span className="mt-0.5 block text-[10px] font-medium text-white/40">{user.hint}</span>
            </span>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-300/80">
              {active === user.id ? 'activo' : 'entrar'}
            </span>
          </button>
        ))}
        {active && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void exit()}
            className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-white/50 hover:text-white/80"
          >
            Salir del bypass
          </button>
        )}
      </div>
      <p className="m-0 mt-2 text-[10px] leading-snug text-white/35">
        El servidor ignora esta cabecera en producción. Si no ves la pantalla esperada, recarga.
      </p>
    </div>
  );
}
