"use client";

/**
 * ── EnableNotificationsBanner (Admin) ── recordatorio PERSISTENTE para activar
 * las notificaciones del navegador en el admin.
 *
 * Por qué: el panel avisa de mensajes de clientes con toast + sonido, pero si la
 * pestaña está en segundo plano solo lo ves si el navegador tiene permiso
 * (notificación del sistema). Sin permiso, el aviso se pierde.
 *
 * Reglas:
 *   · Visible mientras `Notification.permission` no sea "granted".
 *   · Botón "Activar" → pide permiso.
 *   · "No mostrar más" → se guarda y no vuelve (decisión del usuario).
 *   · Si está bloqueado por el navegador, explica cómo desbloquearlo.
 */

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { toast } from "@rabbitty/ui";

const DISMISS_KEY = "rabbitty_admin_push_banner_dismissed_v1";

export function EnableNotificationsBanner() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch { /* storage bloqueado */ }
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    sync();
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sync]);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("🔔 Notificaciones activadas — te avisaremos de mensajes nuevos");
        try {
          new Notification("Rabbitty · Notificaciones activas", {
            body: "Te avisaremos cuando un cliente te escriba.",
            tag: "rabbitty-welcome",
          });
        } catch { /* el navegador puede bloquear la primera */ }
      } else if (result === "denied") {
        toast.warning("El navegador bloqueó las notificaciones. Habilítalas en el candado de la barra de dirección.");
      }
    } catch {
      toast.error("No se pudo pedir el permiso");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  if (dismissed || permission === "granted" || permission === "unsupported") return null;

  const blocked = permission === "denied";

  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{
        background: "linear-gradient(135deg, rgba(236,72,153,0.14), rgba(17,17,19,0.6))",
        border: "1px solid rgba(236,72,153,0.35)",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(236,72,153,0.18)", color: "#F472B6" }}
      >
        <BellRing size={17} strokeWidth={2.5} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black text-white m-0 leading-tight">
          {blocked ? "Notificaciones bloqueadas" : "Activa las notificaciones del admin"}
        </p>
        <p className="text-[11px] text-gray-400 m-0 leading-tight mt-0.5">
          {blocked
            ? "En el candado 🔒 de la barra de dirección → Notificaciones → Permitir."
            : "Te avisamos cuando un cliente escribe, aunque tengas otra pestaña abierta."}
        </p>
      </div>

      {!blocked && (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black text-white cursor-pointer active:scale-95 transition-transform disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#EC4899,#DB2777)" }}
        >
          {busy ? "…" : <><Check size={13} /> Activar</>}
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        title="No mostrar más"
        className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
      >
        <X size={13} /> No mostrar más
      </button>
    </div>
  );
}
