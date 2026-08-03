'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#FAFAFA] px-6 text-center">
      <img src="/logo_conejo.png" alt="Rabbitty Logo" className="w-16 h-16 object-contain mb-4 filter drop-shadow-[0_0_12px_rgba(233,30,99,0.3)]" />
      <h1 className="text-xl font-bold text-[#111] mb-2">Algo salió mal</h1>
      <p className="text-sm text-[#888] mb-6 max-w-xs leading-relaxed">
        Tuvimos un problema inesperado. Ya lo registramos.
      </p>
      <button
        onClick={reset}
        className="bg-[#111] text-white font-bold text-sm px-8 py-3 rounded-full active:scale-95 transition-transform"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
