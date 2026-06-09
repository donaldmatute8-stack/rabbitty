'use client';

export default function HistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#FAFAFA] px-6 text-center">
      <span className="text-5xl mb-4">📜</span>
      <h1 className="text-xl font-bold text-[#111] mb-2">Error al cargar historial</h1>
      <p className="text-sm text-[#888] mb-6 max-w-xs leading-relaxed">
        No pudimos cargar tu historial de transacciones.
      </p>
      <button
        onClick={reset}
        className="bg-[#111] text-white font-bold text-sm px-8 py-3 rounded-full active:scale-95 transition-transform"
      >
        Reintentar
      </button>
    </div>
  );
}
