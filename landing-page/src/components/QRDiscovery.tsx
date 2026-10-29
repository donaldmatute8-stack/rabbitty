'use client';

/**
 * ── QRDiscovery ── Fuente única de presentación de QR funcional con identidad.
 * - El QR se genera desde el PRIMER render (la animación nunca bloquea payload)
 * - Coreografía: neón (identidad) 0–700ms → revelación del QR con logo central
 * - revealMode="discovery": coreografía 1a vez por surfaceKey; luego QR inmediato
 * - Respeta prefers-reduced-motion · Estado de recuperación si el payload falla
 * - PURE presentational: la pantalla dueña gestiona sesión/auth/operación.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { NeonQRCode } from '@/components/SimpleQRCode';

export type QRDiscoveryVariant = 'admin' | 'affiliate' | 'rabbitter';

interface QRDiscoveryProps {
  value: string;
  variant: QRDiscoveryVariant;
  size?: number;
  revealMode?: 'discovery' | 'immediate';
  surfaceKey?: string;
  logoSrc?: string;
  className?: string;
}

const LOGOS: Record<QRDiscoveryVariant, string> = {
  admin: '/icon_ra.png',
  affiliate: '/icon_ra.png',
  rabbitter: '/Rabbitty_vector.png',
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function QRDiscovery({
  value,
  variant,
  size = 230,
  revealMode = 'discovery',
  surfaceKey,
  logoSrc,
  className = '',
}: QRDiscoveryProps) {
  const LOGO = logoSrc || LOGOS[variant] || '/icon_ra.png';
  const storageKey = surfaceKey ? `rabbitty_qrdiscovery_${surfaceKey}` : null;
  const [showingNeon, setShowingNeon] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let skip = revealMode !== 'discovery';
    if (!skip && storageKey) {
      try {
        if (localStorage.getItem(storageKey) === 'seen') skip = true;
      } catch {}
    }
    if (!skip && prefersReducedMotion()) skip = true;
    if (skip) {
      setRevealed(true);
      return;
    }
    setShowingNeon(true);
    const t = setTimeout(() => {
      setShowingNeon(false);
      setRevealed(true);
      if (storageKey) {
        try { localStorage.setItem(storageKey, 'seen'); } catch {}
      }
    }, 700);
    return () => clearTimeout(t);
  }, [revealMode, storageKey, value]);

  const invalid = !value || !value.trim();
  const qrSize = Math.max(120, Math.round(size * 0.82));

  return (
    <div className={`relative flex flex-col items-center ${className}`} style={{ width: size }}>
      <AnimatePresence mode="wait">
        {showingNeon ? (
          <motion.div
            key="neon"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <NeonQRCode value={value} size={size} />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="mt-2 text-[10px] font-mono text-[#E91E63] uppercase tracking-widest"
            >
              Rabbitty Code…
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="qr"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center"
          >
            {invalid ? (
              <div
                className="flex items-center justify-center rounded-2xl bg-black/5 text-center px-4"
                style={{ width: qrSize, height: qrSize }}
              >
                <span className="text-xs text-neutral-500 font-bold">Código no disponible.<br />Actualiza la pantalla.</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                <QRCodeSVG
                  value={value}
                  size={qrSize}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: LOGO,
                    x: undefined,
                    y: undefined,
                    height: Math.round(qrSize * 0.2),
                    width: Math.round(qrSize * 0.2),
                    excavate: true,
                  }}
                />
              </div>
            )}
            {revealMode === 'discovery' && revealed && storageKey && (
              <button
                type="button"
                onClick={() => { setShowingNeon(true); setRevealed(false); }}
                className="mt-2 text-[10px] font-bold text-[#E91E63]/70 hover:text-[#E91E63] cursor-pointer"
              >
                ⟲ ver Rabbitty Code
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
