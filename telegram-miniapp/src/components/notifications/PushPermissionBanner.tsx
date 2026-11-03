'use client';

/**
 * ── PushPermissionBanner ── recordatorio PERSISTENTE para activar notificaciones.
 *
 * El prompt bonito (SmartNotificationPrompt) se muestra una vez y, si se
 * descarta, no vuelve. Resultado: usuarios con permiso pendiente que nunca
 * reciben pushes. Este banner vive mientras el permiso NO esté concedido y
 * desaparece solo cuando se concede (re-chequea al volver a la app).
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, ChevronRight, Check } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

type State = 'unknown' | 'prompt' | 'denied' | 'granted';

export function PushPermissionBanner() {
  const [state, setState] = useState<State>('unknown');
  const [busy, setBusy] = useState(false);
  const [justGranted, setJustGranted] = useState(false);

  const check = useCallback(async () => {
    try {
      if (PlatformBridge.isNative()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const s = await PushNotifications.checkPermissions();
        setState(
          s.receive === 'granted' ? 'granted'
          : s.receive === 'denied' ? 'denied'
          : 'prompt',
        );
        return;
      }
      if (typeof Notification !== 'undefined') {
        setState(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt');
        return;
      }
      setState('unknown');
    } catch {
      setState('unknown');
    }
  }, []);

  useEffect(() => {
    void check();
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    PlatformBridge.hapticFeedback('medium');
    try {
      if (PlatformBridge.isNative()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        let s = await PushNotifications.checkPermissions();
        if (s.receive === 'prompt') s = await PushNotifications.requestPermissions();
        if (s.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          setJustGranted(true);
          setTimeout(() => setState('granted'), 900);
        } else {
          setState('denied');
        }
      } else if (typeof Notification !== 'undefined') {
        const p = await Notification.requestPermission();
        if (p === 'granted') { setJustGranted(true); setTimeout(() => setState('granted'), 900); }
        else setState('denied');
      }
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  if (state === 'granted' || state === 'unknown') return null;

  const denied = state === 'denied';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="px-1 mb-3"
      >
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
          style={{
            background: justGranted
              ? 'rgba(16,185,129,0.14)'
              : 'linear-gradient(135deg, rgba(233,30,99,0.14), rgba(20,10,20,0.55))',
            border: `1px solid ${justGranted ? 'rgba(16,185,129,0.45)' : 'rgba(233,30,99,0.35)'}`,
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: justGranted ? 'rgba(16,185,129,0.2)' : 'rgba(233,30,99,0.18)',
              color: justGranted ? '#34D399' : '#FF2E93',
            }}
          >
            {justGranted ? <Check size={17} strokeWidth={3} /> : <BellRing size={17} strokeWidth={2.5} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black text-white m-0 leading-tight">
              {justGranted ? '¡Notificaciones activadas!' : 'Activa las notificaciones'}
            </p>
            <p className="text-[10.5px] text-white/55 m-0 leading-tight mt-0.5">
              {justGranted
                ? 'Te avisaremos de tu pedido aunque tengas el teléfono bloqueado.'
                : denied
                  ? 'Están bloqueadas: Ajustes → Rabbitty → Notificaciones.'
                  : 'Sin ellas no te enteras cuando tu pedido está listo.'}
            </p>
          </div>

          {!justGranted && !denied && (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={busy}
              className="shrink-0 flex items-center gap-0.5 px-3 py-1.5 rounded-full text-[11px] font-black text-white cursor-pointer active:scale-95 transition-transform disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#FF2E93,#E91E63)' }}
            >
              {busy ? '…' : 'Activar'}
              {!busy && <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
