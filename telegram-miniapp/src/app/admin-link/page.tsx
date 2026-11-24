"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PlatformBridge } from "@/lib/platform";

/**
 * ── Puente app → panel (Rabbit Chair) ───────────────────────────────────────
 *
 * Las notificaciones del equipo apuntan aquí porque el panel de God vive en
 * `admin.rabbitty.me` y la app en `app.rabbitty.me`: mandar la notificación
 * directo a `/god/rabbit-chair` terminaba en 404/401 dentro de la app.
 *
 * Esta pantalla no pide sesión de admin: solo abre el panel en el navegador
 * del sistema (o en el navegador in-app), donde God ya tiene su sesión.
 */
export default function AdminLinkPage() {
  const searchParams = useSearchParams();
  const target = searchParams.get("to") || "rabbit-chair";
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState("");

  const url = `https://admin.rabbitty.me/god/${target}`;

  useEffect(() => {
    // Sin apertura automática: iOS bloquea popups que no nacen de un toque.
    setOpened(false);
  }, [target]);

  const open = async () => {
    try {
      await PlatformBridge.openExternalUrl(url);
      setOpened(true);
    } catch {
      setError("No se pudo abrir el panel. Copia el enlace y ábrelo en el navegador.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.3em] text-pink-500">Panel Rabbitty</p>
        <h1 className="mt-2 text-2xl font-black text-white">
          {target === "rabbit-chair" ? "Rabbit Chair · aprobaciones" : "Abrir el panel"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/60">
          Las aprobaciones viven en el panel de administración. Se abre aparte para no mezclar la app de
          clientes con las herramientas del negocio.
        </p>

        <button
          type="button"
          onClick={open}
          className="mt-5 w-full rounded-full bg-pink-500 px-5 py-3 text-sm font-black text-black transition-colors hover:bg-pink-400"
        >
          {opened ? "Volver a abrir el panel" : "Abrir el panel"}
        </button>

        {error && <p className="mt-3 text-[11px] font-bold text-red-400">{error}</p>}

        <p className="mt-4 break-all font-mono text-[10px] text-white/30">{url}</p>
      </div>
    </main>
  );
}
