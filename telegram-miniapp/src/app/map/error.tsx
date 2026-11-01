'use client';

/**
 * Error boundary de /map — antes el crash era opaco ("Algo salió mal" tal cual,
 * venía del root error.tsx). Aquí capturamos el stack real para diagnosticar
 * el fallo del mapa nativo (MapKit/Leaflet) y ofrecemos reintentar.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[MAP_ERROR]', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      <p className="text-2xl">🗺️</p>
      <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
        El mapa no se pudo abrir
      </h2>
      <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
        {error?.message?.slice(0, 140) || 'Falló la inicialización del mapa.'}
      </p>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-pink-500 text-white font-black text-xs active:scale-95 transition-transform"
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl font-bold text-xs border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          Volver
        </button>
      </div>
    </div>
  );
}