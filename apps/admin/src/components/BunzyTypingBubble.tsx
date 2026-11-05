'use client';

/**
 * Burbuja de Bunzy con efecto typing para el onboarding web.
 * Es la versión inline del `BunzyOnboarding` móvil: mismo avatar, mismo ritmo,
 * pero dentro del flujo (no fija en pantalla) para no tapar el CTA.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function BunzyTypingBubble({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    let index = 0;
    // Reset al cambiar de mensaje; el texto se escribe en un intervalo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown('');
    const timer = setInterval(() => {
      index += 1;
      setShown(message.slice(0, index));
      if (index >= message.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [message]);

  return (
    <motion.div
      key={message}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex items-start gap-2.5 rounded-2xl border border-pink-500/25 bg-pink-500/[0.07] px-3 py-2.5 ${className}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-pink-500/40 bg-pink-500/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bunzy-avatar.png" alt="Bunzy" className="h-8 w-8 object-contain" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em] text-pink-300">
          <Sparkles className="h-2.5 w-2.5" /> Bunzy
        </p>
        <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-white/75">
          {shown}
          {shown.length < message.length && (
            <span className="ml-0.5 inline-block animate-pulse text-pink-400">▍</span>
          )}
        </p>
      </div>
    </motion.div>
  );
}
