'use client';

/**
 * ── PullToRefresh ── "Deslizar hacia abajo para actualizar" con loader propio:
 * conejo 🐰 + barras onduladas (misma identidad que RabbittyLoader).
 * Detecta el contenedor scrollable real (o window) y solo se dispara desde el
 * tope del scroll. No bloquea el scroll (listeners pasivos).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

const THRESHOLD = 64; // px de jalón que activa el refresh
const MAX_PULL = 110;

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Deshabilitar temporalmente (p. ej. pestañas sin lista) */
  enabled?: boolean;
}

export default function PullToRefresh({ onRefresh, children, enabled = true }: PullToRefreshProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !enabled) return;

    // Altura tope del scroll: ancestro scrollable real, si no window
    const scrollTopOf = (): number => {
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        const s = window.getComputedStyle(node);
        const oy = (s as unknown as { overflowY?: string }).overflowY;
        if (oy && /(auto|scroll|overlay)/.test(oy) && node.scrollHeight > node.clientHeight) {
          return node.scrollTop;
        }
        node = node.parentElement;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1) return;
      if (scrollTopOf() <= 2) {
        startY.current = e.touches[0].clientY;
        active.current = true;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null || busy.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPullPx(0); return; }
      // Resistencia suave: mientras más se jala, más cuesta
      const resisted = Math.min(MAX_PULL, dy / (1 + dy / 300));
      // El scroll natural del navegador puede "fugar" el pull: si el usuario
      // soltó el scroll (scrollTop subió de nuevo), desarmar.
      if (scrollTopOf() > 2) { active.current = false; setPullPx(0); return; }
      setPullPx(resisted);
    };
    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      setPullPx((p) => {
        if (p >= THRESHOLD && !busy.current) {
          busy.current = true;
          setRefreshing(true);
          setPullPx(0);
          (async () => {
            try { await onRefresh(); } finally {
              // mínimo visible ~400ms para que el loader se perciba
              setTimeout(() => { busy.current = false; setRefreshing(false); }, 400);
            }
          })();
        }
        return 0;
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, onRefresh]);

  const show = refreshing || pullPx > 4;
  const progress = refreshing ? 1 : Math.min(1, pullPx / THRESHOLD);

  return (
    <div ref={wrapRef}>
      {/* Indicador superior — loader Rabbitty (mini) */}
      <div
        style={{
          height: show ? (refreshing ? 64 : Math.max(0, pullPx * 0.6)) : 0,
          opacity: show ? 1 : 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: refreshing ? 'height 180ms ease' : 'height 60ms linear, opacity 120ms ease',
        }}
        aria-hidden={!show}
      >
        <motion.div
          style={{ scale: 0.9 + progress * 0.1 }}
          className="flex items-center gap-2.5"
        >
          <motion.span
            animate={{ rotate: refreshing ? [0, -12, 12, 0] : pullPx > 10 ? [0, -8, 8, 0] : 0 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            className="text-lg"
          >
            🐰
          </motion.span>
          {/* Barras onduladas — mini RabbittyCode */}
          <div className="flex items-center gap-[3px] h-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300"
                animate={{ height: [6, 14, 6] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.09, ease: 'easeInOut' }}
              />
            ))}
          </div>
          <span className="text-[10px] font-black text-white/70 uppercase tracking-[1.5px]">
            {refreshing ? 'Actualizando…' : 'Suelta para actualizar'}
          </span>
        </motion.div>
      </div>
      {children}
    </div>
  );
}