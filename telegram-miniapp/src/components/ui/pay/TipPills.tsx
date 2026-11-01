'use client';

/**
 * ── TipPills ── Pills de porcentaje con FONDO TRANSPARENTE (solo borde sutil).
 * Seleccionada: borde/texto en el acento de Rabbitty, sin relleno.
 */

import { PlatformBridge } from '@/lib/platform';

export default function TipPills({
  baseTotal,
  options = [10, 15, 20],
  selectedPct,
  onPick,
}: {
  baseTotal: number;
  options?: number[];
  /** null = monto manual en curso (pills en estado neutro) */
  selectedPct: number | null;
  onPick: (pct: number) => void;
}) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {options.map((pct) => {
        const active = selectedPct === pct;
        return (
          <button
            key={pct}
            type="button"
            onClick={() => { PlatformBridge.hapticFeedback('light'); onPick(pct); }}
            className={`px-3.5 py-2 rounded-full text-[11px] font-bold border transition-all cursor-pointer active:scale-95 tabular-nums ${
              active
                ? 'border-[#E91E63] text-[#FF7EB3] bg-transparent'
                : 'border-white/15 text-white/45 bg-transparent'
            }`}
          >
            {pct}% <span className={active ? 'text-[#FF7EB3]/80' : 'text-white/30'}>({round2((baseTotal * pct) / 100).toFixed(2)})</span>
          </button>
        );
      })}
    </div>
  );
}