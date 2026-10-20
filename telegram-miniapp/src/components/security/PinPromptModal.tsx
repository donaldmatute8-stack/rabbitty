'use client';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PIN_DIGITS } from '@/lib/securityVault';

function PinPrompt({ lockedMs, onDone }: { lockedMs: number; onDone: (v: string | null) => void }) {
  const [value, setValue] = useState('');
  const locked = lockedMs > 0;

  return (
    <div
      className="fixed inset-0 z-10000 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => onDone(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ingresa tu PIN"
        className="w-full max-w-sm px-5 pt-5 pb-7 sm:rounded-3xl rounded-t-3xl flex flex-col gap-4"
        style={{ background: 'var(--bg-primary, #000)', color: 'var(--text-primary, #fff)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="m-0 text-[17px] font-extrabold">Autoriza con tu PIN</h3>
          <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--text-muted, #888)' }}>
            {locked
              ? `Bloqueado temporalmente. Inténtalo en ${Math.ceil(lockedMs / 1000)} s.`
              : `Ingresa tu PIN de ${PIN_DIGITS} dígitos para enviar Bunz.`}
          </p>
        </div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_DIGITS}
          disabled={locked}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setValue(v);
            if (v.length === PIN_DIGITS) onDone(v);
          }}
          className="w-full rounded-xl px-3 py-3 text-center text-2xl tracking-[10px] outline-none bg-transparent"
          style={{ color: 'inherit', boxShadow: 'inset 0 0 0 1px var(--border-subtle, #333)' }}
        />
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

/** Muestra el modal de PIN y resuelve con el PIN ingresado o null si se cancela. */
export function promptForPin(opts: { lockedMs: number }): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (v: string | null) => {
      resolve(v);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(<PinPrompt lockedMs={opts.lockedMs} onDone={finish} />);
  });
}
