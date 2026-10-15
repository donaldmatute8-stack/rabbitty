'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';

import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SignupPage() {
  const router = useRouter();
  const { address, connect } = useWallet();
  const { user, checkAuth } = useAuth();

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
    // 1. If we have a logged-in user session (Native iOS or Web)
    if (user) {
      if (user.firstName) setFirstName(user.firstName);
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

    // 3. Check if stored session exists for native
    PlatformBridge.getSessionToken().then((token) => {
      if (!token) {
        router.replace('/login');
      }
    });
  }, [user, router]);

  useEffect(() => {
    // Auto focus on step change
    if (step >= 1 && step <= 3) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]);

  const finalizeRegistration = async (skipWallet = false) => {
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
        tonWalletAddress: skipWallet ? null : address,
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

  const totalSteps = 3;

  const [showInfo, setShowInfo] = useState(false);

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
                  disabled={username.trim().length < 3}
                  onClick={() => setStep(3)}
                  className="w-full text-black font-black flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-30 bg-white text-base py-[17px] rounded-full border-none cursor-pointer shadow-[0_4px_15px_rgba(255,255,255,0.1)] font-[var(--font-family-base)]"
                >
                  Confirmar Perfil <span className="text-xl">✓</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: WALLET */}
          {step === 3 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <div className="w-20 h-20 bg-pink-500/20 text-pink-400 rounded-3xl flex items-center justify-center mb-8 text-4xl border border-pink-500/30 shadow-[0_0_40px_rgba(233,30,99,0.2)] mx-auto">
                💎
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight flex items-center justify-center gap-3 text-center">
                Tu Billetera TON
                <button onClick={() => setShowInfo(true)} className="w-8 h-8 rounded-full bg-white/10 text-white/60 text-sm flex items-center justify-center hover:bg-white/20 transition-colors">
                  ?
                </button>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed text-center mb-[20px]">
                Para intercambiar tus bunz por premios reales, necesitas una billetera.
              </p>

              {address && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-green-500/10 p-5 rounded-2xl border border-green-500/30 mb-8 flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-xl">✓</div>
                  <div>
                    <p className="text-sm font-bold text-green-400 uppercase tracking-wider mb-1">Conectada</p>
                    <p className="text-white font-mono">{address.slice(0, 6)}...{address.slice(-4)}</p>
                  </div>
                </motion.div>
              )}

              {error && <p className="text-red-400 text-sm mb-6 font-medium bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</p>}

              <div className="mt-auto flex flex-col gap-4">
                {address ? (
                  <button
                    disabled={loading}
                    onClick={() => finalizeRegistration(false)}
                    className="w-full text-white font-black active:scale-95 transition-transform disabled:opacity-50 shadow-[0_4px_15px_rgba(233,30,99,0.3)] bg-[linear-gradient(135deg,var(--rabbitty-pink)_0%,#E91E63_100%)] text-base py-[17px] rounded-full border-none cursor-pointer font-[var(--font-family-base)]"
                  >
                    {loading ? 'Preparando...' : 'Comenzar a ganar'}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={loading}
                      onClick={connect}
                      className="w-full text-black font-black active:scale-95 transition-transform shadow-[0_4px_15px_rgba(255,255,255,0.2)] bg-white text-base py-[17px] rounded-full border-none cursor-pointer font-[var(--font-family-base)]"
                    >
                      {loading ? 'Cargando...' : 'Conectar o Crear Billetera'}
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => finalizeRegistration(true)}
                      className="w-full text-white/60 font-bold active:scale-95 transition-transform bg-[rgba(255,255,255,0.05)] text-base py-[17px] rounded-full border border-white/10 cursor-pointer font-[var(--font-family-base)]"
                    >
                      {loading ? 'Preparando...' : 'Saltar por ahora'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* INFO MODAL */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-[#1A1A1A] rounded-t-3xl p-[40px_24px_30px]"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black text-white pb-5">¿Por qué conectar una billetera?</h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Tus <strong style={{ color: "var(--rabbitty-pink)" }}>bunz</strong> son tokens que se almacenan de forma segura en la economía de Rabbitty.
              </p>
              <p className="text-white/70 mb-8 leading-relaxed pb-5">
                Al conectar una billetera, te conviertes en el único dueño real de tus recompensas. Esto te permitirá en el futuro canjear tus bunz por dinero real, transferirlos o enviarlos a tus amigos sin que nosotros podamos impedirlo.
              </p>
              <button
                onClick={() => setShowInfo(false)}
                className="w-full text-black font-black active:scale-95 transition-transform bg-white text-base py-[17px] rounded-full border-none cursor-pointer font-[var(--font-family-base)]"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative gradient blur in background */}
      <div className="fixed top-1/4 -right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
