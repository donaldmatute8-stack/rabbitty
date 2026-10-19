'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Apple, Smartphone, Send, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

function DownloadContent() {
  const searchParams = useSearchParams();
  const ref = searchParams?.get('ref') || '626cafe';

  // Configuración de enlaces dinámicos
  // NOTA: Cuando pase de TestFlight a App Store pública, solo actualizas este link aquí o via ENV
  const TESTFLIGHT_URL = process.env.NEXT_PUBLIC_IOS_APP_URL || 'https://testflight.apple.com/join/rabbitty';
  const ANDROID_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || 'https://rabbitty.me/rabbitty-app.apk';
  const TELEGRAM_MINIAPP_URL = `https://t.me/Rabbittyme_bot/app?startapp=promo_${ref}`;

  const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  // Detect device once mounted
  useEffect(() => {
    const ua = window.navigator.userAgent || window.navigator.vendor;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);

    const detectedDevice = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
    const targetUrl = isIOS ? TESTFLIGHT_URL : isAndroid ? TELEGRAM_MINIAPP_URL : null;

    // Use requestAnimationFrame / timeout to avoid synchronous cascading render warning
    const id = requestAnimationFrame(() => {
      setDevice(detectedDevice);
      setRedirectingTo(targetUrl);

      // Fire and forget telemetry event
      try {
        fetch('/api/telemetry/qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref,
            device: detectedDevice,
            userAgent: ua,
          }),
        }).catch(() => {});
      } catch {
        // Ignore network failure on analytics
      }
    });

    return () => cancelAnimationFrame(id);
  }, [TESTFLIGHT_URL, TELEGRAM_MINIAPP_URL, ref]);

  // Redirección suave automática si es dispositivo móvil
  useEffect(() => {
    if (!redirectingTo || device === 'desktop') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = redirectingTo;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [redirectingTo, device]);

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-between p-6 relative overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between py-4 border-b border-zinc-900">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_conejo.png" alt="Rabbitty" className="w-8 h-8 object-contain" />
          <span className="font-black text-xl tracking-tight">RABBITTY</span>
        </div>
        <span className="text-[11px] font-mono font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Piloto Oficial
        </span>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md my-auto py-8">
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          
          <div className="text-center space-y-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold block">
              Bienvenido al lanzamiento
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Activa tus <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">
                $25 Bunz de Bienvenida
              </span>
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Descarga la app oficial de Rabbitty o ábrela al instante en Telegram para recibir tu saldo sin trámites.
            </p>
          </div>

          {/* Banner de Redirección Inteligente */}
          {redirectingTo && countdown > 0 && (
            <div className="mb-6 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center space-y-1">
              <span className="text-xs text-zinc-300 font-medium block">
                Detectamos tu {device === 'ios' ? 'iPhone / iPad' : 'Android'}. Redirigiendo en <strong className="text-pink-400 font-mono text-sm">{countdown}s</strong>...
              </span>
              <button 
                onClick={() => { window.location.href = redirectingTo; }}
                className="text-[11px] text-pink-400 underline font-semibold hover:text-pink-300 cursor-pointer"
              >
                Abrir ahora mismo
              </button>
            </div>
          )}

          {/* Botones de Descarga / Acceso Directo */}
          <div className="space-y-3">
            {/* Opción iOS (TestFlight / App Store) */}
            <a
              href={TESTFLIGHT_URL}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                device === 'ios'
                  ? 'bg-linear-to-r from-pink-500 to-rose-600 border-pink-400 text-white shadow-lg shadow-pink-500/25 scale-[1.02]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Apple className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono uppercase tracking-wider block opacity-75 font-semibold">
                    {device === 'ios' ? 'Opción Recomendada' : 'Para iPhone'}
                  </span>
                  <span className="text-sm font-black tracking-tight block">
                    Descargar en Apple TestFlight
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-80" />
            </a>

            {/* Opción Telegram MiniApp (Instantáneo sin instalar nada) */}
            <a
              href={TELEGRAM_MINIAPP_URL}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                device !== 'ios'
                  ? 'bg-linear-to-r from-pink-500 to-rose-600 border-pink-400 text-white shadow-lg shadow-pink-500/25 scale-[1.02]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono uppercase tracking-wider block opacity-75 font-semibold">
                    Instantáneo (Sin Instalar)
                  </span>
                  <span className="text-sm font-black tracking-tight block">
                    Abrir en Telegram Mini App
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-80" />
            </a>

            {/* Opción Android APK */}
            <a
              href={ANDROID_APK_URL}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold">Instalador APK directo (Android)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>

          <div className="mt-6 pt-5 border-t border-zinc-900 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-pink-500" />
            <span>100% Seguro · Sin contraseñas ni datos bancarios</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md py-4 text-center text-xs text-zinc-400 font-mono">
        Rabbitty Loyalty Network · 626 Café Punto Afiliado Oficial
      </footer>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center">Cargando Rabbitty...</div>}>
      <DownloadContent />
    </Suspense>
  );
}
