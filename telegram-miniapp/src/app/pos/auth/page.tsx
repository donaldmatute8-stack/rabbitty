"use client";

/**
 * ── Puente de aprobación (Fase 4 del ADR-014) ──
 *
 * La notificación de la app nativa abre ESTA ruta con `?code=`. La aprobación
 * real vive en el panel de administración (necesita sesión de admin), así que
 * aquí solo mostramos el código y abrimos `admin.rabbitty.me/pos/auth`.
 *
 * No hace llamadas a la API ni pide credenciales: es un puente.
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

export default function PosAuthBridgePage() {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = (params.get("code") || "").replace(/\D/g, "").slice(0, 6);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(value);
  }, []);

  const adminUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.rabbitty.me";
    return `${base.replace(/\/$/, "")}/pos/auth${code ? `?code=${code}` : ""}`;
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin portapapeles: el código se ve en pantalla */
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-black p-5 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-[#08131C] to-[#08040C] p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <ShieldCheck className="h-7 w-7" />
        </div>

        <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">Rabbitty POS</p>
        <h1 className="m-0 mt-1 text-xl font-black">Aprobar terminal</h1>
        <p className="m-0 mt-1 text-xs text-gray-400">
          La aprobación se hace en el panel de administración con tu cuenta.
        </p>

        {code ? (
          <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
            <p className="m-0 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">
              <KeyRound className="h-3 w-3" /> Código
            </p>
            <p className="m-0 mt-1 text-3xl font-black tracking-[0.2em]">{code}</p>
            <button
              type="button"
              onClick={copy}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-bold text-gray-300"
            >
              <Copy className="h-3 w-3" /> {copied ? "Copiado" : "Copiar código"}
            </button>
          </div>
        ) : (
          <p className="m-0 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Abre esta pantalla desde la notificación de la terminal para traer el código.
          </p>
        )}

        <a
          href={adminUrl}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3.5 text-sm font-black text-gray-950 active:scale-[0.99]"
        >
          <ExternalLink className="h-4 w-4" /> Abrir aprobación
        </a>

        <p className="m-0 mt-4 text-[11px] leading-relaxed text-gray-500">
          Si el panel te pide iniciar sesión, usa la misma cuenta de administrador del negocio. El POS nunca recibe
          tu contraseña ni tu sesión.
        </p>
      </div>
    </div>
  );
}
