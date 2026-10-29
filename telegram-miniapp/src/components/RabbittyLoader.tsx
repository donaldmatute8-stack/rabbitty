'use client';

/**
 * ── RabbittyLoader ── Verificación animada con identidad Rabbitty.
 * Con codeData: el hero es el RabbittyCode DECODIFICÁNDOSE (barras ondulando,
 * anillos girando — caja fuerte abriéndose). Sin codeData: bunny + anillos.
 */

import { motion } from 'framer-motion';
import RabbittyCode from '@/components/ui/RabbittyCode';

interface RabbittyLoaderProps {
  message?: string;
  compact?: boolean;
  codeData?: string; // si se pasa: hero = RabbittyCode decodificándose
}

const RINGS = [
  { r: 42, color: '#F43F5E', delay: 0 },
  { r: 58, color: '#8B5CF6', delay: 0.15 },
  { r: 74, color: '#F43F5E', delay: 0.3 },
];

export default function RabbittyLoader({ message = 'Verificando…', compact = false, codeData }: RabbittyLoaderProps) {
  const hero = codeData ? (
    <motion.div
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
    >
      <RabbittyCode data={codeData} size={150} showCardFrame={false} state="decoding" />
    </motion.div>
  ) : (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {RINGS.map((ring, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            width: ring.r * 2, height: ring.r * 2,
            borderColor: ring.color,
            borderStyle: 'dashed',
          }}
          animate={{ scale: [0.75, 1.1, 0.75], rotate: i % 2 === 0 ? [0, 90] : [90, 0], opacity: [0.6, 0.85, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.6, delay: ring.delay, ease: 'easeInOut' }}
        />
      ))}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        className="relative z-10 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#19092B] to-[#07020D] border-2 border-pink-500/50 flex items-center justify-center shadow-[0_0_35px_rgba(244,63,94,0.5)] overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Rabbitty_vector.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#F43F5E]" />
      </motion.div>
    </div>
  );

  const inner = (
    <div className="flex flex-col items-center gap-3">
      {hero}
      {/* Onda de barras (mini RabbittyCode) */}
      <div className="flex items-center justify-center gap-[3px] h-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300"
            animate={{ height: [6, 14, 6] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.09, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <motion.p
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-[11px] font-black text-white uppercase tracking-[2px]"
      >
        {message}
      </motion.p>
    </div>
  );

  if (compact) return inner;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      {inner}
    </motion.div>
  );
}
