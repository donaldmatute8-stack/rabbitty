'use client';

/**
 * Loader inline de Rabbitty: conejo girando + barras de audio con el degradado
 * de la marca. Es el mismo que se asoma al jalar para refrescar el inicio.
 *
 * Vive aquí para que el mapa (y cualquier otra pantalla) use exactamente el
 * mismo indicador y no haya tres loaders distintos en la app.
 */

import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  /** Alto del conejo en px (las barras escalan con él). */
  size?: number;
  className?: string;
  label?: string;
}

export default function BunnyInlineLoader({ size = 20, className, label }: Props) {
  const { isDark } = useTheme();
  const barHeight = Math.round(size * 0.7);

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      <div className="flex items-center gap-2.5">
        <motion.img
          src={isDark ? '/logo_conejo.png' : '/logo_conejo_blk.png'}
          alt=""
          animate={{ rotate: [0, -12, 12, 0] }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
          style={{ width: size, height: size }}
          className="object-contain drop-shadow-[0_0_8px_rgba(233,30,99,0.45)]"
        />
        <div className="flex items-center gap-[3px]" style={{ height: barHeight }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300"
              animate={{ height: [barHeight * 0.4, barHeight, barHeight * 0.4] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.09, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
      {label && (
        <span
          className="text-[10px] font-black uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
