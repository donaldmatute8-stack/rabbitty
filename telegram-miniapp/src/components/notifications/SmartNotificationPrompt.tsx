'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { SmartPromptOrchestrator } from '@/lib/smartPromptOrchestrator';

export function SmartNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    // Solo aplica para plataformas nativas o navegadores compatibles
    if (typeof window === 'undefined') return;

    if (SmartPromptOrchestrator.isCompleted('notifications')) {
      return;
    }

    let timer: NodeJS.Timeout | null = null;

    const checkEligibility = async () => {
      // 1. Revisar permisos en Capacitor si es nativo
      if (PlatformBridge.isNative()) {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const status = await PushNotifications.checkPermissions();
          if (status.receive === 'granted') {
            SmartPromptOrchestrator.markCompleted('notifications');
            return;
          }
        } catch {}
      } else if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          SmartPromptOrchestrator.markCompleted('notifications');
          return;
        }
      }

      // 2. Comprobar orquestador de cadencia (sin fatiga)
      if (!SmartPromptOrchestrator.canShow('notifications')) {
        return;
      }

      // 3. Esperar 8 segundos naturales para no atosigar nada más entrar
      timer = setTimeout(() => {
        if (SmartPromptOrchestrator.acquireLock('notifications')) {
          setShow(true);
        }
      }, 8000);
    };

    checkEligibility();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    PlatformBridge.hapticFeedback('light');
    SmartPromptOrchestrator.releaseLock();
    setShow(false);
  };

  const handleEnableNotifications = async () => {
    if (busy) return;
    setBusy(true);
    PlatformBridge.hapticFeedback('medium');

    try {
      if (PlatformBridge.isNative()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        let status = await PushNotifications.checkPermissions();
        if (status.receive === 'prompt') {
          status = await PushNotifications.requestPermissions();
        }
        if (status.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          setGranted(true);
          SmartPromptOrchestrator.markCompleted('notifications');
          PlatformBridge.hapticFeedback('success');
          setTimeout(() => setShow(false), 1400);
          return;
        }
      } else if (typeof Notification !== 'undefined') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setGranted(true);
          SmartPromptOrchestrator.markCompleted('notifications');
          PlatformBridge.hapticFeedback('success');
          setTimeout(() => setShow(false), 1400);
          return;
        }
      }
    } catch (err) {
      console.warn('[SmartNotificationPrompt] Error requesting push:', err);
    } finally {
      setBusy(false);
      setTimeout(() => {
        SmartPromptOrchestrator.releaseLock();
        setShow(false);
      }, 1000);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-150 flex items-end sm:items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ y: '100%', opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '100%', opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md rounded-3xl p-6 overflow-hidden border shadow-2xl z-10"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'rgba(233, 30, 99, 0.25)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(233, 30, 99, 0.15)',
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            style={{ background: 'var(--bg-pressed)', color: 'var(--text-muted)' }}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>

          {/* Icon Header */}
          <div className="flex flex-col items-center text-center pt-2 pb-4">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 relative"
              style={{
                background: 'linear-gradient(135deg, rgba(233, 30, 99, 0.2) 0%, rgba(255, 64, 129, 0.1) 100%)',
                border: '1px solid rgba(233, 30, 99, 0.35)',
              }}
            >
              <BellRing size={32} className="text-[#E91E63] animate-pulse" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E91E63] border-2 border-[var(--bg-elevated)]" />
            </div>

            <h3 className="text-xl font-black text-[var(--text-primary)] mb-2 leading-tight">
              {granted ? '¡Notificaciones activadas!' : 'No te pierdas tus recompensas'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs">
              {granted
                ? 'Te avisaremos cuando recibas Bunz o los comercios lancen promociones en tu zona.'
                : 'Recibe alertas instantáneas cuando ganes Bunz, te respondan comercios o haya Happy Hour cerca de ti.'}
            </p>
          </div>

          {/* Benefits Bullet List */}
          {!granted && (
            <div
              className="rounded-2xl p-3.5 mb-5 space-y-2 border"
              style={{
                background: 'var(--bg-pressed)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                <span className="text-sm">🪙</span>
                <span>Confirmación de Bunz ganados y transferencias</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                <span className="text-sm">💬</span>
                <span>Respuestas en directo de afiliados a tus mensajes</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                <span className="text-sm">🔥</span>
                <span>Alertas de Happy Hour (Doble Cashback Bunz)</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2.5">
            {granted ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-emerald-400">
                <CheckCircle2 size={18} />
                <span>Listo para explorar</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  disabled={busy}
                  className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                  style={{
                    background: 'linear-gradient(135deg, #E91E63 0%, #FF4081 100%)',
                    boxShadow: '0 8px 24px rgba(233, 30, 99, 0.35)',
                  }}
                >
                  <Bell size={16} />
                  <span>{busy ? 'Activando…' : 'Activar Notificaciones'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  Quizás más tarde
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
