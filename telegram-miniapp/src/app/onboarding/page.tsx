'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { hasAffiliateIntent } from '@/lib/affiliateIntent';
import { BunzyVideoStage } from '@/components/onboarding/BunzyVideoStage';

/**
 * ── Onboarding mobile (Rabbiter) ────────────────────────────────────────
 * Un video por paso arriba; abajo cambia solo el contenido a completar.
 *  0 Bienvenida  → bunzy-1-hi
 *  1 Teléfono    → bunzy-2-show
 *  2 Código OTP  → bunzy-3-conexion
 *  3 Identidad   → bunzy-4-descubrimiento
 *  4 Listo       → bunzy-5-celebra
 */

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS: Array<{
  video: string;
  poster: string;
  stepLabel: string;
  title: string;
  description: string;
}> = [
  {
    video: '/videos/bunzy/bunzy-1-hi.mp4',
    poster: '/videos/bunzy/bunzy-1-hi.jpg',
    stepLabel: '¡Hola, Rabbitter!',
    title: "Awake 'n' bunz it",
    description:
      'Gana Bunz en cada consumo, desbloquea recompensas reales y accede a beneficios exclusivos en tus lugares favoritos.',
  },
  {
    video: '/videos/bunzy/bunzy-2-show.mp4',
    poster: '/videos/bunzy/bunzy-2-show.jpg',
    stepLabel: 'Paso 1 de 3',
    title: 'Tu identidad Rabbitty',
    description: 'Usamos tu número para que tus Bunz te sigan siempre, aunque cambies de teléfono.',
  },
  {
    video: '/videos/bunzy/bunzy-3-conexion.mp4',
    poster: '/videos/bunzy/bunzy-3-conexion.jpg',
    stepLabel: 'Paso 2 de 3',
    title: 'Confirma que eres tú',
    description: 'Te enviamos un código de 6 dígitos. Con eso protegemos tu cuenta y tus Bunz.',
  },
  {
    video: '/videos/bunzy/bunzy-4-descubrimiento.mp4',
    poster: '/videos/bunzy/bunzy-4-descubrimiento.jpg',
    stepLabel: 'Paso 3 de 3',
    title: '¿Cómo te llamas?',
    description: 'Así te saludan los negocios y te reconocen tus amigos en Rabbitty.',
  },
  {
    video: '/videos/bunzy/bunzy-5-celebra.mp4',
    poster: '/videos/bunzy/bunzy-5-celebra.jpg',
    stepLabel: 'Todo listo',
    title: '¡Bienvenido a Rabbitty!',
    description: 'Tu cuenta está creada. Ahora elige dónde quieres ganar tus primeros Bunz.',
  },
];

const CONSENT_VERSION = '2026-11-08';

