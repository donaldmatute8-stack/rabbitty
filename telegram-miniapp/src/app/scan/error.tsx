'use client';

export default function ScanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#111] px-6 text-center">
      <span className="text-5xl mb-4">📷</span>
      <h1 className="text-xl font-bold text-white mb-2">Cámara no disponible</h1>
      <p className="text-sm text-[#888] mb-6 max-w-xs leading-relaxed">
        No pudimos acceder a la cámara. Verifica los permisos o ingresa el código manualmente.
      </p>
      <button
        onClick={reset}
        className="bg-[#E91E63] text-white font-bold text-sm px-8 py-3 rounded-full active:scale-95 transition-transform"
      >
        Reintentar
      </button>
    </div>
  );
}
