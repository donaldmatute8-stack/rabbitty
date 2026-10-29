'use client';

/**
 * ── Kiosk Confirm ── El cliente escanea el QR del kiosko y confirma su identidad.
 * El pago se hace después desde el kiosko (Rabbitty Pay) — aquí SOLO se vincula
 * la identidad para que los Bunz de esa orden se acrediten a su cuenta.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

function ConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => { mod.default.ready(); mod.default.expand(); }).catch(() => {});
  }, []);

  const confirm = async () => {
    setBusy(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/kiosk/pair/confirm', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data?.success) {
        PlatformBridge.hapticFeedback('success');
        setState('done');
        setMsg(`¡Listo, ${data.customerName}! Tus Bunz de esta orden se acreditan a tu cuenta.`);
      } else {
        setState('error');
        setMsg(data?.error || 'No se pudo confirmar');
      }
    } catch {
      setState('error');
      setMsg('Error de conexión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-black px-6 relative overflow-hidden">
      <div className="absolute top-[-15%] w-64 h-64 rounded-full bg-[#E91E63]/20 blur-[80px] pointer-events-none" />
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#12121B] p-7 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E91E63]/15 border border-[#E91E63]/30 flex items-center justify-center text-3xl">
          🖥️
        </div>
        <h1 className="mt-4 text-xl font-black text-white">
          {state === 'done' ? '🎉 ¡Identidad vinculada!' : '¿Eres tú en el kiosko?'}
        </h1>

        {state === 'idle' && (
          <>
            <p className="mt-3 text-xs text-neutral-400 leading-relaxed">
              Confirma tu identidad para que los Bunz de esta orden se acrediten a tu cuenta automáticamente.
            </p>
            <p className="mt-2 text-[11px] text-neutral-500 font-mono break-all">token: {token.slice(0, 12)}…</p>
            <button
              onClick={confirm}
              disabled={busy}
              className="mt-6 w-full py-3.5 rounded-2xl bg-[#E91E63] text-white font-black text-sm active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Confirmando…' : `Sí, soy ${user?.firstName || 'yo'} — vincular`}
            </button>
            <button
              onClick={() => window.history.back()}
              className="mt-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-neutral-400 font-bold text-xs cursor-pointer"
            >
              Cancelar
            </button>
          </>
        )}

        {state === 'done' && (
          <>
            <p className="mt-2 text-sm text-emerald-400 font-bold">{msg}</p>
            <p className="mt-4 text-xs text-neutral-400">Ahora termina tu pago en el kiosko — el saldo de Bunz se aplicará solo.</p>
            <button
              onClick={() => window.history.back()}
              className="mt-6 w-full py-3.5 rounded-2xl bg-white/10 border border-white/10 text-white font-black text-sm cursor-pointer"
            >
              Volver al kiosko
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="mt-2 text-sm text-rose-400 font-bold">{msg}</p>
            <button
              onClick={() => setState('idle')}
              className="mt-6 w-full py-3.5 rounded-2xl bg-white/10 border border-white/10 text-white font-black text-sm cursor-pointer"
            >
              Reintentar
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function KioskConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