const COUNTRIES = [
  { code: 'MX', dialCode: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'EE.UU. / CA' },
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'CO', dialCode: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'AR', dialCode: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'CL', dialCode: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dialCode: '+51', flag: '🇵🇪', name: 'Perú' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, checkAuth } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devHint, setDevHint] = useState<string | null>(null);

  // Si el usuario ya estaba logueado antes de entrar, sale del onboarding.
  // Durante el flujo (tras verificar OTP) no se redirige.
  const inFlowRef = useRef(false);

  useEffect(() => {
    if (authLoading || inFlowRef.current) return;
    if (!user) return;
    if (!user.firstName) {
      router.replace('/signup?setup=1');
    } else if (hasAffiliateIntent()) {
      router.replace('/business');
    } else if (user.role === 'AFFILIATE') {
      router.replace('/business');
    } else {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const canonicalRecipient = useCallback(() => {
    const trimmed = phone.trim();
    if (trimmed.includes('@')) return trimmed.toLowerCase();
    if (trimmed.startsWith('+')) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    const dial = country.dialCode.replace(/\D/g, '');
    return digits.startsWith(dial) ? `+${digits}` : `${country.dialCode}${digits}`;
  }, [phone, country]);

  const finish = async () => {
    await PlatformBridge.hapticFeedback('success');
    if (hasAffiliateIntent()) {
      router.replace('/business');
      return;
    }
    router.replace('/?ritual=1');
  };

  const sendOtp = async () => {
    const target = canonicalRecipient();
    if (!target.includes('@') ? target.replace(/\D/g, '').length < 8 : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setError('Escribe un número de teléfono o correo válido.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    setDevHint(null);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: target }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'No pudimos enviar el código. Intenta de nuevo.');
        return;
      }
      inFlowRef.current = true;
      setRecipient(target);
      if (data.otpCode) setDevHint(String(data.otpCode));
      setInfo(`Enviamos un código de 6 dígitos a ${target}.`);
      setOtp('');
      setStep(2);
      await PlatformBridge.hapticFeedback('light');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: recipient, code, acceptedTerms, consentVersion: CONSENT_VERSION }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Código incorrecto o expirado.');
        return;
      }
      inFlowRef.current = true;
      if (data.sessionToken) await PlatformBridge.setSessionToken(data.sessionToken);
      await checkAuth();

      if (data.isNewUser || !data.user?.firstName) {
        setFirstName(data.user?.firstName || '');
        setLastName(data.user?.lastName || '');
        const handle = data.user?.username || '';
        setUsername(handle.startsWith('user_') ? '' : handle);
        setStep(3);
      } else {
        setStep(4);
      }
      await PlatformBridge.hapticFeedback('success');
    } catch {
      setError('Error al validar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const saveIdentity = async () => {
    if (firstName.trim().length < 2) {
      setError('Escribe tu nombre.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await PlatformBridge.getSessionToken();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim().replace(/^@/, '') || undefined,
          tonWalletAddress: null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'No pudimos guardar tu perfil.');
        return;
      }
      await checkAuth();
      setStep(4);
      await PlatformBridge.hapticFeedback('success');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const current = STEPS[step];

  return (
    <div
      className="min-h-[100dvh] flex flex-col overflow-y-auto px-5 pt-6 pb-8"
      style={{ fontFamily: 'var(--font-family-base)', backgroundColor: 'var(--bg-primary, #0B0B0E)' }}
    >
      {/* Header */}
      <div className="flex w-full max-w-md items-center justify-between mx-auto">
        <div className="flex items-center gap-2">
          {step > 0 && step < 4 ? (
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep((s) => (s - 1) as Step);
              }}
              aria-label="Volver"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
            >
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-400">RABBITTY 2026</span>
        </div>
        <span className="rounded-full border border-pink-500/25 bg-pink-500/10 px-2.5 py-0.5 font-mono text-[10px] text-pink-300">
          Ecosistema Bunz
        </span>
      </div>

      {/* Video del paso (fijo) */}
      <div className="flex flex-1 items-center justify-center py-6">
        <BunzyVideoStage
          key={current.video}
          videoSrc={current.video}
          poster={current.poster}
          stepLabel={current.stepLabel}
          title={current.title}
          description={current.description}
          videoHeightClass="h-48 sm:h-56"
          loop
        />
      </div>

      {/* Contenido del paso */}
      <div className="w-full max-w-md mx-auto space-y-3">
        {step === 0 && (
          <>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-pink-500"
              />
              <span className="text-[11px] leading-relaxed text-white/60">
                He leído y acepto los{' '}
                <a
                  href="https://rabbitty.me/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-pink-300 underline"
                >
                  Términos y el Aviso de Privacidad
                </a>
                . Entiendo que mis datos se usan para operar mi cuenta, mis Bunz y la seguridad del
                servicio.
              </span>
            </label>
            <motion.button
              onClick={() => {
                setError('');
                setStep(1);
              }}
              disabled={!acceptedTerms}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: acceptedTerms ? 0.97 : 1 }}
              className="w-full rounded-full py-[17px] text-[16px] font-black text-white shadow-[0_6px_25px_rgba(233,30,99,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: acceptedTerms ? 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)' : 'rgba(255,255,255,0.12)' }}
            >
              Comenzar Ahora
            </motion.button>
            <p className="m-0 text-center text-[14px] text-zinc-400">
              ¿Ya tienes cuenta activa?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="bg-transparent p-0 font-bold text-pink-400 underline-offset-2 hover:underline"
              >
                Inicia sesión
              </button>
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex items-center gap-2">
              <select
                value={country.code}
                onChange={(e) => setCountry(COUNTRIES.find((c) => c.code === e.target.value) || COUNTRIES[0])}
                className="h-12 rounded-xl border border-white/10 bg-white/5 px-2 text-sm text-white outline-none"
                aria-label="País"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#0b0b12]">
                    {c.flag} {c.dialCode}
                  </option>
                ))}
              </select>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="Tu número o correo"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-[15px] text-white outline-none focus:border-pink-500/60"
              />
            </div>
            <button
              type="button"
              onClick={sendOtp}
              disabled={loading}
              className="w-full rounded-full py-[15px] text-[15px] font-black text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)' }}
            >
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="h-14 w-full rounded-xl border border-white/10 bg-white/5 text-center font-mono text-2xl font-black tracking-[8px] text-white outline-none focus:border-pink-500/60"
            />
            {devHint && (
              <p className="m-0 text-center text-[11px] text-amber-300">Código de prueba: {devHint}</p>
            )}
            <button
              type="button"
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full rounded-full py-[15px] text-[15px] font-black text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)' }}
            >
              {loading ? 'Verificando…' : 'Verificar y continuar'}
            </button>
            <button
              type="button"
              onClick={sendOtp}
              disabled={loading}
              className="w-full bg-transparent text-center text-[12px] font-bold text-zinc-400"
            >
              Reenviar código
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Nombre"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[15px] text-white outline-none focus:border-pink-500/60"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Apellido (opcional)"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[15px] text-white outline-none focus:border-pink-500/60"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24))}
              placeholder="@usuario (opcional)"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[15px] text-white outline-none focus:border-pink-500/60"
            />
            <button
              type="button"
              onClick={saveIdentity}
              disabled={loading}
              className="w-full rounded-full py-[15px] text-[15px] font-black text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)' }}
            >
              {loading ? 'Guardando…' : 'Entrar a Rabbitty'}
            </button>
          </>
        )}

        {step === 4 && (
          <button
            type="button"
            onClick={finish}
            className="w-full rounded-full py-[16px] text-[16px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)' }}
          >
            Empezar a usar Rabbitty
          </button>
        )}

        {info && !error && step === 2 && (
          <p className="m-0 text-center text-[11px] leading-snug text-zinc-400">{info}</p>
        )}
        {error && <p className="m-0 text-center text-[12px] font-semibold text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
