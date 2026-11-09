'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Wallet, Banknote, CreditCard, Split } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

interface ChargeRequest {
  id: string;
  status: string;
  method: string;
  amount: number;
  tipAmount: number;
  businessName: string | null;
  items: Array<{ name: string; quantity: number; totalPrice: number }>;
  expiresAt: string;
}

function methodMeta(method: string) {
  const m = String(method || '').toUpperCase();
  if (m === 'BUNZ') return { label: 'Bunz', icon: Wallet };
  if (m === 'DIVIDIDA') return { label: 'Efectivo + Bunz', icon: Split };
  if (m === 'TARJETA_EXTERNA') return { label: 'Tarjeta (terminal)', icon: CreditCard };
  if (m === 'TARJETA') return { label: 'Tarjeta', icon: CreditCard };
  return { label: 'Efectivo', icon: Banknote };
}

export default function ChargeConfirmPage() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const requestId = params?.requestId;

  const [request, setRequest] = useState<ChargeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'confirmed' | 'rejected' | 'expired' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!requestId) return;
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/pay/charge-approval?requestId=${encodeURIComponent(requestId)}`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'No se pudo leer el cobro');
      setRequest(data.request);
      if (data.request.status === 'APPROVED') setOutcome('confirmed');
      else if (data.request.status === 'REJECTED' || data.request.status === 'CANCELLED') setOutcome('rejected');
      else if (data.request.status === 'EXPIRED') setOutcome('expired');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (decision: 'approve' | 'reject') => {
    if (!requestId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pay/charge-approval', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || 'No se pudo responder');
      PlatformBridge.hapticFeedback(decision === 'approve' ? 'success' : 'light');
      if (data.status === 'APPROVED') setOutcome('confirmed');
      else if (data.status === 'REJECTED') setOutcome('rejected');
      else if (data.status === 'EXPIRED') setOutcome('expired');
      else setOutcome(decision === 'approve' ? 'confirmed' : 'rejected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B10] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="h-7 w-7 animate-spin text-pink-400" />
        <p className="text-xs text-white/40">Revisando el cobro…</p>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-[#0B0B10] flex flex-col items-center justify-center gap-3 text-white px-6 text-center">
        <XCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-white/70">{error}</p>
        <button onClick={() => router.replace('/')} className="mt-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-bold text-white">
          Volver
        </button>
      </div>
    );
  }

  const meta = methodMeta(request?.method || '');
  const Icon = meta.icon;
  const total = Number(request?.amount || 0);

  return (
    <div className="min-h-screen bg-[#0B0B10] text-white px-4 py-8 flex flex-col">
      <div className="pointer-events-none absolute -top-28 -right-20 h-64 w-64 rounded-full bg-pink-600/20 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-0 -left-24 h-64 w-64 rounded-full bg-violet-600/20 blur-[90px]" />

      <div className="relative max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-16 w-16 rounded-2xl border border-pink-400/30 bg-pink-500/15 flex items-center justify-center"
          >
            <ShieldCheck className="h-8 w-8 text-pink-300" />
          </motion.div>
          <h1 className="mt-3 text-[22px] font-black leading-tight">Confirma tu cobro</h1>
          <p className="mt-1 text-[12px] text-white/45">
            {request?.businessName || 'El negocio'} te está cobrando. Solo se ejecutará si confirmas.
          </p>
        </div>

        <div className="mt-5 rounded-3xl border border-white/12 bg-white/[0.06] backdrop-blur-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] font-bold text-white/85">
              <Icon className="h-4 w-4 text-pink-300" /> {meta.label}
            </span>
            <span className="text-[28px] font-black tabular-nums">${total.toFixed(2)}</span>
          </div>

          <div className="mt-3 space-y-1.5">
            {(request?.items ?? []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 text-[12px] text-white/65">
                <span className="truncate">
                  <span className="text-white/40">{item.quantity}×</span> {item.name}
                </span>
                <span className="tabular-nums shrink-0">${Number(item.totalPrice || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {Number(request?.tipAmount || 0) > 0 && (
            <p className="mt-2 text-[10px] text-white/40">Incluye propina ${Number(request?.tipAmount).toFixed(2)}</p>
          )}
        </div>

        {outcome === 'confirmed' && (
          <div className="mt-5 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-400 mx-auto" />
            <p className="mt-2 text-[15px] font-black text-emerald-300">Cobro autorizado</p>
            <p className="text-[11px] text-white/50">El cajero ya puede completar el cobro.</p>
          </div>
        )}

        {outcome === 'rejected' && (
          <div className="mt-5 rounded-3xl border border-red-400/30 bg-red-500/10 p-5 text-center">
            <XCircle className="h-9 w-9 text-red-400 mx-auto" />
            <p className="mt-2 text-[15px] font-black text-red-300">Cobro no autorizado</p>
            <p className="text-[11px] text-white/50">El negocio no podrá cobrarte este importe.</p>
          </div>
        )}

        {outcome === 'expired' && (
          <div className="mt-5 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-center">
            <XCircle className="h-9 w-9 text-amber-400 mx-auto" />
            <p className="mt-2 text-[15px] font-black text-amber-300">Solicitud expirada</p>
            <p className="text-[11px] text-white/50">Pide al negocio que genere el cobro de nuevo.</p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-[11px] text-red-300 text-center">{error}</p>
        )}

        <div className="mt-auto pt-6 space-y-2">
          {!outcome && request?.status === 'PENDING' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond('approve')}
                className="w-full rounded-2xl bg-linear-to-r from-[#FF2E93] to-[#E91E63] py-4 text-[15px] font-black text-white shadow-[0_14px_40px_-18px_rgba(233,30,99,0.8)] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? 'Procesando…' : `Sí, cobrar $${total.toFixed(2)}`}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond('reject')}
                className="w-full rounded-2xl border border-white/15 bg-white/[0.05] py-3.5 text-[13px] font-black text-white/75 active:scale-[0.99] disabled:opacity-50"
              >
                No autorizar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="w-full py-2 text-[11px] font-bold text-white/35"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
