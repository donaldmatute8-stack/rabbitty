'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ScanRedirectContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const claimToken = searchParams?.get('claimToken') || searchParams?.get('claim');
    const tableId = searchParams?.get('tableId') || searchParams?.get('table');
    const branchId = searchParams?.get('branchId') || searchParams?.get('branch');
    const business = searchParams?.get('business');

    const params = new URLSearchParams();
    if (claimToken) params.set('claimToken', claimToken);
    if (tableId) params.set('tableId', tableId);
    if (branchId) params.set('branchId', branchId);
    if (business) params.set('business', business);

    const queryString = params.toString();
    const appTargetUrl = `https://app.rabbitty.me/scan${queryString ? `?${queryString}` : ''}`;
    const customSchemeUrl = `rabbitty://scan${queryString ? `?${queryString}` : ''}`;

    // 1. Intentar abrir la app nativa instalada vía Custom Scheme
    window.location.href = customSchemeUrl;

    // 2. Si no abre la app nativa en 1 segundo, redirigir a app.rabbitty.me
    const timer = setTimeout(() => {
      window.location.href = appTargetUrl;
    }, 1200);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6 text-center select-none">
      <div className="h-24 w-24 rounded-3xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center mb-6 animate-pulse">
        <span className="text-4xl">🐰</span>
      </div>
      <h1 className="text-2xl font-black mb-2">Abriendo Rabbitty...</h1>
      <p className="text-sm text-gray-400 max-w-xs mb-8">
        Te estamos conectando con tu app para reclamar tus recompensas y Bunz.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            window.location.href = `https://app.rabbitty.me/scan?${params.toString()}`;
          }}
          className="w-full py-3.5 rounded-2xl bg-pink-500 hover:bg-pink-400 text-white font-black text-sm shadow-lg shadow-pink-500/25 active:scale-95 transition-all"
        >
          Continuar en Web / Telegram
        </button>
      </div>
    </div>
  );
}

export default function ScanRedirectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando...</div>}>
      <ScanRedirectContent />
    </Suspense>
  );
}
