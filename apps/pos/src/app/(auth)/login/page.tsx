"use client";

import { signIn } from "@rabbitty/auth/client";
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Mail className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Revisa tu correo</h1>
          <p className="mt-2 text-sm text-gray-500">
            Te enviamos un enlace mágico a <strong className="text-gray-700">{email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-600 text-3xl font-black text-white">
            R
          </div>
          <h1 className="text-xl font-bold text-gray-900">Rabbitty POS</h1>
          <p className="mt-1 text-sm text-gray-500">Ingresa con tu correo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
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
