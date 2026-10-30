'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

/**
 * Nudge de ubicación: explica PARA QUÉ (ofertas de proximidad en negocios
 * guardados) y respeta "no volver a mostrar". Máx 1 vez cada 7 días si
 * pospone. Solo nativo (Telegram WebApp no expone geolocalización).
 */
const SUPPRESS_KEY = 'rabbitty_location_nudge_suppressed';
const LAST_SHOWN_KEY = 'rabbitty_location_nudge_last';

export default function LocationNudge() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!PlatformBridge.isNative()) return;
    let cancelled = false;
    (async () => {
      try {
        try {
          if (localStorage.getItem(SUPPRESS_KEY) === '1') return;
          const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
          if (Date.now() - last < 7 * 86400_000) return;
        } catch { /* noop */ }
        const { Geolocation } = await import('@capacitor/geolocation');
        const status = await Geolocation.checkPermissions();
        if (cancelled) return;
        if (status.location === 'granted') return; // ya concedido
        if (status.location === 'denied') return;  // denegado en sistema — respetar
        localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
        setVisible(true);
      } catch { /* sin capacitor/geolocation */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const enable = async () => {
    PlatformBridge.hapticFeedback('medium');
    setBusy(true);
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.requestPermissions();
    } catch { /* noop */ }
    setVisible(false);
    setBusy(false);
  };

  const dismissLater = () => {
    PlatformBridge.hapticFeedback('light');
    setVisible(false);
  };

  const suppressForever = () => {
    PlatformBridge.hapticFeedback('light');
    try { localStorage.setItem(SUPPRESS_KEY, '1'); } catch {}
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed inset-x-3.5 bottom-24 z-[90] overflow-hidden rounded-[26px] p-4"
          style={{
            background: 'linear-gradient(165deg, rgba(26, 24, 34, 0.96) 0%, rgba(14, 13, 20, 0.98) 100%)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255, 255, 255, 0.11)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(233, 30, 99, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* Ambient radial glow */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              left: -20,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(233,30,99,0.28) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Botón cerrar / No volver a mostrar */}
          <button
            type="button"
            onClick={suppressForever}
            aria-label="No volver a mostrar"
            title="No volver a mostrar"
            className="active:scale-90 transition-transform"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} strokeWidth={2.4} />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            {/* Radar Icon Capsule */}
            <div
              className="relative shrink-0 flex items-center justify-center"
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(255, 46, 147, 0.22) 0%, rgba(233, 30, 99, 0.08) 100%)',
                border: '1px solid rgba(233, 30, 99, 0.4)',
                boxShadow: '0 6px 18px rgba(233, 30, 99, 0.22)',
              }}
            >
              <MapPin size={22} color="#FF2E93" strokeWidth={2.3} />
              <span
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#E91E63',
                  border: '2px solid #121118',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={8} color="#FFFFFF" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#FF4D9E',
                  }}
                >
                  Radar Bunz&apos;in
                </span>
              </div>
              <p
                style={{
                  margin: '1px 0 0',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: '-0.2px',
                  lineHeight: 1.25,
                }}
              >
                Descubre ofertas cerca de ti
              </p>
              <p
                style={{
                  margin: '5px 0 0',
                  color: 'rgba(255, 255, 255, 0.68)',
                  fontSize: 12.5,
                  lineHeight: 1.42,
                }}
              >
                Te avisamos cuando pases junto a tus lugares favoritos con{' '}
                <strong style={{ color: '#FFFFFF', fontWeight: 700 }}>recompensas y % de Bunz exclusivos</strong>.
              </p>

              {/* Privacy pill */}
              <div
                className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <ShieldCheck size={12} color="#34D399" />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                  Privado · Nunca rastrea en segundo plano
                </span>
              </div>
            </div>
          </div>

          {/* Native Action Buttons */}
          <div className="flex items-center gap-2.5 mt-3.5">
            <button
              type="button"
              onClick={dismissLater}
              className="active:scale-96 transition-transform"
              style={{
                padding: '11px 16px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                color: 'rgba(255, 255, 255, 0.78)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="flex-1 active:scale-96 transition-transform"
              style={{
                padding: '11px 18px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #FF2E93 0%, #E11D74 100%)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                boxShadow: '0 6px 20px rgba(233, 30, 99, 0.4)',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 800,
                letterSpacing: '-0.1px',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy ? 'Activando…' : 'Activar ubicación'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
