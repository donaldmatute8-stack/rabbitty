'use client';

import { useCallback, useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { PlatformBridge } from '@/lib/platform';

interface RecRequest {
  id: string;
  orderId: string;
  businessName: string | null;
  claimedBunz: number;
  status: string;
  affiliateNote?: string | null;
  godNote?: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_AFFILIATE: '⏳ El negocio está revisando tu reclamo',
  AFFILIATE_APPROVED: '✓ El negocio lo reconoció — espera autorización final',
  AFFILIATE_REJECTED: '⚖️ El negocio lo disputó — God decidirá',
  PENDING_GOD: '👑 En revisión final de Rabbitty',
  DELIVERY_PROCESSING: '⏱️ Acreditando tus Bunz…',
  DELIVERED: '✅ ¡Conciliado! Tus Bunz ya están en tu billetera',
  GOD_REJECTED: '❌ Rechazado',
};

export default function ReconciliationPage() {
  const [folio, setFolio] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [requests, setRequests] = useState<RecRequest[]>([]);

  const load = useCallback(async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/reconciliation', { headers });
      const data = await res.json();
      if (data?.success) setRequests(data.requests || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/reconciliation/request', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio: folio.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        PlatformBridge.hapticFeedback('success');
        setMsg(`⚖️ Conciliación registrada por ${data.request.claimedBunz} Bunz. El negocio y Rabbitty ya la están revisando.`);
        setFolio(''); setNote('');
        load();
      } else {
        setMsg(data?.error || 'No se pudo registrar la conciliación');
      }
    } catch {
      setMsg('Error al conectar con el servidor');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileSubpageLayout title="⚖️ Conciliar compra">
      <div className="space-y-5 p-4">
        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'rgba(233,30,99,0.06)', border: '1px solid rgba(233,30,99,0.25)' }}>
          <p className="text-white/70 text-xs leading-relaxed">
            Si compraste en un negocio afiliado y <b className="text-white">no recibiste tus Bunz</b>, pide una conciliación con el
            <b className="text-white"> folio de tu ticket</b> (aparece impreso, formato <code className="text-pink-400">RABBITTY: XXXXXXXX-X</code>).
            El negocio lo revisa y Rabbitty autoriza la entrega — nunca pierdes el registro.
          </p>
          <input
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="Folio del ticket (ej. 88DE953E-B)"
            className="w-full rounded-xl px-3 py-3 text-sm outline-none text-white"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="¿Qué pasó? (mín. 5 caracteres)"
            rows={3}
            className="w-full rounded-xl px-3 py-3 text-sm outline-none text-white resize-none"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button
            onClick={submit}
            disabled={busy || folio.trim().length < 8 || note.trim().length < 5}
            className="w-full py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-transform"
            style={{
              background: busy || folio.trim().length < 8 || note.trim().length < 5 ? '#333' : 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
              color: busy || folio.trim().length < 8 || note.trim().length < 5 ? '#666' : '#FFF',
            }}
          >
            {busy ? 'Registrando…' : 'Solicitar conciliación'}
          </button>
          {msg && <p className="text-xs text-white/80">{msg}</p>}
        </div>

        {requests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Mis conciliaciones</p>
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-bold">{r.claimedBunz} Bunz · {r.businessName || 'Negocio'}</p>
                  <p className="text-white/40 text-[10px]">{r.orderId.slice(0, 8).toUpperCase()}-{r.orderId.slice(8, 9).toUpperCase()}</p>
                </div>
                <p className="text-xs text-white/60 mt-1">{STATUS_LABEL[r.status] || r.status}</p>
                {r.affiliateNote && <p className="text-xs text-white/40 mt-0.5">🏪 {r.affiliateNote}</p>}
                {r.godNote && <p className="text-xs text-white/40 mt-0.5">👑 {r.godNote}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProfileSubpageLayout>
  );
}
