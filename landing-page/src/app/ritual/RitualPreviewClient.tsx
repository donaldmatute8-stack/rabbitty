'use client';

import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { WelcomeRitual } from '@/components/WelcomeRitual';

export function RitualPreviewClient() {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState(0);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070F] px-6 text-center text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-500/25 bg-pink-500/10 text-pink-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="m-0 mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">
          Revisión interna
        </p>
        <h1 className="m-0 mt-2 text-2xl font-black tracking-tight">Ritual de bienvenida</h1>
        <p className="m-0 mt-2 text-sm leading-relaxed text-white/55">
          Es el mismo ritual de la app y del alta: audio, tres frases, logo y barra de progreso.
          Se puede omitir en cualquier momento y se repite las veces que quieras.
        </p>

        <button
          type="button"
          onClick={() => {
            setRunId((n) => n + 1);
            setOpen(true);
          }}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 px-5 py-4 text-sm font-black text-white shadow-[0_0_24px_rgba(255,46,147,0.3)] transition-transform active:scale-[0.99]"
        >
          <Play className="h-4 w-4" /> Reproducir ritual
        </button>

        <p className="m-0 mt-3 text-[11px] leading-relaxed text-white/35">
          Toca el botón para que el navegador permita el audio desde el primer segundo.
        </p>
      </div>

      {open && (
        <WelcomeRitual
          key={runId}
          forceOpen
          storageKey="rabbitty_affiliate_ritual_preview"
          audioSrc="/assets/lugares-por-descubrir.mp3"
          onComplete={() => setOpen(false)}
        />
      )}
    </div>
  );
}
