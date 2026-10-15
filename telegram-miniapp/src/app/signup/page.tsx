'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading, checkAuth } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // User Data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');

  // Focus refs
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Wait until AuthProvider finishes initial session checks
    if (authLoading) return;

    // 1. If we have a logged-in user session (Native iOS or Web)
    if (user) {
      // Already onboarded → never re-run identity setup
      if (user.firstName) {
        router.replace('/');
        return;
      }
      if (user.lastName) setLastName(user.lastName);
      if (user.username && !user.username.startsWith('user_')) setUsername(user.username);
      return;
    }

    // 2. Load Telegram Data if in Telegram
    if (PlatformBridge.isTelegram()) {
      import('@twa-dev/sdk').then((mod) => {
        const app = mod.default;
        if (app.initDataUnsafe?.user) {
          setFirstName(app.initDataUnsafe.user.first_name || '');
          setLastName(app.initDataUnsafe.user.last_name || '');
          setUsername(app.initDataUnsafe.user.username || '');
        } else {
          router.replace('/login');
        }
      });
      return;
    }

    // 3. Check if stored session exists for native before kicking out
    PlatformBridge.getSessionToken().then((token) => {
      if (!token) {
        // No session token and not in Telegram -> Send to login
        router.replace('/login');
      }
    });
  }, [user, authLoading, router]);

  useEffect(() => {
    // Auto focus on step change
    if (step >= 1 && step <= 2) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]);

  const finalizeRegistration = async () => {
    setLoading(true);
    try {
      const token = await PlatformBridge.getSessionToken();
      let initData = '';
      if (PlatformBridge.isTelegram()) {
        try {
          const mod = await import('@twa-dev/sdk');
          initData = mod.default?.initData || '';
        } catch {}
      }

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().replace(/^@/, '') || undefined,
        tonWalletAddress: null,
        initData: initData || undefined,
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        await PlatformBridge.hapticFeedback('success');
        await checkAuth();
        router.replace('/');
      } else {
        setError(data.error);
        if (res.status === 409 || res.status === 400) setStep(2);
        await PlatformBridge.hapticFeedback('error');
      }
    } catch {
      setError('Error de conexión');
      await PlatformBridge.hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextStep: number) => {
    if (e.key === 'Enter') {
      setStep(nextStep);
    }
  };

  const totalSteps = 2;

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] text-white flex flex-col font-sans relative overflow-hidden">

      {/* Top Progress Bar */}
      <div className="absolute left-0 h-1.5 bg-[var(--rabbitty-pink)] transition-all duration-500 ease-out z-50" style={{ top: 'var(--safe-top, 0px)', width: `${(step / totalSteps) * 100}%` }} />

      <div className="flex justify-between items-center pb-4 z-10 px-6" style={{ marginTop: 'calc(var(--safe-top, 0px) + 40px)' }}>
        <button
          onClick={() => step > 1 ? setStep(step - 1) : router.push('/onboarding')}
          className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors border border-white/10 text-white/70"
        >
          ←
        </button>
        <span className="text-white/30 font-mono text-sm tracking-widest">{step} / {totalSteps}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center pb-20 relative z-10 px-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: FIRST NAME */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <span className="font-bold mb-4 tracking-widest text-sm" style={{ color: "var(--rabbitty-pink)" }}>IDENTIDAD (1/2)</span>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight leading-tight">
                ¿Cómo te llamas?
              </h1>

              <input
                ref={inputRef}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 2)}
                placeholder="Tu nombre"
                autoFocus
                className="w-full bg-transparent border-b-2 border-white/20 text-3xl pb-4 outline-none transition-colors placeholder:text-white/20"
                style={{ borderColor: firstName ? "var(--rabbitty-pink)" : "rgba(255,255,255,0.2)" }}
              />

              <div className="mt-[60px]">
                <button
                  onClick={() => setStep(2)}
                  disabled={!firstName.trim()}
                  className="w-full text-black font-black flex items-center justify-center gap-3 transition-transform disabled:opacity-30 disabled:scale-100 bg-white text-base py-[17px] rounded-full border-none cursor-pointer shadow-[0_4px_15px_rgba(255,255,255,0.1)] font-[var(--font-family-base)]"
                >
                  Continuar <span className="text-xl">→</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: LAST NAME & USERNAME */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <span className="font-bold mb-4 tracking-widest text-sm" style={{ color: "var(--rabbitty-pink)" }}>IDENTIDAD (2/2)</span>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight leading-tight">
                Tus apellidos y usuario
              </h1>

              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/40 block mb-2 font-bold">Apellidos</label>
                  <input
                    ref={inputRef}
                    value={lastName}
                    onChange={e => { setLastName(e.target.value); setError(''); }}
                    placeholder="Tus apellidos"
                    autoFocus
                    className="w-full bg-transparent border-b-2 border-white/20 text-2xl pb-3 outline-none transition-colors placeholder:text-white/20"
                    style={{ borderColor: lastName ? "var(--rabbitty-pink)" : "rgba(255,255,255,0.2)" }}
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-white/40 block mb-2 font-bold">Nombre de usuario (@)</label>
                  <div className="flex items-center border-b-2 border-white/20 pb-3 transition-colors" style={{ borderColor: username ? "var(--rabbitty-pink)" : "rgba(255,255,255,0.2)" }}>
                    <span className="text-xl text-[var(--rabbitty-pink)] font-black mr-1">@</span>
                    <input
                      value={username}
                      onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(''); }}
                      onKeyDown={e => handleKeyDown(e, 3)}
                      placeholder="usuario_rabbitty"
                      className="w-full bg-transparent text-xl outline-none placeholder:text-white/20"
                    />
                  </div>
                  <p className="text-xs text-white/30 mt-2">Mínimo 3 caracteres. Letras minúsculas, números y guion bajo.</p>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-6 font-medium bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</p>}

              <div className="mt-10">
                <button
                  disabled={username.trim().length < 3 || loading}
                  onClick={finalizeRegistration}
                  className="w-full text-black font-black flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-30 bg-white text-base py-[17px] rounded-full border-none cursor-pointer shadow-[0_4px_15px_rgba(255,255,255,0.1)] font-[var(--font-family-base)]"
                >
                  {loading ? 'Preparando...' : 'Comenzar a ganar'} <span className="text-xl">→</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative gradient blur in background */}
      <div className="fixed top-1/4 -right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
