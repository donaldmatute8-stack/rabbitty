'use client';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformBridge } from '@/lib/platform';

export type TwoFactorMethod = 'email' | 'phone' | 'totp';
export interface TwoFactorProof { method: TwoFactorMethod; code: string }

const LABELS: Record<TwoFactorMethod, string> = {
  email: 'Correo',
  phone: 'Teléfono',
  totp: 'App autenticadora',
};

function Prompt({
  methods,
  errorText,
  onDone,
}: {
  methods: TwoFactorMethod[];
  errorText?: string;
  onDone: (p: TwoFactorProof | null) => void;
}) {
  const [method, setMethod] = useState<TwoFactorMethod>(methods[0]);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(errorText ?? null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (method === 'totp' || sending) return;
    setSending(true);
    setError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/security/2fa', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'challenge', method, purpose: 'action' }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'No se pudo enviar el código.');
      else setHint(`Código enviado a ${data.hint}.`);
    } catch {
      setError('No se pudo enviar el código.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10000 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => onDone(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Verificación en dos pasos"
        className="w-full max-w-sm px-5 pt-5 pb-7 sm:rounded-3xl rounded-t-3xl flex flex-col gap-4"
        style={{ background: 'var(--bg-primary, #000)', color: 'var(--text-primary, #fff)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="m-0 text-[17px] font-extrabold">Verificación en dos pasos</h3>
          <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--text-muted, #888)' }}>
            Confirma con un código para autorizar esta operación.
          </p>
        </div>

        {methods.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setCode(''); setHint(null); setError(null); }}
                className="rounded-full px-3 py-1.5 text-[12px] font-bold border-none cursor-pointer"
                style={m === method ? { background: '#E91E63', color: '#fff' } : { background: 'transparent', color: 'var(--text-secondary, #aaa)', boxShadow: 'inset 0 0 0 1px var(--border-subtle, #333)' }}
              >
                {LABELS[m]}
              </button>
            ))}
          </div>
        )}

        {method !== 'totp' && (
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="rounded-full py-2 text-[13px] font-bold border-none cursor-pointer bg-transparent disabled:opacity-50"
            style={{ color: '#E91E63', boxShadow: 'inset 0 0 0 1px rgba(233,30,99,0.5)' }}
          >
            {sending ? 'Enviando…' : hint ? 'Reenviar código' : 'Enviar código'}
          </button>
        )}

        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setCode(v);
            if (v.length === 6) onDone({ method, code: v });
          }}
          placeholder="000000"
          className="w-full rounded-xl px-3 py-3 text-center text-2xl tracking-[8px] outline-none bg-transparent"
          style={{ color: 'inherit', boxShadow: 'inset 0 0 0 1px var(--border-subtle, #333)' }}
        />

        {hint && <p className="m-0 text-[12px]" style={{ color: '#10B981' }}>{hint}</p>}
        {error && <p className="m-0 text-[12px]" style={{ color: '#EF4444' }}>{error}</p>}

        <button
          type="button"
          onClick={() => onDone(null)}
          className="rounded-full py-2.5 text-[14px] font-bold border-none cursor-pointer bg-transparent"
          style={{ color: 'var(--text-secondary, #aaa)', boxShadow: 'inset 0 0 0 1px var(--border-subtle, #333)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Pide el segundo factor. Resuelve con {method, code} o null si el usuario cancela. */
export function promptForTwoFactor(methods: TwoFactorMethod[], errorText?: string): Promise<TwoFactorProof | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (v: TwoFactorProof | null) => {
      resolve(v);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(<Prompt methods={methods} errorText={errorText} onDone={finish} />);
  });
}
