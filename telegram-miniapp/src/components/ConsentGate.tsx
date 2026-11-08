"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { PlatformBridge } from "@/lib/platform";

const CONSENT_VERSION = "2026-11-08";
const SKIP_PREFIXES = ["/onboarding", "/login", "/signup", "/welcome", "/privacy", "/magic-link"];

/**
 * Gate de re-consentimiento para Rabbitters existentes.
 * Si el usuario ya aceptó la versión vigente, no renderiza nada.
 * En onboarding el consentimiento se registra en el flujo de OTP.
 */
export default function ConsentGate() {
  const { user, loading, checkAuth } = useAuth();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setChecked(false);
    setAccepted(false);
    setError("");
  }, [user?.id]);

  if (loading || !user?.id || accepted) return null;
  if (user.termsAcceptedAt) return null;
  if (pathname && SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const submit = async () => {
    if (!checked) return;
    setSaving(true);
    setError("");
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch("/api/auth/consent", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedTerms: true, consentVersion: CONSENT_VERSION }),
      });
      if (!res.ok) throw new Error("No se pudo registrar la aceptación");
      setAccepted(true);
      await checkAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="w-full max-w-md rounded-3xl border border-white/10 p-5 shadow-2xl"
        style={{ background: "var(--bg-primary, #0B0B0E)" }}
      >
        <h2 id="consent-title" className="m-0 text-lg font-black" style={{ color: "var(--text-primary)" }}>
          Antes de continuar
        </h2>
        <p className="m-0 mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Necesitamos registrar tu aceptación de los Términos y el Aviso de Privacidad vigentes.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-pink-500"
          />
          <span className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            He leído y acepto los{" "}
            <a
              href="https://rabbitty.me/privacy"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-pink-300 underline"
            >
              Términos y el Aviso de Privacidad
            </a>
            . Entiendo que mis datos se usan para operar mi cuenta, mis Bunz y la seguridad del
            servicio.
          </span>
        </label>

        {error && <p className="m-0 mt-3 text-[11px] text-rose-300">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!checked || saving}
          className="mt-4 w-full rounded-full bg-linear-to-r from-pink-600 to-purple-600 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Aceptar y continuar"}
        </button>
      </div>
    </div>
  );
}
