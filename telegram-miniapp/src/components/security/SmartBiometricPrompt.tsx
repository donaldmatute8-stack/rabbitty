'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanFace, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { detectBiometric, isBiometricEnabled, enableBiometric } from '@/lib/securityVault';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

const BIOMETRIC_PROMPT_KEY = 'rabbitty_biometric_prompt_handled_v2';
const DISMISSED_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Si el usuario descartó, volver a recordar tras 24h si sigue sin Face ID

export function SmartBiometricPrompt() {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const [isApple, setIsApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    let alive = true;
    let timer: NodeJS.Timeout | null = null;

    const checkEligibility = async () => {
      // 1. Si ya tiene biometría activa, no mostrar nada
      const enabled = await isBiometricEnabled();
      if (!alive) return;
      if (enabled) {
        localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'enabled');
        return;
      }

      // 2. Si ya fue manejado recientemente (ej: habilitado o descartado con cooldown de 24h)
      const handled = localStorage.getItem(BIOMETRIC_PROMPT_KEY);
      if (handled === 'enabled') return;
      if (handled) {
        const dismissedAt = parseInt(handled, 10);
        if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISSED_COOLDOWN_MS) {
          return;
        }
      }

      // 3. Verificar si el dispositivo soporta biometría
      const support = await detectBiometric();
      if (!alive) return;

      if (!support.available) {
        return;
      }

      const appleDevice = typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/i.test(navigator.userAgent);
      setIsApple(appleDevice);
      setLabel(appleDevice ? 'Face ID / Apple ID' : support.label || 'Biometría');

      const triggerPrompt = () => {
        if (timer) clearTimeout(timer);
        // Dar 4.5s de respiro natural para que el usuario explore el feed
        timer = setTimeout(() => {
          if (alive) setShow(true);
        }, 4500);
      };

      // Si el ritual de bienvenida aún no se ha visto, esperar a que termine
      const ritualSeen = typeof window !== 'undefined' && localStorage.getItem('rabbitty_welcome_ritual_seen_v3');
      if (!ritualSeen) {
        const onRitualFinished = () => {
          window.removeEventListener('rabbitty:welcome-ritual-completed', onRitualFinished);
          triggerPrompt();
        };
        window.addEventListener('rabbitty:welcome-ritual-completed', onRitualFinished);
        // Respaldo de seguridad por si no hubo evento (WelcomeRitual dura ~15.5s + fade)
        timer = setTimeout(() => {
          window.removeEventListener('rabbitty:welcome-ritual-completed', onRitualFinished);
          if (alive) setShow(true);
        }, 18000);
      } else {
        // Si el ritual ya fue visto en visitas anteriores, esperar 4.5s después de entrar al feed
        triggerPrompt();
      }
    };

    checkEligibility();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    PlatformBridge.hapticFeedback('light');
    localStorage.setItem(BIOMETRIC_PROMPT_KEY, String(Date.now()));
    setShow(false);
  };

  const handleActivateNow = async () => {
    if (busy) return;
    setBusy(true);
    PlatformBridge.hapticFeedback('medium');

    try {
      const res = await enableBiometric();
      if (res.ok) {
        PlatformBridge.hapticFeedback('success');
        localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'enabled');
        showToast(`${label} activado con éxito.`, 'success');
        setShow(false);
      } else {
        PlatformBridge.hapticFeedback('warning');
        showToast(res.message || 'No se pudo activar la biometría.', 'error');
        // Si cancela el diálogo nativo, permitimos que quede en la pantalla o se cierre
      }
    } catch {
      showToast('Error al intentar activar biometría.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGoToSettings = () => {
    PlatformBridge.hapticFeedback('light');
    localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'settings_redirect');
    setShow(false);
    router.push('/security');
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center p-4 pointer-events-none">
          {/* Backdrop con desenfoque suave */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto"
          />

          {/* Tarjeta de notificación Smart con diseño X / iOS glass */}
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-label="Activar Face ID"
            className="relative pointer-events-auto w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4 text-white overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(24, 24, 30, 0.96) 0%, rgba(12, 12, 16, 0.98) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {/* Botón cerrar sutil */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors border-none cursor-pointer"
            >
              <X size={15} />
            </button>

            {/* Cabecera con Icono de Face ID */}
            <div className="flex items-center gap-3 pr-6">
              <div className="w-12 h-12 rounded-2xl bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 flex items-center justify-center shrink-0">
                <ScanFace size={26} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#E91E63] flex items-center gap-1">
                    <ShieldCheck size={12} /> Máxima Seguridad
                  </span>
                </div>
                <h3 className="m-0 text-[16px] font-black tracking-tight leading-snug">
                  ¿Activar {label}?
                </h3>
              </div>
            </div>

            {/* Descripción */}
            <p className="m-0 text-[13px] text-white/70 leading-relaxed">
              {isApple
                ? 'Protege tus Bunz y autoriza envíos al instante con tu rostro usando tu clave segura guardada en tu Apple ID.'
                : 'Protege tu cuenta y autoriza envíos de Bunz de forma rápida y segura con tu sensor biométrico.'}
            </p>

            {/* Acciones */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleActivateNow}
                disabled={busy}
                className="w-full py-3 px-4 rounded-xl font-black text-sm bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white border-none cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-[#E91E63]/30 flex items-center justify-center gap-2"
              >
                <ScanFace size={16} />
                <span>{busy ? 'Activando…' : `Activar ${isApple ? 'Face ID' : 'Biometría'}`}</span>
              </button>

              <div className="flex items-center justify-between px-1 pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs font-bold text-white/45 hover:text-white/75 bg-transparent border-none cursor-pointer py-1"
                >
                  Ahora no (Omitir)
                </button>

                <button
                  type="button"
                  onClick={handleGoToSettings}
                  className="text-xs font-bold text-pink-400/90 hover:text-pink-300 bg-transparent border-none cursor-pointer py-1 flex items-center gap-1"
                >
                  <span>Ver en Ajustes</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
