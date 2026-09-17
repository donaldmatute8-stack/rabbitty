"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * /magic-confirm — Página de confirmación de acceso mágico
 *
 * Recibe: ?token=<tok>&email=<email>
 *
 * Al presionar "Ingresar" llama a signIn("email-token") de NextAuth:
 *   1. Verifica el token en la DB
 *   2. Lo consume (single use)
 *   3. Crea la sesión JWT
 *   4. Redirige al dashboard
 *
 * Esto resuelve:
 *   - Prefetch: el token solo se consume al presionar el botón
 *   - Cross-browser: el token se envía como credencial y NextAuth maneja el CSRF en este nuevo request
 */
function MagicConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center space-y-4 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-black text-white">Enlace inválido</h1>
          <p className="text-sm text-gray-400">
            El enlace no contiene los parámetros necesarios. Solicita un nuevo acceso.
          </p>
          <a
            href="/login"
            className="inline-block mt-2 px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm transition-colors"
          >
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  const handleEnter = async () => {
    setStatus("loading");
    try {
      const result = await signIn("email-token", {
        token,
        email,
        redirect: false,
      });

      if (result?.ok && !result?.error) {
        setStatus("success");
        setTimeout(() => {
          router.replace("/");
        }, 800);
      } else {
        setStatus("error");
        setErrorMsg(result?.error || "El enlace ha expirado o ya fue utilizado.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Error de red. Verifica tu conexión e intenta de nuevo.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
      {/* Background glows */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
        {/* Logo badge */}
        <div className="mx-auto inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl px-5 py-2.5">
          <span className="text-lg">🐰</span>
          <span className="font-black text-white text-sm tracking-widest uppercase">Rabbitty Admin</span>
        </div>

        {/* State: idle / loading */}
        {(status === "idle" || status === "loading") && (
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">¡Tu enlace está listo!</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Presiona el botón para ingresar de forma segura a tu panel.
            </p>
            {email && (
              <p className="text-xs text-gray-500 font-mono bg-white/5 rounded-lg px-3 py-1.5 inline-block">
                {email}
              </p>
            )}
          </div>
        )}

        {/* State: success */}
        {status === "success" && (
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-white">¡Acceso concedido!</h1>
            <p className="text-sm text-gray-400">Redirigiendo al panel...</p>
          </div>
        )}

        {/* State: error */}
        {status === "error" && (
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-black text-white">Enlace inválido o expirado</h1>
            <p className="text-sm text-gray-400">{errorMsg}</p>
          </div>
        )}

        {/* CTA Button */}
        {(status === "idle" || status === "loading") && (
          <button
            onClick={handleEnter}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_8px_25px_rgba(236,72,153,0.35)] cursor-pointer"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verificando...
              </>
            ) : (
              "🚀 Ingresar a mi Panel"
            )}
          </button>
        )}

        {/* Error: try again */}
        {status === "error" && (
          <a
            href="/login"
            className="inline-block w-full py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-colors"
          >
            Solicitar nuevo enlace
          </a>
        )}

        {/* Security note */}
        {status === "idle" && (
          <p className="text-xs text-gray-500 leading-relaxed">
            🔒 Este enlace es de un solo uso y expirará en breve.
          </p>
        )}
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
