'use client';

import { useState } from 'react';
import { Sparkles, X, Gift, ShieldCheck } from 'lucide-react';

interface BunzInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateName?: string;
  rewardPercentage?: number;
}

export function BunzInfoModal({
  isOpen,
  onClose,
  affiliateName = 'tu comercio favorito',
  rewardPercentage = 15,
}: BunzInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#121218] text-white p-7 sm:p-8 shadow-2xl border border-pink-500/30 text-left space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="space-y-2 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-400 text-[11px] font-mono font-bold uppercase tracking-wider">
            <Sparkles size={13} /> Sistema de Recompensas Rabbitty
          </div>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            ¿Qué es <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">bunz</span>?
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed font-normal">
            <strong>bunz</strong> es la unidad oficial de recompensa digital de la red de fidelidad <strong>Rabbitty</strong> en México.
          </p>
        </div>

        {/* Rule 1 Bunz = 1 MXN */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block font-bold">
              Equivalencia Real
            </span>
            <div className="text-2xl font-black text-white font-mono mt-0.5">
              1 bunz = $1.00 MXN
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Sin puntos confusos ni cálculos difíciles. Lo que acumulas equivale a saldo directo para disfrutar.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Gift size={24} />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-pink-400">
            ¿Cómo funciona en {affiliateName}?
          </h4>

          <div className="grid grid-cols-1 gap-2.5 text-xs text-zinc-300">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-pink-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <strong className="text-white block font-semibold">Acumula en cada consumo</strong>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Cada vez que pagas en {affiliateName}, acumulas el <strong>+{rewardPercentage}%</strong> de tu ticket en <strong>bunz</strong> escaneando tu código desde la app.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 font-black text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <strong className="text-white block font-semibold">Saldo disponible de inmediato</strong>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Tus <strong>bunz</strong> se reflejan al instante en tu wallet de Rabbitty, protegidos y listos para tu siguiente visita.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 font-black text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <strong className="text-white block font-semibold">Canjea en lo que quieras</strong>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Descuenta tus <strong>bunz</strong> directamente en tu cuenta de café, postres o consumos aquí o en cualquier comercio afiliado de la red.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Legal notice */}
        <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-pink-500" />
            <span>Sin vencimiento forzoso · Seguro y sin comisiones</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export function BunzBadge({
  affiliateName = 'este comercio',
  rewardPercentage = 15,
  className = '',
}: {
  affiliateName?: string;
  rewardPercentage?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Haz clic para ver qué es bunz"
        className={`inline-flex items-center gap-1 font-semibold text-pink-500 hover:text-pink-400 underline decoration-pink-500/40 hover:decoration-pink-400 underline-offset-2 transition-colors cursor-pointer group ${className}`}
      >
        <span>bunz</span>
        <span className="text-[10px] opacity-75 font-mono group-hover:scale-110 transition-transform">ℹ️</span>
      </button>

      <BunzInfoModal
        isOpen={open}
        onClose={() => setOpen(false)}
        affiliateName={affiliateName}
        rewardPercentage={rewardPercentage}
      />
    </>
  );
}
