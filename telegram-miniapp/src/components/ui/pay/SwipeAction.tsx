'use client';

/**
 * ── SwipeAction ── Swipe premium SIN flechas ni manos estáticas.
 * - La pista muestra "Desliza" con barrido de brillo (shimmer) permanente.
 * - Instrucción direccional encima: "Swipe a la derecha para Sí / izquierda para No"
 *   (modo dual) o "Swipe a la derecha para Pagar" (modo simple).
 * - Mientras arrastras: el texto central cambia a la ACCIÓN y aparece una flecha
 *   animada (solo en ese momento), con glow hacia el lado del gesto.
 * - Al cruzar el umbral: ✓ flash + haptic + callback.
 */

import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';

interface SwipeActionProps {
  mode?: 'single' | 'dual';
  /** Etiqueta de la acción a la derecha (p. ej. "Sí" / "Pagar") */
  rightLabel?: string;
  /** Solo dual: etiqueta de la acción a la izquierda ("No") */
  leftLabel?: string;
  onRight: () => void;
  onLeft?: () => void;
  disabled?: boolean;
  /** Acento Rabbitty (default rosa) */
  accentColor?: string;
  /** Texto grande de la pista cuando está en reposo */
  idleLabel?: string;
  threshold?: number;
}

export default function SwipeAction({
  mode = 'single',
  rightLabel = 'Sí',
  leftLabel = 'No',
  onRight,
  onLeft,
  disabled = false,
  accentColor = '#E91E63',
  idleLabel = 'Desliza',
  threshold = 110,
}: SwipeActionProps) {
  const dual = mode === 'dual';
  const MAX = 140;
  const x = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const [fired, setFired] = useState<'right' | 'left' | null>(null);
  const lastHaptic = useRef(0);

  // Progreso: -1 (izquierda) … 0 … 1 (derecha)
  const progress = useTransform(x, [-MAX, 0, MAX], dual ? [-1, 0, 1] : [0, 0, 1]);
  const rightGlow = useTransform(progress, (p) => Math.max(0, p));
  const leftGlow = useTransform(progress, (p) => Math.max(0, -p));
  const idleOpacity = useTransform(progress, (p) => (Math.abs(p) > 0.18 || fired ? 0 : 1));
  const rightOpacity = useTransform(progress, (p) => Math.min(1, Math.max(0, p * 2.2)));
  const leftOpacity = useTransform(progress, (p) => Math.min(1, Math.max(0, -p * 2.2)));
  const trackShift = useTransform(progress, [-1, 0, 1], ['0%', '0%', '10%']);

  const fireHaptic = () => {
    if (Date.now() - lastHaptic.current > 250) {
      lastHaptic.current = Date.now();
      PlatformBridge.hapticFeedback('light');
    }
  };

  const handleEnd = (_: unknown, info: PanInfo) => {
    setDragging(false);
    if (disabled) { x.set(0); return; }
    if (info.offset.x > threshold) {
      setFired('right');
      PlatformBridge.hapticFeedback('success');
      setTimeout(() => { setFired(null); x.set(0); }, 380);
      onRight();
    } else if (dual && info.offset.x < -threshold) {
      setFired('left');
      PlatformBridge.hapticFeedback('medium');
      setTimeout(() => { setFired(null); x.set(0); }, 380);
      onLeft?.();
    } else {
      x.set(0);
    }
  };

  return (
    <div className="w-full">
      {/* Instrucción direccional (sin flechas estáticas) */}
      <div className="text-center mb-3 leading-snug">
        <p className="text-[13px] font-bold text-white/85 m-0">
          Swipe a la derecha para <span style={{ color: '#FF4D9D' }}>{rightLabel}</span>
        </p>
        {dual && (
          <p className="text-[13px] font-bold text-white/85 m-0">
            Swipe a la izquierda para <span style={{ color: '#FF4D9D' }}>{leftLabel}</span>
          </p>
        )}
      </div>

      {/* Pista */}
      <motion.div
        style={{ x: trackShift }}
        className="relative h-[68px] rounded-full overflow-hidden border border-white/10 select-none touch-pan-y"
        animate={{
          borderColor: fired === 'right' || fired === 'left' ? accentColor : 'rgba(255,255,255,0.10)',
          boxShadow: fired ? `0 0 32px ${accentColor}66` : '0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        {/* Base gradient (identidad) */}
        <div
          className="absolute inset-0"
          style={{
            background: dual
              ? 'linear-gradient(90deg, #E91E63 0%, #7A1040 42%, #1B1B24 58%, #1B1B24 100%)'
              : `linear-gradient(90deg, ${accentColor} 0%, #7A1040 50%, #1B1B24 100%)`,
          }}
        />
        {/* Shimmer animado (barrido de brillo) */}
        <motion.div
          className="absolute top-0 bottom-0 w-1/3 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)' }}
          animate={{ x: ['-130%', '430%'] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut', repeatDelay: 0.6 }}
        />
        {/* Glow por dirección */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: rightGlow as never, background: `linear-gradient(90deg, transparent, ${accentColor}55)` }}
        />
        {dual && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: leftGlow as never, background: 'linear-gradient(270deg, transparent, rgba(255,255,255,0.18))' }}
          />
        )}

        {/* Texto central: reposo "Desliza" / arrastre = acción con flecha animada */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.span style={{ opacity: idleOpacity as never }} className="text-[26px] font-black tracking-tight text-white/75">
            {idleLabel}
          </motion.span>

          <motion.span
            style={{ opacity: rightOpacity as never }}
            className="absolute flex items-center gap-1.5 text-[24px] font-black"
          >
            {rightLabel}
            <motion.span
              animate={{ x: dragging ? [0, 10, 0] : 0, opacity: dragging ? 1 : 0.9 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
              className="text-[22px]"
            >→</motion.span>
          </motion.span>

          {dual && (
            <motion.span
              style={{ opacity: leftOpacity as never }}
              className="absolute flex items-center gap-1.5 text-[24px] font-black"
            >
              <motion.span
                animate={{ x: dragging ? [0, -10, 0] : 0, opacity: dragging ? 1 : 0.9 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
                className="text-[22px]"
              >←</motion.span>
              {leftLabel}
            </motion.span>
          )}
        </div>

        {/* Superficie de arrastre (toda la pista, sin knob visible) */}
        <motion.div
          drag={disabled ? false : 'x'}
          dragConstraints={{ left: dual ? -MAX : 0, right: MAX }}
          dragElastic={0.06}
          dragMomentum={false}
          style={{ x }}
          onDragStart={() => { setDragging(true); fireHaptic(); }}
          onDragEnd={handleEnd}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-label={`Swipe a la derecha para ${rightLabel}`}
          role="button"
        />

        {/* Confirmación */}
        {fired && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span className="text-[26px] font-black text-white drop-shadow">✓</span>
          </motion.div>
        )}

        {disabled && <div className="absolute inset-0 bg-black/40" />}
      </motion.div>
    </div>
  );
}