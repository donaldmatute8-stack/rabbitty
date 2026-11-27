'use client';

/**
 * ── PosOrderAlert ── aviso fullscreen + sonido para pedidos nuevos de la app.
 *
 * En una caja con ruido la campanita se pierde. Cuando entra un pedido desde el
 * móvil esta capa TOMA la pantalla completa (sin tarjeta, sin fondo translúcido)
 * para que sea imposible no verla, suena hasta que alguien la atiende y lleva
 * directo a "Desde la app".
 *
 * Regla de operación: si el POS está en medio de otra operación (cobro, corte,
 * comanda abierta) el botón **Revisar** manda el pedido a la cola en vez de
 * interrumpir: el pedido nunca se pierde y queda el punto persistente.
 *
 * Solo se usa para PEDIDOS/ÓRDENES (no para comandas internas ni cobros).
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Volume2, ArrowRight, X, Ban, ListOrdered, Clock } from 'lucide-react';

export interface PosAlertOrder {
  orderId: string;
  label: string;
  total: number;
  minutesAgo: number;
}

interface Props {
  open: boolean;
  count: number;
  /** Ajuste del negocio: si está apagado, la alerta sale muda. */
  soundEnabled?: boolean;
  /** El POS está ocupado (cobro, corte, otra comanda): Revisar manda a cola. */
  busy?: boolean;
  /** Detalle corto de los pedidos pendientes, para que se sepa qué llegó. */
  orders?: PosAlertOrder[];
  onOpen: () => void;
  onDismiss: () => void;
  /**
   * Rechazo directo desde la alerta (solo cuando hay UN pedido). Sin esto, un
   * pedido que el local no puede cumplir dejaba la alerta sonando para siempre.
   */
  onReject?: () => void;
}

export function PosOrderAlert({
  open,
  count,
  soundEnabled = true,
  busy = false,
  orders = [],
  onOpen,
  onDismiss,
  onReject,
}: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chrome/Safari no dejan sonar audio sin un gesto previo. En una caja el
  // cajero ya tocó la pantalla, pero el AudioContext puede nacer suspendido:
  // lo desbloqueamos al primer toque y lo reutilizamos.
  useEffect(() => {
    const unlock = () => {
      try {
        if (!ctxRef.current) {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) ctxRef.current = new Ctor();
        }
        if (ctxRef.current?.state === 'suspended') void ctxRef.current.resume();
      } catch {
        /* sin audio disponible */
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const closeCtx = () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };

    if (!open) {
      clearTimers();
      closeCtx();
      return;
    }
    if (!soundEnabled) {
      closeCtx();
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
        [880, 1180].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = ctx.currentTime + i * 0.14;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.32, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.14);
        });
      } catch {
        /* audio bloqueado: la alerta visual sigue */
      }
    };

    // Aviso insistente: dos tonos ahora y luego cada 4 s mientras siga abierto.
    beep();
    timersRef.current.push(setTimeout(beep, 900));
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {
      /* sin vibración */
    }
    intervalRef.current = setInterval(() => {
      beep();
      try {
        navigator.vibrate?.([180, 90, 180]);
      } catch {
        /* sin vibración */
      }
    }, 4000);

    return () => {
      clearTimers();
      closeCtx();
    };
  }, [open, soundEnabled]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-label="Pedido nuevo desde la app"
          className="fixed inset-0 z-[120] flex flex-col"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 0%, rgba(233,30,99,0.55) 0%, rgba(120,10,60,0.85) 38%, rgba(9,4,12,0.98) 78%), #09040c',
          }}
        >
          {/* Barra superior: identidad del aviso + silenciar */}
          <div className="flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
            <div className="flex items-center gap-3">
              <motion.span
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="h-3 w-3 rounded-full bg-[#FF2E93] shadow-[0_0_18px_4px_rgba(255,46,147,0.7)]"
              />
              <p className="m-0 text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#FF8FC0]">
                Pedido nuevo · desde la app
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-[#FF2E93] animate-pulse" />
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Silenciar"
                className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-black text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
                Silenciar
              </button>
            </div>
          </div>

          {/* Cuerpo: el número manda */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center sm:px-8">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.15 }}
              className="mb-4 flex h-24 w-24 items-center justify-center rounded-[28px] border-2 border-[#E91E63]/70 bg-[#E91E63]/25 sm:h-28 sm:w-28"
            >
              <Smartphone className="h-12 w-12 text-[#FF2E93] sm:h-14 sm:w-14" strokeWidth={2.4} />
            </motion.div>

            <p className="m-0 text-[86px] font-black leading-[0.85] text-white sm:text-[140px]">{count}</p>
            <p className="m-0 mt-2 text-xl font-black text-white/85 sm:text-2xl">
              {count === 1 ? 'pedido esperando en caja' : 'pedidos esperando en caja'}
            </p>
            <p className="m-0 mt-1 text-sm font-semibold text-white/50">
              {busy
                ? 'El POS está en otra operación. Revisar lo manda a la cola: no se pierde.'
                : 'Pasa a la caja para cobrarlo y que cocina arranque.'}
            </p>

            {orders.length > 0 && (
              <ul className="m-0 mt-5 w-full max-w-xl list-none space-y-1.5 p-0 text-left">
                {orders.slice(0, 3).map((o) => (
                  <li
                    key={o.orderId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <span className="truncate text-sm font-bold text-white/90">{o.label}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-white/45">
                        <Clock className="h-3 w-3" />
                        {o.minutesAgo <= 0 ? 'ahora' : `${o.minutesAgo} min`}
                      </span>
                      <span className="text-sm font-black text-[#FF8FC0]">
                        ${Number(o.total ?? 0).toFixed(2)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Acción: Revisar es la única salida grande */}
          <div className="px-5 pb-6 pt-4 sm:px-8 sm:pb-8">
            <button
              type="button"
              onClick={onOpen}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#E91E63] py-6 text-2xl font-black text-white shadow-2xl shadow-[#E91E63]/40 transition-transform hover:bg-[#FF2E93] active:scale-[0.99]"
            >
              {busy ? <ListOrdered className="h-7 w-7" /> : null}
              {busy ? 'Revisar · mandar a la cola' : 'Revisar'}
              <ArrowRight className="h-7 w-7" />
            </button>

            {count === 1 && onReject && (
              <button
                type="button"
                onClick={onReject}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-black text-white/80 transition-transform hover:bg-white/10 active:scale-[0.99]"
              >
                <Ban className="h-4 w-4" />
                No podemos aceptarlo · rechazar con motivo
              </button>
            )}

            <p className="m-0 mt-3 text-center text-[11px] text-white/40">
              El sonido se detiene al revisar o silenciar. La alerta no se repite por el mismo
              pedido en este dispositivo; el punto del header sigue avisando mientras haya pedidos.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
