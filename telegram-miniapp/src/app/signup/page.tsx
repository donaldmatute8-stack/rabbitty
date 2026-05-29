'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/contexts/ToastContext';

export default function SignupPage() {
  const router = useRouter();
  const { address, connect } = useWallet();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // User Data
  const [telegramId, setTelegramId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');

  // Biometrics
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);

  // Focus refs
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load Telegram Data
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      if (app.initDataUnsafe?.user) {
        setTelegramId(app.initDataUnsafe.user.id.toString());
        setFirstName(app.initDataUnsafe.user.first_name || '');
        setLastName(app.initDataUnsafe.user.last_name || '');
        setUsername(app.initDataUnsafe.user.username || '');
      } else {
        setTelegramId('dev_user_123');
      }

      // Check Biometrics Support
      if (app.BiometricManager && app.BiometricManager.isInited) {
        setBiometricsSupported(app.BiometricManager.isBiometricAvailable);
      } else if (app.BiometricManager) {
        app.BiometricManager.init(() => {
          setBiometricsSupported(app.BiometricManager.isBiometricAvailable);
        });
      }
    });
  }, []);

  useEffect(() => {
    // Auto focus on step change
    if (step === 1 || step === 2) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]);

  const handleRequestBiometrics = async () => {
    try {
      const mod = await import('@twa-dev/sdk');
      const app = mod.default;

      if (!app.BiometricManager.isBiometricAvailable) {
        setStep(4);
        return;
      }

      app.BiometricManager.requestAccess({ reason: 'Protege tus Bunz con Face ID' }, (granted) => {
        if (granted) {
          setBiometricsEnabled(true);
          showToast('Biométricos activados exitosamente 🔒', 'success');
        }
        setStep(4);
      });
    } catch (e) {
      setStep(4);
    }
  };

  const finalizeRegistration = async (skipWallet = false) => {
    setLoading(true);
    try {
      const payload = {
        telegramId,
        firstName,
        lastName,
        username,
        tonWalletAddress: skipWallet ? null : address,
        biometricsEnabled
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = '/'; // Hard refresh to Feed
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextStep: number) => {
    if (e.key === 'Enter') {
      setStep(nextStep);
    }
  };

  const totalSteps = 4;

  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] text-white flex flex-col font-sans relative overflow-hidden">

      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 h-1.5 bg-[var(--rabbitty-pink)] transition-all duration-500 ease-out z-50" style={{ width: `${(step / totalSteps) * 100}%` }} />

      <div className="flex justify-between items-center pb-4 z-10" style={{ paddingLeft: 24, paddingRight: 24, marginTop: 40 }}>
        <button
          onClick={() => step > 1 ? setStep(step - 1) : router.push('/onboarding')}
          className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors border border-white/10 text-white/70"
        >
          ←
        </button>
        <span className="text-white/30 font-mono text-sm tracking-widest">{step} / {totalSteps}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center pb-20 relative z-10" style={{ paddingLeft: 24, paddingRight: 24 }}>
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

              <div style={{ marginTop: 60 }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={!firstName.trim()}
                  className="w-full text-black font-black flex items-center justify-center gap-3 transition-transform disabled:opacity-30 disabled:scale-100"
                  style={{
                    backgroundColor: "#FFF",
                    fontSize: 16,
                    padding: "17px 0",
                    borderRadius: 100,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(255,255,255,0.1)",
                    fontFamily: "var(--font-family-base)",
                  }}
                >
                  Continuar <span className="text-xl">→</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: LAST NAME */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <span className="font-bold mb-4 tracking-widest text-sm" style={{ color: "var(--rabbitty-pink)" }}>IDENTIDAD (2/2)</span>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight leading-tight">
                ¿Y tus apellidos?
              </h1>

              <input
                ref={inputRef}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 3)}
                placeholder="Tus apellidos"
                autoFocus
                className="w-full bg-transparent border-b-2 border-white/20 text-3xl pb-4 outline-none transition-colors placeholder:text-white/20"
                style={{ borderColor: lastName ? "var(--rabbitty-pink)" : "rgba(255,255,255,0.2)" }}
              />

              <div style={{ marginTop: 60 }}>
                <button
                  onClick={() => setStep(3)}
                  className="w-full text-black font-black flex items-center justify-center gap-3 active:scale-95 transition-transform"
                  style={{
                    backgroundColor: "#FFF",
                    fontSize: 16,
                    padding: "17px 0",
                    borderRadius: 100,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(255,255,255,0.1)",
                    fontFamily: "var(--font-family-base)",
                  }}
                >
                  Confirmar Identidad <span className="text-xl">✓</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: BIOMETRICS */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <div className="w-20 h-20 bg-blue-500/20 text-blue-400 rounded-3xl flex items-center justify-center mb-8 text-4xl border border-blue-500/30"
                style={{ margin: '0 auto' }}
              >
                🛡️
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight text-center">
                Protege tus Bunz
              </h1>
              <p className="text-white/60 text-lg mb-16 leading-relaxed text-center">
                Activa <span className="text-white font-bold">Face ID</span> o Touch ID. Así nadie más podrá reclamar tus recompensas ni robar tu billetera.
              </p>

              <div className="flex flex-col gap-4 mt-auto">
                {biometricsSupported ? (
                  <button
                    onClick={handleRequestBiometrics}
                    className="w-full text-white font-black active:scale-95 transition-transform shadow-[0_4px_15px_rgba(59,130,246,0.3)]"
                    style={{
                      backgroundColor: "#3B82F6",
                      fontSize: 16,
                      padding: "17px 0",
                      borderRadius: 100,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-family-base)",
                    }}
                  >
                    Activar Face ID
                  </button>
                ) : (
                  <div
                    className="bg-orange-500/10 rounded-2xl border border-orange-500/30 text-orange-400 text-xs font-medium mb-2 text-center"
                    style={{ margin: '10px 0', padding: '14px 10px', lineHeight: '1.6' }}
                  >
                    Tu dispositivo actual no soporta biométricos o no diste permisos a Telegram.
                  </div>
                )}
                <button
                  onClick={() => setStep(4)}
                  className="w-full text-white/60 font-bold active:scale-95 transition-transform"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    fontSize: 16,
                    padding: "17px 0",
                    borderRadius: 100,
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    fontFamily: "var(--font-family-base)",
                  }}
                >
                  Saltar por ahora
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: WALLET */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col">
              <div className="w-20 h-20 bg-pink-500/20 text-pink-400 rounded-3xl flex items-center justify-center mb-8 text-4xl border border-pink-500/30 shadow-[0_0_40px_rgba(233,30,99,0.2)]"
                style={{ margin: '0 auto' }}
              >
                💎
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight flex items-center justify-center gap-3 text-center">
                Tu Billetera TON
                <button onClick={() => setShowInfo(true)} className="w-8 h-8 rounded-full bg-white/10 text-white/60 text-sm flex items-center justify-center hover:bg-white/20 transition-colors">
                  ?
                </button>
              </h1>
              <p className="text-white/60 text-lg mb-12 leading-relaxed text-center"
                style={{ marginBottom: '20px' }}
              >
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
                    className="w-full text-white font-black active:scale-95 transition-transform disabled:opacity-50 shadow-[0_4px_15px_rgba(233,30,99,0.3)]"
                    style={{
                      background: 'linear-gradient(135deg, var(--rabbitty-pink) 0%, #E91E63 100%)',
                      fontSize: 16,
                      padding: "17px 0",
                      borderRadius: 100,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-family-base)",
                    }}
                  >
                    {loading ? 'Preparando...' : 'Comenzar a ganar'}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={loading}
                      onClick={connect}
                      className="w-full text-black font-black active:scale-95 transition-transform shadow-[0_4px_15px_rgba(255,255,255,0.2)]"
                      style={{
                        backgroundColor: "#FFF",
                        fontSize: 16,
                        padding: "17px 0",
                        borderRadius: 100,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-family-base)",
                      }}
                    >
                      {loading ? 'Cargando...' : 'Conectar o Crear Billetera'}
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => finalizeRegistration(true)}
                      className="w-full text-white/60 font-bold active:scale-95 transition-transform"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        fontSize: 16,
                        padding: "17px 0",
                        borderRadius: 100,
                        border: "1px solid rgba(255,255,255,0.1)",
                        cursor: "pointer",
                        fontFamily: "var(--font-family-base)",
                      }}
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
              className="w-full bg-[#1A1A1A] rounded-t-3xl"
              style={{ padding: "40px 24px 30px" }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black text-white mb-4"
                style={{ paddingBottom: '20px' }}
              >¿Por qué conectar una billetera?</h3>
              <p className="text-white/70 mb-4 leading-relaxed">
                Tus <strong style={{ color: "var(--rabbitty-pink)" }}>bunz</strong> son tokens que se almacenan de forma segura en la economía de Rabbitty.
              </p>
              <p className="text-white/70 mb-8 leading-relaxed"
                style={{ paddingBottom: '20px' }}
              >
                Al conectar una billetera, te conviertes en el único dueño real de tus recompensas. Esto te permitirá en el futuro canjear tus bunz por dinero real, transferirlos o enviarlos a tus amigos sin que nosotros podamos impedirlo.
              </p>
              <button
                onClick={() => setShowInfo(false)}
                className="w-full text-black font-black active:scale-95 transition-transform"
                style={{
                  backgroundColor: "#FFF",
                  fontSize: 16,
                  padding: "17px 0",
                  borderRadius: 100,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-family-base)",
                }}
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
