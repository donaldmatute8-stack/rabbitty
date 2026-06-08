"use client";

import { signIn } from "@rabbitty/auth";
import { useState } from "react";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("resend", { email, redirect: false });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[#1A1A1A] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900/50">
            <Mail className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Revisa tu correo</h1>
          <p className="mt-2 text-sm text-gray-400">
            Te enviamos un enlace mágico a <strong className="text-gray-300">{email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1A1A1A] p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-600 text-3xl font-black text-white">
            R
          </div>
          <h1 className="text-xl font-bold text-white">KDS Rabbitty</h1>
          <p className="mt-1 text-sm text-gray-400">Ingresa con tu correo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
          />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-pink-600 font-semibold text-white transition-colors hover:bg-pink-700"
          >
            Enviar enlace mágico
          </button>
        </form>
      </div>
    </div>
  );
}
