"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Loader2 } from "lucide-react";

/**
 * /magic-confirm — Página intermediaria anti-prefetch
 *
 * El link del email apunta aquí (/magic-confirm?url=<encoded_callback>)
 * en lugar de directo al callback de NextAuth.
 *
 * Propósito: evitar que clientes de correo (Gmail, Bluefy, iOS Mail)
 * hagan prefetch del URL y consuman el token de un solo uso antes de
 * que el usuario lo toque intencionalmente.
 *
 * El token SOLO se consume cuando el usuario presiona "Ingresar".
 */
function MagicConfirmContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  // El URL real de NextAuth callback viene encodificado en ?url=
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center space-y-4 backdrop-blur-xl">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-black">Enlace inválido</h1>
          <p className="text-sm text-gray-400">
            El enlace no contiene los parámetros necesarios. Solicita un nuevo
            enlace desde el panel de administración.
          </p>
          <a
            href="/login"
            className="inline-block mt-2 px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm transition-colors"
          >
            Volver al login
          </a>
        </div>
      </div>
    );
  }

  const handleEnter = () => {
    setLoading(true);
    // Navegar al callback real de NextAuth — AQUÍ se consume el token
    window.location.href = rawUrl;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
      {/* Background glow */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
        {/* Logo badge */}
        <div className="mx-auto inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl px-5 py-2.5">
          <span className="text-lg">🐰</span>
          <span className="font-black text-white text-sm tracking-widest uppercase">Rabbitty Admin</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">¡Tu enlace está listo!</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            Presiona el botón para ingresar de forma segura a tu panel de administración.
          </p>
        </div>

        {/* Main CTA */}
        <button
          onClick={handleEnter}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_8px_25px_rgba(236,72,153,0.35)] cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Verificando acceso...
            </>
          ) : (
            <>
              🚀 Ingresar a mi Panel
            </>
          )}
        </button>

        {/* Security note */}
        <p className="text-xs text-gray-500 leading-relaxed">
          🔒 Este enlace es de un solo uso y expirará en breve.
          Si no solicitaste este acceso, ignora este mensaje.
        </p>
      </div>
    </div>
  );
}

export default function MagicConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        </div>
      }
    >
      <MagicConfirmContent />
    </Suspense>
  );
}
