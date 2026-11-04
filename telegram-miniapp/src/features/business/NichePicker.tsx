'use client';

/**
 * ── NichePicker (Paso 0 del onboarding) ──
 *
 * El afiliado elige QUÉ tipo de negocio es antes de cualquier otra cosa. De ahí
 * se derivan los módulos que verá (mesas, cocina, citas, inventario…), así que
 * un barbero o un gym no requieren un refactor: solo otro nicho en el catálogo.
 *
 * Catálogo desde /api/niches (tabla `niches`) → añadir un nicho no toca código.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Coffee, Wine, Croissant, Pizza, Flame, Scissors, Dumbbell,
  ShoppingBag, Calendar, Store, Check, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

export interface NicheOption {
  id: string;
  name: string;
  icon?: string | null;
  capabilities?: Record<string, boolean>;
}

const ICONS: Record<string, typeof Store> = {
  utensils: Utensils,
  coffee: Coffee,
  wine: Wine,
  croissant: Croissant,
  pizza: Pizza,
  flame: Flame,
  scissors: Scissors,
  dumbbell: Dumbbell,
  'shopping-bag': ShoppingBag,
  calendar: Calendar,
  store: Store,
};

const BLURB: Record<string, string> = {
  restaurant: 'Mesas, cocina y cuentas por comensal',
  cafe: 'Barra rápida, pedidos para llevar y lealtad',
  bar: 'Cuentas abiertas, happy hour y control de barra',
  bakery: 'Venta por pieza o charola, sin mesas',
  pizza: 'Pedidos a domicilio y para recoger',
  tacos: 'Alta rotación, mesas y pedidos al momento',
  barbershop: 'Citas por barbero y comisiones',
  fitness: 'Membresías, clases y accesos',
  retail: 'Inventario, código de barras y caja',
  services: 'Agenda de servicios y anticipos',
  other: 'Configúralo a tu manera',
};

function iconFor(name?: string | null) {
  return (name && ICONS[name]) || Store;
}

export function NichePicker({
  value,
  onSelect,
  onContinue,
  onBack,
  submitLabel = 'Continuar',
}: {
  value?: string | null;
  onSelect: (niche: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  submitLabel?: string;
}) {
  const [options, setOptions] = useState<NicheOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/niches', { cache: 'force-cache' })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.success && Array.isArray(d.niches)) setOptions(d.niches); })
      .catch(() => { /* fallback vacío: se ve el estado de carga */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const pick = (id: string) => {
    PlatformBridge.hapticFeedback('light');
    setTouched(true);
    onSelect(id);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+18px)] pb-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold"
            style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <ArrowLeft size={15} /> Atrás
          </button>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="m-0 text-[26px] font-black leading-tight tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          ¿Qué tipo de negocio es?
        </motion.h1>
        <p className="m-0 mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Con esto preparamos tu caja, tu menú y tus reportes. Puedes cambiarlo después.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[86px] animate-pulse rounded-2xl" style={{ background: 'var(--bg-pressed)' }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pt-3">
            {options.map((opt, i) => {
              const Icon = iconFor(opt.icon);
              const active = value === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => pick(opt.id)}
                  aria-pressed={active}
                  className="relative flex flex-col items-start gap-1.5 rounded-2xl p-3 text-left"
                  style={{
                    minHeight: 86,
                    background: active ? 'rgba(233,30,99,0.12)' : 'var(--bg-elevated)',
                    border: `1px solid ${active ? 'rgba(233,30,99,0.55)' : 'var(--border-subtle)'}`,
                    boxShadow: active ? '0 6px 20px rgba(233,30,99,0.18)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 140ms ease, border-color 140ms ease',
                  }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{
                      background: active ? 'rgba(233,30,99,0.2)' : 'var(--bg-pressed)',
                      color: active ? '#E91E63' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={16} strokeWidth={2.4} />
                  </span>
                  <span className="text-[13px] font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {opt.name}
                  </span>
                  <span className="text-[10.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                    {BLURB[opt.id] ?? 'Configúralo a tu manera'}
                  </span>

                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ background: '#E91E63', color: '#fff' }}
                      >
                        <Check size={12} strokeWidth={3.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA fijo */}
      <div
        className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}
      >
        <button
          type="button"
          disabled={!value}
          onClick={() => { PlatformBridge.hapticFeedback('medium'); onContinue(); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[15px] font-black text-white active:scale-[0.99] transition-transform disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#FF2E93,#E11D74)', border: 'none', cursor: value ? 'pointer' : 'not-allowed' }}
        >
          {value ? `${submitLabel}` : 'Elige tu tipo de negocio'}
          {value && <ChevronRight size={17} />}
        </button>
        {touched && selected && (
          <p className="m-0 mt-2 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Elegiste <strong style={{ color: 'var(--text-secondary)' }}>{selected.name}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
