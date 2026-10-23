'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Smartphone, Send, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

function AppleOfficialIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 170" fill="currentColor" className={className} aria-hidden="true">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.75-11.64-14.13-5.23-8.27-9.5-17.72-12.82-28.36-3.32-10.63-4.98-21.05-4.98-31.25 0-14.44 3.74-26.6 11.22-36.49 7.48-9.89 16.92-14.9 28.32-15.03 4.8 0 10.36 1.34 16.67 4.02 6.32 2.68 10.1 4.08 11.35 4.19 1.13 0 5.09-1.46 11.88-4.38 6.78-2.92 12.56-4.22 17.33-3.9 12.82.98 22.95 5.86 30.41 14.65-11.33 6.84-16.88 16.27-16.67 28.29.21 9.46 3.86 17.35 10.94 23.68 7.08 6.33 15.42 9.94 25.02 10.84-2.23 6.96-4.99 14.07-8.27 21.32zM119.22 31.84c0-7.17 2.65-13.88 7.95-20.12 5.3-6.25 11.97-10.16 20.02-11.72.63 2.53.95 5.08.95 7.64 0 7.39-2.73 14.33-8.19 20.81-5.46 6.48-12.28 10.31-20.47 11.49-.14-2.43-.26-4.97-.26-7.6l-.001-.5z" />
    </svg>
  );
}

function DownloadContent() {
  const searchParams = useSearchParams();
  const ref = searchParams?.get('ref') || '';
  const queryBunz = searchParams?.get('bunz');

  // Enlace iOS: Si existe en ENV usa el real, si no usa fallback seguro o TestFlight link
  // Al publicar en App Store, solo cambia NEXT_PUBLIC_IOS_APP_URL (el texto del botón se adapta solo).
  const IOS_APP_URL = process.env.NEXT_PUBLIC_IOS_APP_URL || '/support';
  const IS_TESTFLIGHT = IOS_APP_URL.includes('testflight.apple.com');
  const ANDROID_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || 'https://rabbitty.me/rabbitty-app.apk';
  const TELEGRAM_MINIAPP_URL = `https://t.me/Rabbittyme_bot/app?startapp=promo_${ref}`;

  // Feature Flags para mantener el cableado listo pero oculto según la directiva
  const SHOW_TELEGRAM = false;
  const SHOW_ANDROID = false;

  const [affiliateName, setAffiliateName] = useState('');
  const [welcomeBunz, setWelcomeBunz] = useState(queryBunz || '');
  const isAffiliate = Boolean(affiliateName);
  useEffect(() => {
    if (!ref) return;
    let isCancelled = false;
    fetch(`/api/affiliates`)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data?.success && Array.isArray(data.businesses)) {
          const found = data.businesses.find(
            (b: { refCode?: string; id?: string }) =>
              b.refCode?.toLowerCase() === ref.toLowerCase() || b.id?.toLowerCase() === ref.toLowerCase()
          );
          if (found) {
            setAffiliateName(found.name);
            if (!queryBunz && found.rewardPercentage) {
              setWelcomeBunz(String(found.rewardPercentage));
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [ref, queryBunz]);

  // Telemetría no intrusiva de escaneo QR en montaje
  useEffect(() => {
    const ua = window.navigator.userAgent || window.navigator.vendor;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    const deviceType = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

    try {
      fetch('/api/telemetry/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref,
          device: deviceType,
          userAgent: ua,
        }),
      }).catch(() => {});
    } catch {
      // Ignorar fallo de red en analíticas
    }
  }, [ref]);

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
          
          <div className="text-center space-y-3 mb-8">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold block">
              {isAffiliate ? `Bienvenido a ${affiliateName}` : 'Lealtad que te premia'}
            </span>
            {isAffiliate && welcomeBunz ? (
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                Activa tus <br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">
                  ${welcomeBunz} Bunz de Bienvenida
                </span>
              </h1>
            ) : (
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                Descarga <br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">
                  la app de Rabbitty
                </span>
              </h1>
            )}
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              {isAffiliate
                ? 'Descarga la app oficial de Rabbitty en tu iPhone para recibir tu saldo de bienvenida y comenzar a acumular beneficios hoy mismo.'
                : 'Descarga la app oficial de Rabbitty en tu iPhone y acumula Bunz en tus restaurantes favoritos.'}
            </p>
          </div>

          {/* Botones de Descarga / Acceso Directo */}
          <div className="space-y-3">
            {/* Botón Principal Oficial Apple */}
            <a
              href={IOS_APP_URL}
              className="w-full flex items-center justify-between p-4.5 rounded-2xl border border-pink-400/80 bg-linear-to-r from-pink-500 via-rose-500 to-pink-600 text-white shadow-xl shadow-pink-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-black/25 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                  <AppleOfficialIcon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-mono uppercase tracking-wider block opacity-90 font-bold text-pink-100">
                    iOS / iPhone
                  </span>
                  <span className="text-base font-black tracking-tight block">
                    {IS_TESTFLIGHT ? 'Instalar en TestFlight' : 'Descargar en App Store'}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 shrink-0 opacity-90" />
            </a>

            {/* Opción Telegram MiniApp (Cableada y Oculta temporalmente) */}
            {SHOW_TELEGRAM && (
              <a
                href={TELEGRAM_MINIAPP_URL}
                className="w-full flex items-center justify-between p-4 rounded-2xl border bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700 transition-all"
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
            )}

            {/* Opción Android APK (Cableada y Oculta temporalmente) */}
            {SHOW_ANDROID && (
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
            )}
          </div>

          <div className="mt-8 pt-5 border-t border-zinc-900 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-pink-500" />
            <span>100% Seguro · Sin contraseñas ni datos bancarios</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md py-4 text-center text-xs text-zinc-500 font-mono">
        Rabbitty Loyalty Network{isAffiliate ? ` · ${affiliateName} Punto Afiliado Oficial` : ''}
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
