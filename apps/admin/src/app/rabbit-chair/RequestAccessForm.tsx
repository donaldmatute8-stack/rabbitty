"use client";

import { useState } from "react";

/**
 * Formulario de solicitud de acceso a Rabbit Chair.
 * Se usa en la landing privada cuando no hay token válido (o para confirmar
 * la activación). No muestra si el correo pertenece a un negocio real.
 */
export function RequestAccessForm({
  defaultBusinessName = "",
  compact = false,
}: {
  defaultBusinessName?: string;
  compact?: boolean;
}) {
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rabbit-chair/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, name, email, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5 text-left">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">Solicitud enviada</p>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Ya le llegó al equipo. Si tu correo está vinculado a un negocio, el aviso incluye tu cuenta.
          Te mandamos tu enlace privado en cuanto lo aprobemos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`text-left ${compact ? "" : "mt-6"}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Negocio</span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            maxLength={120}
            placeholder="626 Café"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-500/60"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Tu nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Poncho"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-500/60"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Correo del dueño
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            maxLength={160}
            placeholder="tu@negocio.com"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-500/60"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Nota (opcional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Quiero probarlo un viernes por la noche."
            className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-500/60"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-[11px] font-bold text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-full bg-red-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-red-500 disabled:opacity-50 sm:w-auto"
      >
        {loading ? "Enviando…" : "Pedir acceso"}
      </button>
    </form>
  );
}
