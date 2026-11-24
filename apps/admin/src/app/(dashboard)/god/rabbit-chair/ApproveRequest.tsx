"use client";

import { useState } from "react";

/** Aprobación de una solicitud: genera el token y avisa al tenant. */
export function ApproveRequest({ requestId, businessName }: { requestId: string; businessName: string }) {
  const [type, setType] = useState<"gift" | "upgrade">("gift");
  const [milestone, setMilestone] = useState("3 activaciones de prueba");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const approve = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rabbit-chair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, type, milestone, days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo aprobar.");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  if (url) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
        <p className="m-0 text-[10px] font-black uppercase tracking-wider text-emerald-300">Acceso generado</p>
        <p className="mt-1 break-all font-mono text-[10px] text-white/70">{url}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(url).catch(() => undefined)}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-black"
          >
            Copiar enlace
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/80"
          >
            Abrir
          </a>
        </div>
        <p className="mt-2 text-[10px] text-white/40">
          Ya se avisó a {businessName} por push, correo y Telegram (si tiene).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-gray-500">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "gift" | "upgrade")}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none"
          >
            <option value="gift">Regalo por hito</option>
            <option value="upgrade">Upgrade</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-gray-500">Hito / etiqueta</span>
          <input
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-gray-500">Vigencia (días)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-[11px] font-bold text-red-400">{error}</p>}
      <button
        type="button"
        onClick={approve}
        disabled={loading}
        className="mt-2 rounded-lg bg-pink-500 px-3 py-1.5 text-[11px] font-black text-black hover:bg-pink-400 disabled:opacity-50"
      >
        {loading ? "Generando…" : "Generar acceso y avisar"}
      </button>
    </div>
  );
}
