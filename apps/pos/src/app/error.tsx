"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Algo salió mal</h1>
      <p className="mt-2 text-gray-500">Ocurrió un error inesperado. Por favor intenta de nuevo.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-pink-600 px-6 py-3 text-sm font-semibold text-white hover:bg-pink-700">
        Intentar de nuevo
      </button>
    </div>
  );
}
