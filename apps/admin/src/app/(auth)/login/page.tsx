"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("resend", { email, redirect: false });
    setSent(true);
  };

  const handleQuickLogin = async () => {
    await signIn("test-e2e", { password: "test", callbackUrl: "/" });
  };

  if (sent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
        {/* Blurry decorative background blobs */}
        <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-bounce-slow">
            <Mail className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Revisa tu correo</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Te hemos enviado un enlace mágico de acceso a <strong className="text-white font-semibold">{email}</strong>. Haz clic en el enlace para entrar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
      {/* Blurry decorative background blobs */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center space-y-4">
          <img
            src="/Ra.png"
            alt="Rabbitty Logo"
            className="mx-auto h-36 w-36 object-contain drop-shadow-[0_0_15px_rgba(236,72,153,0.4)]"
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Rabbitty Admin
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm font-medium">Ingresa con tu correo de administrador</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-gray-500 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all duration-300"
            />
          </div>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_14px_rgba(236,72,153,0.39)] cursor-pointer"
          >
            Enviar enlace mágico
          </button>
        </form>

        {typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (
          <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center">Desarrollo Local</p>
            <button
              onClick={handleQuickLogin}
              className="flex h-12 w-full items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 text-pink-400 font-bold hover:bg-pink-500/20 hover:text-white transition-all cursor-pointer text-sm shadow-[0_0_15px_rgba(236,72,153,0.05)]"
            >
              Acceso Rápido (Bypass)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
