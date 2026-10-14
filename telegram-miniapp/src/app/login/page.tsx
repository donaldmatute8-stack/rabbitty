'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoDetecting, setAutoDetecting] = useState(true);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect Telegram Identity if launched inside Telegram
  useEffect(() => {
    let mounted = true;

    if (PlatformBridge.isTelegram()) {
      import('@twa-dev/sdk')
        .then(async (mod) => {
          const app = mod.default;
          if (!mounted) return;

          if (app.initData) {
            try {
              const res = await fetch('/api/auth/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: app.initData }),
              });
              const data = await res.json();
              if (data?.success && data?.user) {
                if (data.sessionToken) {
                  await PlatformBridge.setSessionToken(data.sessionToken);
                }
                await checkAuth();
                router.replace('/');
                return;
              }
            } catch (e) {
              console.error('Auto login check failed', e);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mounted) setAutoDetecting(false);
        });
    } else {
      setAutoDetecting(false);
    }

    return () => {
      mounted = false;
    };
  }, [router, checkAuth]);

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 300);
    }
  }, [step]);

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Por favor ingresa un correo electrónico válido.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStep('otp');
        setMessage(`Enviamos un código de 6 dígitos a ${cleanEmail}`);
        await PlatformBridge.hapticFeedback('medium');
      } else {
        setError(data.error || 'No se pudo enviar el código. Intenta de nuevo.');
        await PlatformBridge.hapticFeedback('error');
      }
    } catch (e) {
      console.error(e);
      setError('Error al conectar con el servidor.');
      await PlatformBridge.hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length < 6) {
      setError('Por favor introduce el código de 6 dígitos completo.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await PlatformBridge.hapticFeedback('success');
        // Securely persist revocable session in @capacitor/preferences
        if (data.sessionToken) {
          await PlatformBridge.setSessionToken(data.sessionToken);
        }
        await checkAuth();

        if (data.user?.role === 'AFFILIATE') {
          router.replace('/business');
        } else {
          router.replace('/');
        }
      } else {
        setError(data.error || 'Código incorrecto o expirado.');
        await PlatformBridge.hapticFeedback('error');
      }
    } catch (e) {
      console.error(e);
      setError('Error al validar código. Intenta de nuevo.');
      await PlatformBridge.hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (cleaned.length === 6) {
      handleVerifyOtp(cleaned);
    }
  };

  if (autoDetecting) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0A0A0A]">
        <div className="w-10 h-10 rounded-full border-3 border-neutral-800 border-t-[#E91E63] animate-spin" />
        <p className="mt-4 text-xs font-semibold text-neutral-400">Verificando sesión segura...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col pt-14 px-7 pb-10"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      {/* Back button */}
      <div className="mb-7 flex items-center justify-between">
        <button
          onClick={() => {
            if (step === 'otp') {
              setStep('email');
              setError('');
            } else {
              router.push('/onboarding');
            }
          }}
          className="p-2 -ml-2 bg-none border-none cursor-pointer flex items-center text-neutral-400 active:text-white"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {step === 'email' ? 'Paso 1 de 2' : 'Verificación OTP'}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1
          className="text-[34px] font-extrabold tracking-[-0.5px] leading-[1.15] mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {step === 'email' ? 'Bienvenido a Rabbitty' : 'Introduce tu Código'}
        </h1>
        <p className="text-[14px] leading-relaxed text-neutral-400">
          {step === 'email'
            ? 'Ingresa tu correo institucional o personal para iniciar sesión sin contraseñas.'
            : message || 'Introduce el código de 6 dígitos que enviamos a tu buzón.'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'email' ? (
          <motion.div
            key="email-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="relative mb-2">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="ejemplo@rabbitty.me"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="w-full bg-neutral-900/80 border border-neutral-800 focus:border-[#E91E63] rounded-2xl px-5 py-4 text-[17px] text-white outline-none transition-all placeholder:text-neutral-600 shadow-inner"
                  autoFocus
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[13px] font-medium text-rose-500 mt-3"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 mt-8">
              <button
                onClick={handleSendOtp}
                disabled={loading || !email.trim()}
                className="w-full text-base font-bold py-[17px] rounded-full border-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#E91E63]/25"
                style={{
                  background: loading || !email.trim() ? '#222' : 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
                  color: loading || !email.trim() ? '#666' : '#FFF',
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Enviando código…' : 'Continuar con Correo 🔑'}
              </button>

              <button
                type="button"
                className="bg-none border-none text-sm font-medium cursor-pointer text-neutral-400 hover:text-white pt-2"
                onClick={() => router.push('/signup')}
              >
                ¿Nuevo en Rabbitty? <span className="font-semibold text-[#E91E63]">Crea tu cuenta</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="otp-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="relative mb-2">
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  className="w-full text-center tracking-[0.5em] font-mono text-[32px] font-black bg-neutral-900/80 border border-neutral-800 focus:border-[#E91E63] rounded-2xl py-4 text-white outline-none transition-all shadow-inner"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[13px] font-medium text-rose-500 mt-3 text-center"
                >
                  {error}
                </motion.p>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs font-semibold text-neutral-400 hover:text-[#E91E63] bg-transparent border-none cursor-pointer"
                >
                  ¿No recibiste el código? Reenviar
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 mt-8">
              <button
                onClick={() => handleVerifyOtp()}
                disabled={loading || otpCode.length < 6}
                className="w-full text-base font-bold py-[17px] rounded-full border-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#E91E63]/25"
                style={{
                  background: loading || otpCode.length < 6 ? '#222' : 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
                  color: loading || otpCode.length < 6 ? '#666' : '#FFF',
                  cursor: loading || otpCode.length < 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Verificando…' : 'Acceder a Rabbitty 🚀'}
              </button>

              <button
                type="button"
                className="bg-none border-none text-xs font-medium cursor-pointer text-neutral-500 hover:text-neutral-300"
                onClick={() => {
                  setStep('email');
                  setOtpCode('');
                  setError('');
                }}
              >
                Cambiar correo electrónico
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
