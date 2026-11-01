"use client";

/**
 * ── SwipeConfirm ── Deslizar para confirmar (identidad premium Rabbitty).
 * Patrone reutilizable: pregunta sí/no (derecha=sí, izquierda=no) y
 * confirmación de acciones grandes (pagar, activar, enviar).
 * Física: resistance elástica, glow progresivo con el jalón, haptics por
 * escalón, soltar al cruzar el umbral dispara la acción con animación de éxito.
 */

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";

interface SwipeConfirmProps {
  /** Texto del track (p. ej. "Desliza para pagar") */
  label: string;
  /** Icono/emoji del knob */
  knob?: string;
  /** Modo dual: derecha=Sí, izquierda=No (solo para preguntas) */
  dual?: boolean;
  /** Etiquetas verticales del modo dual */
  yesLabel?: string;
  noLabel?: string;
  /** Se dispara al cruzar umbral a la derecha (o "Sí") */
  onSuccess?: () => void;
  /** Solo dual: se dispara al cruzar umbral a la izquierda ("No") */
  onNo?: () => void;
  disabled?: boolean;
  /** Umbral de disparo en px (default 110) */
  threshold?: number;
  /** Color base del glow mientras se jala ("#E91E63") */
  accentColor?: string;
}

export default function SwipeConfirm({
  label,
  knob = "→",
  dual = false,
  yesLabel = "Sí",
  noLabel = "No",
  onSuccess,
  onNo,
  disabled = false,
  threshold = 110,
  accentColor = "#E91E63",
}: SwipeConfirmProps) {
  const maxX = 130;
  const x = useMotionValue(0);
  const [fired, setFired] = useState<"yes" | "no" | null>(null);

  // Progreso 0→1 hacia derecha (e -1→0 izquierda en dual)
  const progress = useTransform(x, [-maxX, 0, maxX], dual ? [-1, 0, 1] : [0, 0, 1]);
  const glowRight = useTransform(progress, (p) => Math.max(0, p));
  const glowLeft = useTransform(progress, (p) => Math.max(0, -p));

  const bgRight = useTransform(glowRight, [0, 1], ["rgba(255,255,255,0.05)", `${accentColor}66`]);
  const borderColorRight = useTransform(glowRight, [0, 0.6, 1], ["rgba(255,255,255,0.12)", `${accentColor}99`, accentColor]);
  const scaleKnob = useTransform(progress, (p) => 1 + Math.abs(p) * 0.12);
  // Opacidades SIEMPRE en el tope (reglas de hooks): su consumo JSX puede ser condicional
  const rightLabelOpacity = useTransform(glowRight, [0, 0.7], [0.5, 1]);
  const leftLabelOpacity = useTransform(glowLeft, [0, 0.7], [0.5, 1]);
  const centerOpacityDual = useTransform(progress, (p) => (Math.abs(p) < 0.55 ? 1 : 0));
  const centerFadeSingle = useTransform(progress, [0, 0.55, 0.9], [1, 0.45, 0]);

  const lastHaptic = useRef(0);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offsetRight = info.offset.x;
    if (!disabled && offsetRight > threshold) {
      setFired("yes");
      setTimeout(() => { setFired(null); x.set(0); }, 320);
      onSuccess?.();
    } else if (dual && !disabled && offsetRight < -threshold) {
      setFired("no");
      setTimeout(() => { setFired(null); x.set(0); }, 320);
      onNo?.();
    } else {
      // Rebote elástico premium: spring de regreso
      x.set(0);
    }
  };

  return (
    <div className="relative select-none">
      {/* Etiquetas laterales (dual) */}
      {dual && (
        <>
          <motion.span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wider text-white/40"
            style={{ opacity: leftLabelOpacity as never }}
          >✋ {noLabel}</motion.span>
          <motion.span
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wider"
            style={{ color: accentColor, opacity: rightLabelOpacity as never }}
          >{yesLabel} 💸</motion.span>
        </>
      )}

      {/* Track */}
      <motion.div
        className="h-16 rounded-3xl border relative overflow-hidden"
        style={{
          background: dual ? "rgba(255,255,255,0.05)" : (bgRight as never),
          borderColor: dual ? "rgba(255,255,255,0.12)" : (borderColorRight as never),
        }}
        animate={{
          background: dual
            ? (fired === "yes" ? accentColor : fired === "no" ? "#787894" : undefined)
            : undefined,
          borderColor: fired === "yes" ? accentColor : undefined,
          scale: fired ? 1.02 : 1,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        initial={false}
      >
        {/* Glow interior: derecha (accent) + izquierda (gris, modo dual) */}
        <motion.div
          className="absolute inset-0"
          style={{ opacity: glowRight as never, background: `linear-gradient(90deg, transparent, ${accentColor}55)` }}
        />
        {dual && (
          <motion.div
            className="absolute inset-0"
            style={{ opacity: glowLeft as never, background: "linear-gradient(270deg, transparent, rgba(150,150,170,0.4))" }}
          />
        )}

        {/* Label central */}
        {!dual && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ opacity: centerFadeSingle as never }}
          >
            <span className="text-sm font-black text-white/80 uppercase tracking-[1.5px]">{label}</span>
          </motion.div>
        )}
        {dual && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none px-16"
            style={{ opacity: centerOpacityDual as never }}
          >
            <span className="text-sm font-black text-white/90 uppercase tracking-[1.5px] text-center">{label}</span>
          </motion.div>
        )}

        {/* Knob arrastrable */}
        <motion.div
          drag={disabled ? false : "x"}
          dragConstraints={{ left: dual ? -maxX : 0, right: maxX }}
          dragElastic={0.08}
          dragMomentum={false}
          onDragStart={() => {
            if (Date.now() - lastHaptic.current > 400) {
              lastHaptic.current = Date.now();
            }
          }}
          onDragEnd={handleDragEnd}
          style={{ x, scale: scaleKnob, left: dual ? "50%" : "6px", marginLeft: dual ? "-29px" : 0 }}
          className={`absolute top-1/2 -translate-y-1/2 w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-xl font-black shadow-lg cursor-grab active:cursor-grabbing ${fired === "yes" ? "bg-emerald-500" : fired === "no" ? "bg-gray-500" : ""}`}
          animate={{
            backgroundColor: fired === "yes" ? "#10B981" : fired === "no" ? "#787894" : accentColor,
          }}
          initial={false}
          whileTap={{ scale: 1.08 }}
        >
          {fired === "yes" ? "✓" : fired === "no" ? "✕" : knob}
        </motion.div>
      </motion.div>

      {disabled && <div className="absolute inset-0 rounded-3xl bg-black/40 cursor-not-allowed" />}
    </div>
  );
}