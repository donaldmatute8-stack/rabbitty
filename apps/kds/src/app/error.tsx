"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] p-8 text-center">
      <h1 className="text-2xl font-bold text-white">Algo salió mal</h1>
      <p className="mt-2 text-gray-400">{error.message}</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-pink-600 px-6 py-3 text-sm font-semibold text-white hover:bg-pink-700">
        Intentar de nuevo
      </button>
    </div>
  );
}
