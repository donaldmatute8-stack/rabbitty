'use client';

/**
 * Frontera de error de la app móvil.
 *
 * Antes, cualquier excepción de una pantalla dejaba la app en blanco ("client
 * side exception") sin salida. Ahora se muestra un mensaje claro y dos salidas:
 * reintentar la pantalla o volver al inicio.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Home } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[app] error de pantalla:', error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-2xl" style={{ background: 'rgba(233,30,99,0.12)', border: '1px solid rgba(233,30,99,0.28)' }}>
        🐰
      </div>
      <div>
        <h1 className="m-0 text-lg font-black" style={{ color: 'var(--text-primary)' }}>Algo se enredó</h1>
        <p className="m-0 mt-1 text-[13px] leading-snug" style={{ color: 'var(--text-muted)' }}>
          Esta pantalla no pudo cargarse. Puedes intentarlo otra vez o volver al inicio.
        </p>
      </div>
      <div className="flex w-full max-w-[280px] flex-col gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8B5CF6 100%)' }}
        >
          <RefreshCw size={16} /> Reintentar
        </button>
        <button
          type="button"
          onClick={() => router.replace('/')}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black active:scale-[0.98] transition-transform"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <Home size={16} /> Ir al inicio
        </button>
      </div>
    </div>
  );
}
