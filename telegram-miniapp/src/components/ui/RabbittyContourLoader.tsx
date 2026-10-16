'use client';

import { motion } from 'framer-motion';

interface RabbittyContourLoaderProps {
  size?: number;
  label?: string;
}

export default function RabbittyContourLoader({
  size = 56,
  label = 'Actualizando...',
}: RabbittyContourLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-3 select-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Glow de fondo tenue */}
        <div
          className="absolute inset-0 rounded-full blur-xl"
          style={{ background: 'rgba(233, 30, 99, 0.25)' }}
        />

        {/* Silueta Fija Base del Conejo */}
        <img
          src="/logo_conejo.png"
          alt="Rabbitty"
          className="w-full h-full object-contain opacity-25 filter grayscale invert"
          style={{ transform: 'scale(0.85)' }}
        />

        {/* Anillo de Contorno Rápido (Estilo Facebook pull-to-refresh) */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          fill="none"
        >
          {/* Círculo base muy tenue */}
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
          />

          {/* Haz de Neón Magenta de alta velocidad */}
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            stroke="#E91E63"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="60 220"
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              duration: 0.75,
              ease: 'linear',
            }}
            style={{
              transformOrigin: '50px 50px',
              filter: 'drop-shadow(0 0 6px #E91E63)',
            }}
          />
        </svg>
      </div>

      {label && (
        <span
          className="text-[11px] font-black tracking-wider uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
