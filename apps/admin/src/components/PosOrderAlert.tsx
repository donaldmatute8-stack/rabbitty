'use client';

/**
 * ── PosOrderAlert ── aviso GIGANTE + sonido para pedidos nuevos de la app.
 *
 * En una caja con ruido, la campanita se pierde. Cuando entra un pedido nuevo
 * desde el móvil, esta capa ocupa la pantalla con tipografía enorme, suena
 * hasta que alguien la atiende y lleva directo a "Desde la app".
 *
 * Solo se usa para PEDIDOS/ÓRDENES (no para comandas internas ni cobros).
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Volume2, ArrowRight, X } from 'lucide-react';

interface Props {
  open: boolean;
  count: number;
  onOpen: () => void;
  onDismiss: () => void;
}

export function PosOrderAlert({ open, count, onOpen, onDismiss }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      return;
    }

    const beep = () => {
      try {
        if (!ctxRef.current) {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) return;
          ctxRef.current = new Ctor();
        }
        const ctx = ctxRef.current!;
        if (ctx.state === 'suspended') void ctx.resume();
        // Doble tono ascendente tipo "nuevo pedido"
        [880, 1180].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = ctx.currentTime + i * 0.15;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.15);
        });
      } catch {
        /* audio bloqueado: la alerta visual sigue */
      }
    };

    beep();
    timerRef.current = setInterval(beep, 1600);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(5,2,8,0.88)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            className="w-full max-w-3xl rounded-[32px] p-8 sm:p-12 text-center relative"
            style={{
              background: 'linear-gradient(160deg, rgba(233,30,99,0.28), rgba(10,5,12,0.96))',
              border: '2px solid rgba(233,30,99,0.65)',
              boxShadow: '0 0 120px rgba(233,30,99,0.45)',
            }}
          >
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Silenciar"
              className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-center gap-4 mb-6">
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
                className="w-20 h-20 rounded-3xl flex items-center justify-center bg-[#E91E63]/25 border-2 border-[#E91E63]/60"
              >
                <Smartphone className="h-10 w-10 text-[#FF2E93]" strokeWidth={2.4} />
              </motion.div>
              <Volume2 className="h-8 w-8 text-[#FF2E93] animate-pulse" />
            </div>

            <p className="text-[15px] font-black text-[#FF2E93] uppercase tracking-[0.25em] m-0">
              Pedido nuevo desde la app
            </p>
            <p className="text-6xl sm:text-7xl font-black text-white m-0 mt-3 leading-none">
              {count}
            </p>
            <p className="text-lg font-bold text-white/70 m-0 mt-2">
              {count === 1 ? 'pedido esperando en caja' : 'pedidos esperando en caja'}
            </p>

            <button
              type="button"
              onClick={onOpen}
              className="mt-9 w-full flex items-center justify-center gap-3 py-6 rounded-2xl bg-[#E91E63] hover:bg-[#FF2E93] text-white text-2xl font-black cursor-pointer active:scale-[0.99] transition-transform shadow-2xl shadow-[#E91E63]/40"
            >
              Ver pedido
              <ArrowRight className="h-7 w-7" />
            </button>

            <p className="text-[13px] text-white/45 m-0 mt-4">
              El sonido se detiene al abrir o silenciar.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
