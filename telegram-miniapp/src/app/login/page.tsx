'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoDetecting, setAutoDetecting] = useState(true);

  // Auto-detect Telegram Identity
  useEffect(() => {
    let mounted = true;

    import('@twa-dev/sdk')
      .then(async (mod) => {
        const app = mod.default;
        if (!mounted) return;

        const tgUser = app.initDataUnsafe?.user;
        if (tgUser?.id) {
          try {
            const res = await fetch(`/api/auth/profile?telegramId=${tgUser.id}`);
            const data = await res.json();
            if (data?.profile) {
              if (data.profile.role === 'AFFILIATE') {
                router.replace('/business');
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
  }, [router]);

  const handleLogin = async () => {
    const trimmed = identifier.trim().replace(/^@/, '');
    if (!trimmed) {
      setError('Ingresa tu ID de Telegram, usuario o teléfono.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/auth/profile?telegramId=${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (data?.profile) {
        if (data.profile.role === 'AFFILIATE') {
          router.push('/business');
        } else {
          router.push('/');
        }
      } else {
        setError('No encontramos tu cuenta. ¿Deseas registrarte?');
      }
    } catch (e) {
      console.error(e);
      setError('Error al conectar con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inputBaseClassName = "w-full bg-transparent border-none py-3 text-[17px] outline-none";
  const inputBaseStyle: React.CSSProperties = {
    borderBottom: "1px solid var(--border-default)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-family-base)",
  };

  if (autoDetecting) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0A0A0A]">
        <div className="w-10 h-10 rounded-full border-3 border-neutral-800 border-t-[#E91E63] animate-spin" />
        <p className="mt-4 text-xs font-semibold text-neutral-400">Verificando sesión de Telegram...</p>
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
      {/* Back */}
      <div className="mb-7">
        <button
          onClick={() => router.push('/onboarding')}
          className="p-1 bg-none border-none cursor-pointer"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[36px] font-extrabold tracking-[-0.5px] leading-[1.15] mb-13"
        style={{ color: "var(--text-primary)" }}
      >
        Welcome back
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1"
      >
        <input
          type="text"
          placeholder="Telegram ID o Usuario"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          className={inputBaseClassName}
          style={inputBaseStyle}
          autoFocus
        />
        <p className="mt-4 text-[13px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
          Inicia sesión con tu cuenta de Telegram vinculada a Rabbitty.
        </p>

        {error && (
          <p className="mt-4 text-[13px] font-medium" style={{ color: "var(--rabbitty-pink)" }}>
            {error}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-5"
      >
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full text-base font-semibold py-[17px] rounded-full border-none transition-all duration-200 active:scale-[0.98]"
          style={{
            backgroundColor: loading ? "var(--bg-subtle)" : "var(--text-primary)",
            color: loading ? "var(--text-muted)" : "var(--bg-primary)",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "var(--font-family-base)",
          }}
        >
          {loading ? "Verificando…" : "Iniciar Sesión"}
        </button>

        <button
          className="bg-none border-none text-sm font-medium cursor-pointer"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-family-base)",
          }}
          onClick={() => router.push('/signup')}
        >
          ¿No tienes una cuenta? <span className="font-semibold" style={{ color: "var(--rabbitty-pink)" }}>Regístrate</span>
        </button>
      </motion.div>
    </div>
  );
}
