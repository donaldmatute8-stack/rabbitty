'use client';

import { useEffect, useState } from 'react';
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

  if (!visible) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.requestPermissions();
    } catch { /* noop */ }
    setVisible(false);
    setBusy(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-24 z-[90] rounded-2xl p-4 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(20,10,30,0.95)', border: '1px solid rgba(233,30,99,0.35)', boxShadow: '0 10px 40px rgba(233,30,99,0.25)' }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">📍</span>
        <div className="flex-1">
          <p className="text-white font-bold text-sm">Ofertas cerca de ti</p>
          <p className="text-white/60 text-xs mt-1 leading-relaxed">
            Activa la ubicación y te avisamos cuando estés cerca de un negocio que guardaste con
            <b className="text-white"> ofertas y % de Bunz especiales</b>. Solo se usa para proximidad — nunca en segundo plano.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={enable}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-xs font-black text-white active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)' }}
            >
              {busy ? 'Abriendo…' : 'Activar ubicación'}
            </button>
            <button
              onClick={() => setVisible(false)}
              className="px-3 py-2.5 rounded-xl text-xs font-bold text-white/60"
            >
              Ahora no
            </button>
            <button
              onClick={() => { try { localStorage.setItem(SUPPRESS_KEY, '1'); } catch {} setVisible(false); }}
              className="px-3 py-2.5 rounded-xl text-[10px] font-bold text-white/35"
            >
              No más
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
