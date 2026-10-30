'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFastLogin, verifyBiometric, hasAnyLocalSecurity, isBiometricEnabled, hasPin } from '@/lib/securityVault';

interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const COUNTRIES: CountryCode[] = [
  { code: 'MX', dialCode: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'EE.UU. / CA' },
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'CO', dialCode: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'AR', dialCode: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'CL', dialCode: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dialCode: '+51', flag: '🇵🇪', name: 'Perú' },
];

interface PhoneAuthFlowProps {
  mode: 'register' | 'login';
  onBack?: () => void;
}

export default function PhoneAuthFlow({ mode, onBack }: PhoneAuthFlowProps) {
  const router = useRouter();
  const isRegisterMode = mode === 'register';
  const { user, loading: authLoading, checkAuth } = useAuth();

  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [inputVal, setInputVal] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [targetDisplay, setTargetDisplay] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoDetecting, setAutoDetecting] = useState(() => PlatformBridge.isTelegram());
  const [celebration, setCelebration] = useState<{ totalBunz: number; businessName: string } | null>(null);
  const [fastLoginAvailable, setFastLoginAvailable] = useState(false);
  const [fastLoginBusy, setFastLoginBusy] = useState(false);
  const pendingNavRef = useRef<{ isNewUser: boolean; role?: string } | null>(null);

  // Continúa la navegación post-login (tras cerrar la celebración si aplicó)
  const continueAfterLogin = (data: { isNewUser?: boolean; user?: { firstName?: string | null; role?: string | null } | null }) => {
    if (data.isNewUser || !data.user?.firstName) {
      // New members must complete their identity before entering the app
      router.replace('/signup?setup=1');
    } else if (data.user?.role === 'AFFILIATE') {
      router.replace('/business');
    } else {
      router.replace('/');
    }
  };

  const closeCelebration = () => {
    setCelebration(null);
    const pending = pendingNavRef.current;
    pendingNavRef.current = null;
    if (pending) {
      if (pending.isNewUser) router.replace('/signup?setup=1');
      else if (pending.role === 'AFFILIATE') router.replace('/business');
      else router.replace('/');
    }
  };

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Auto-redirect if already logged in (active session opens the app directly)
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.firstName) {
        router.replace('/signup?setup=1');
      } else if (user.role === 'AFFILIATE') {
        router.replace('/business');
      } else {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  // ── Fast login: detectar stash de sesión (tras logout con seguridad activa) ──
  useEffect(() => {
    if (autoDetecting) return;
    (async () => {
      try {
        const stash = getFastLogin();
        if (stash?.token && hasAnyLocalSecurity()) setFastLoginAvailable(true);
      } catch { /* noop */ }
    })();
  }, [autoDetecting]);

  const handleFastLogin = async () => {
    const stash = getFastLogin();
    if (!stash) return;
    setFastLoginBusy(true);
    try {
      // 1. Gate local: biometría, o PIN si no hay biometría activa
      let localOk = false;
      if (await isBiometricEnabled()) {
        const bio = await verifyBiometric('Entrada rápida a tu cuenta Rabbitty');
        localOk = bio.ok;
        if (!bio.ok && !hasPin()) { setFastLoginBusy(false); return; }
      }
      if (!localOk) {
        // Fallback PIN (o único camino si solo hay PIN)
        const { promptForPin } = await import('@/components/security/PinPromptModal');
        for (;;) {
          const { pinLockRemainingMs } = await import('@/lib/securityVault');
          const remaining = pinLockRemainingMs();
          if (remaining > 0) { setFastLoginBusy(false); alert('Demasiados intentos. Espera un momento.'); return; }
          const entered = await promptForPin({ lockedMs: remaining, title: 'Entrar con PIN', description: 'Verifica tu identidad para entrar a Rabbitty' });
          if (entered === null) { setFastLoginBusy(false); return; }
          const { verifyPin } = await import('@/lib/securityVault');
          const res = await verifyPin(entered);
          if (res.ok) { localOk = true; break; }
        }
      }
      // 2. Canjear el fastToken por una sesión nueva en el server
      const verifyRes = await fetch('/api/auth/fast-login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fastToken: stash.token }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData?.success && verifyData.sessionToken) {
        await PlatformBridge.setSessionToken(verifyData.sessionToken);
        PlatformBridge.hapticFeedback('success');
        await checkAuth();
        router.replace('/');
      } else {
        // fastToken expirado/revocado → limpiar stash, OTP normal
        await import('@/lib/securityVault').then(m => m.clearFastLogin());
        setFastLoginAvailable(false);
        setFastLoginBusy(false);
      }
    } catch {
      setFastLoginBusy(false);
    }
  };

  // Determinar si lo que escribe parece teléfono
  const isPhoneNumber = (() => {
    const trimmed = inputVal.trim();
    if (!trimmed) return false;
    if (trimmed.includes('@')) return false;
    return /^[\d\s\-\+\(\)]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 1;
  })();

  // Chequeo de entorno local derivado
  const isLocalDev =
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'development' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Auto-detect Telegram Identity if launched inside Telegram
  useEffect(() => {
    let mounted = true;

    if (!PlatformBridge.isTelegram()) {
      return;
    }

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
              if (!data.user?.firstName) {
                router.replace('/signup?setup=1');
              } else {
                router.replace('/');
              }
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

    return () => {
      mounted = false;
    };
  }, [router, checkAuth]);

  useEffect(() => {
    if (step === 'otp') {
      const t = setTimeout(() => {
        otpInputRef.current?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [step]);

  const getCanonicalRecipient = () => {
    const trimmed = inputVal.trim();
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }
    if (trimmed.startsWith('+')) {
      return trimmed;
    }
    const cleanDigits = trimmed.replace(/\D/g, '');
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
    if (cleanDigits.startsWith(dialDigits)) {
      return `+${cleanDigits}`;
    }
    return `${selectedCountry.dialCode}${cleanDigits}`;
  };

  const handleSendOtp = async () => {
    const raw = inputVal.trim();
    if (!raw) {
      setError('Por favor ingresa un correo electrónico o tu número celular.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    const isTester = raw.toLowerCase() === 'tester' || raw.toLowerCase() === 'tester@rabbitty.me';
    const recipient = isTester ? 'tester@rabbitty.me' : getCanonicalRecipient();
    const isEmail = recipient.includes('@');

    if (!isTester && isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      setError('Por favor ingresa un correo electrónico válido.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    if (!isTester && !isEmail && recipient.replace(/\D/g, '').length < 8) {
      setError('Por favor ingresa un número de teléfono válido.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setDevOtpHint(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: recipient }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTargetDisplay(recipient);
        if (data.otpCode) {
          setDevOtpHint(data.otpCode);
        }
        setStep('otp');
        setMessage(
          data.message || (
            data.channel === 'email' && data.mode === 'phone'
              ? `Enviamos un código de 6 dígitos a tu correo vinculado`
              : data.mode === 'phone'
                ? `Enviamos un código de 6 dígitos a tu celular ${recipient}`
                : `Enviamos un código de 6 dígitos a ${recipient}`
          )
        );
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

    const recipient = targetDisplay || getCanonicalRecipient();

    try {
      // initData → dedupe de identidad (la cuenta de Telegram gana sobre la de OTP)
      const tgInitData = typeof window !== 'undefined'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (window as any).Telegram?.WebApp?.initData || ''
        : '';
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: recipient,
          code,
          initData: tgInitData || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await PlatformBridge.hapticFeedback('success');
        if (data.sessionToken) {
          await PlatformBridge.setSessionToken(data.sessionToken);
        }
        await checkAuth();

        // ── Celebración de Bono de Bienvenida: el usuario VE sus Bunz acreditados
        //    justo después del login (además de la notificación in-app + push) ──
        const wb = data.welcomeBonus;
        if (wb?.awarded) {
          pendingNavRef.current = { isNewUser: Boolean(data.isNewUser), role: data.user?.role ?? undefined };
          setCelebration({ totalBunz: Number(wb.totalBunz) || 0, businessName: String(wb.businessName || 'Rabbitty') });
          return; // la navegación continúa al cerrar la celebración
        }
        continueAfterLogin(data);
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

  const handleBack = () => {
    if (step === 'otp') {
      setStep('input');
      setError('');
      return;
    }
    if (onBack) {
      onBack();
    } else {
      router.push('/onboarding');
    }
  };

  // ── Celebración de Bono de Bienvenida (se muestra sobre cualquier paso) ──
  if (celebration) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0A0A0A] px-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#E91E63]/25 blur-[90px] pointer-events-none" />
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, -5, 5, 0] }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#E91E63] to-[#A855F7] flex items-center justify-center text-5xl shadow-[0_0_60px_rgba(233,30,99,0.45)]"
          >
            🐰
          </motion.div>
          <motion.p
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 260 }}
            className="mt-6 text-5xl font-black tracking-tight bg-gradient-to-r from-[#E91E63] via-[#F472B6] to-[#A855F7] bg-clip-text text-transparent"
          >
            +{celebration.totalBunz}
          </motion.p>
          <p className="mt-1 text-base font-black text-white">Bunz acreditados 🎉</p>
          <p className="mt-2 text-xs text-neutral-400 leading-relaxed max-w-xs">
            Te esperan en tu billetera, listos para usarlos en{' '}
            <strong className="text-white">{celebration.businessName}</strong>. Se aplican automáticamente en tu consumo.
          </p>
          <button
            onClick={closeCelebration}
            className="mt-8 w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-[#E91E63] to-[#A855F7] text-white font-black text-sm shadow-[0_8px_30px_rgba(233,30,99,0.4)] active:scale-95 transition-transform cursor-pointer"
          >
            Empezar a usar mis Bunz →
          </button>
          <button
            onClick={closeCelebration}
            className="mt-3 text-[11px] font-bold text-neutral-500 hover:text-neutral-300 cursor-pointer"
          >
            Continuar
          </button>
        </motion.div>
      </div>
    );
  }

  if (autoDetecting) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0A0A0A]">
        <div className="w-10 h-10 rounded-full border-3 border-neutral-800 border-t-[#E91E63] animate-spin" />
        <p className="mt-4 text-xs font-semibold text-neutral-400">Verificando sesión segura...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col px-7 pb-10"
      style={{
        fontFamily: 'var(--font-family-base)',
        backgroundColor: 'var(--bg-primary)',
        paddingTop: 'calc(var(--safe-top, 0px) + 24px)',
      }}
    >
      {/* Back button */}
      <div className="mb-7 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 bg-none border-none cursor-pointer flex items-center text-neutral-400 active:text-white"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {step === 'input' ? (isRegisterMode ? 'Paso 1 de 3' : 'Paso 1 de 2') : 'Verificación OTP'}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1
          className="text-[34px] font-extrabold tracking-[-0.5px] leading-[1.15] mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {step === 'input'
            ? (isRegisterMode ? 'Comienza en Rabbitty' : 'Bienvenido a Rabbitty')
            : 'Introduce tu Código'}
        </h1>
        <p className="text-[14px] leading-relaxed text-neutral-400">
          {step === 'input'
            ? (isRegisterMode
                ? 'Ingresa tu número celular o correo para crear tu cuenta y ganar bunz.'
                : 'Ingresa tu número celular o correo para iniciar sesión de forma rápida y segura.')
            : message || 'Introduce el código de 6 dígitos que te enviamos.'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div
            key="input-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="relative mb-2">
                <div className="flex items-center gap-2">
                  {/* Selector / indicador de país cuando es teléfono */}
                  {isPhoneNumber && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                        className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-4 text-white hover:border-pink-500 transition-colors"
                      >
                        <span className="text-xl">{selectedCountry.flag}</span>
                        <span className="text-sm font-bold text-neutral-300">{selectedCountry.dialCode}</span>
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showCountryPicker && (
                        <div className="absolute left-0 top-full mt-2 z-50 w-52 bg-[#161616] border border-neutral-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl max-h-56 overflow-y-auto">
                          {COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setShowCountryPicker(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
                                selectedCountry.code === c.code ? 'bg-[#E91E63]/20 text-[#E91E63] font-bold' : 'text-neutral-300 hover:bg-neutral-800'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{c.flag}</span>
                                <span>{c.name}</span>
                              </span>
                              <span className="text-neutral-400 font-mono text-[11px]">{c.dialCode}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    type="text"
                    inputMode={isPhoneNumber ? 'tel' : 'email'}
                    placeholder="Celular o correo (ej. 322...)"
                    value={inputVal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputVal(val);
                      const trimmed = val.trim();
                      if (trimmed.startsWith('+52')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'MX')!);
                      else if (trimmed.startsWith('+1')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'US')!);
                      else if (trimmed.startsWith('+34')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'ES')!);
                      else if (trimmed.startsWith('+57')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'CO')!);
                      else if (trimmed.startsWith('+54')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'AR')!);
                      else if (trimmed.startsWith('+56')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'CL')!);
                      else if (trimmed.startsWith('+51')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'PE')!);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    className="flex-1 bg-neutral-900/80 border border-neutral-800 focus:border-[#E91E63] rounded-2xl px-5 py-4 text-[17px] text-white outline-none transition-all placeholder:text-neutral-600 shadow-inner"
                  />
                </div>
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
                disabled={loading || !inputVal.trim()}
                className="w-full text-base font-bold py-4.25 rounded-full border-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#E91E63]/25"
                style={{
                  background: loading || !inputVal.trim() ? '#222' : 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
                  color: loading || !inputVal.trim() ? '#666' : '#FFF',
                  cursor: loading || !inputVal.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Enviando código…' : isPhoneNumber ? 'Continuar con Celular 📱' : 'Continuar con Código 🔑'}
              </button>

              {fastLoginAvailable && (
                <button
                  onClick={handleFastLogin}
                  disabled={fastLoginBusy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border border-white/15 bg-white/5 text-white text-sm font-bold active:scale-[0.98] transition-all cursor-pointer"
                >
                  {fastLoginBusy ? (
                    'Verificando…'
                  ) : (
                    <>
                      <span className="text-base">🔐</span> Entrar con Face ID / PIN
                    </>
                  )}
                </button>
              )}
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
              {/* Margen espacioso entre datos y el OTP */}
              <div className="relative mt-4 mb-6">
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  className="w-full text-center tracking-[0.4em] font-mono text-[32px] font-black bg-neutral-900/80 border border-neutral-800 focus:border-[#E91E63] rounded-2xl py-4 text-white outline-none transition-all shadow-inner"
                />
              </div>

              {/* Botón de llenado rápido de prueba en local dev */}
              {isLocalDev && devOtpHint && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-mono">
                    Código de prueba: <strong>{devOtpHint}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpCode(devOtpHint);
                      handleVerifyOtp(devOtpHint);
                    }}
                    className="text-xs bg-amber-500 text-black font-bold px-3 py-1 rounded-lg border-none cursor-pointer"
                  >
                    Rellenar ⚡
                  </button>
                </div>
              )}

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
                className="w-full text-base font-bold py-4.25 rounded-full border-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#E91E63]/25"
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
                  setStep('input');
                  setOtpCode('');
                  setError('');
                }}
              >
                Cambiar número o correo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
