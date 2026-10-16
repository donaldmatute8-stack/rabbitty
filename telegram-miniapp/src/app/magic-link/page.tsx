'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

export default function MagicLinkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { checkAuth } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [businessName, setBusinessName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const sid = searchParams.get('sid');

    if (!token || !sid) {
      setStatus('error');
      setErrorMsg('Enlace de vinculación incompleto o inválido.');
      return;
    }

    const consumePairing = async () => {
      try {
        const res = await fetch('/api/auth/pairing/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, sid }),
        });

        const data = await res.json();

        if (res.ok && data.success && data.sessionToken) {
          // Guardar sesión en almacenamiento persistente de Capacitor / LocalStorage
          await PlatformBridge.setSessionToken(data.sessionToken);

          if (data.business?.name) {
            setBusinessName(data.business.name);
          }

          // Recargar estado de autenticación en la app
          await checkAuth();

          setStatus('success');

          // Redirección directa al scanner de negocios
          setTimeout(() => {
            router.replace('/business');
          }, 1800);
        } else {
          setStatus('error');
          setErrorMsg(data.error || 'El enlace de vinculación ha expirado o ya fue utilizado.');
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMsg('Error de conexión al sincronizar la terminal de escaneo.');
      }
    };

    consumePairing();
  }, [searchParams, router, checkAuth]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white px-4 overflow-hidden">
      {/* Background Neon Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-pink-500/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/10 blur-[110px] pointer-events-none rounded-full" />

      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-7 text-center shadow-2xl backdrop-blur-2xl space-y-6">
        {status === 'loading' && (
          <div className="py-6 space-y-4">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400">
              <Loader2 className="h-10 w-10 animate-spin text-pink-400" />
              <div className="absolute inset-0 rounded-2xl animate-pulse bg-pink-500/10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white tracking-tight">Vinculando… espera</h2>
              <p className="text-xs text-gray-400">Sincronizando con tu Panel de Administración</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="py-4 space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <ShieldCheck className="h-11 w-11 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Terminal Conectada
              </div>
              <h2 className="text-2xl font-black text-white">¡Bienvenido a Bordo!</h2>
              <p className="text-xs text-gray-300">
                {businessName ? (
                  <>Sesión autorizada para <span className="text-pink-400 font-bold">{businessName}</span>.</>
                ) : (
                  'Tu celular ahora está autorizado para escanear y validar Bunz.'
                )}
              </p>
              <p className="text-[11px] text-gray-500 pt-2">Abriendo Scanner de Negocio...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.25)]">
              <XCircle className="h-11 w-11 text-red-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-white">Enlace No Válido</h2>
              <p className="text-xs text-gray-400">{errorMsg}</p>
              <p className="text-[11px] text-gray-500 pt-3">
                Genera un nuevo código QR o enlace desde la sección <span className="text-gray-300 font-semibold">Configuración ➔ Vincular Celular</span> en el Dashboard de tu computadora o iPad.
              </p>
            </div>
            <button
              onClick={() => router.replace('/login')}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold text-white transition-all border border-white/10"
            >
              Ir a Iniciar Sesión Manual
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
