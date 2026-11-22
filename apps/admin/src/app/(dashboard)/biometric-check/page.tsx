"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@rabbitty/ui";

/**
 * ── Diagnóstico de biometría / WebAuthn ──
 * Página neutral (sin lógica de negocio) para saber qué expone realmente el
 * WebView donde corre la app: navegador normal, PWA o app nativa (iOS/iPad/Mac
 * "Designed for iPad"). No intenta autenticar, solo lee capacidades.
 */
type Row = { label: string; value: string; ok?: boolean };

export default function BiometricCheckPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ua, setUa] = useState("");

  useEffect(() => {
    const run = async () => {
      const nav = navigator as any;
      const cap = (window as any).Capacitor;
      const out: Row[] = [];

      out.push({ label: "Origen", value: `${location.protocol}//${location.host}` });
      out.push({
        label: "Contexto seguro (HTTPS)",
        value: window.isSecureContext ? "sí" : "no",
        ok: window.isSecureContext,
      });
      out.push({
        label: "App nativa (Capacitor)",
        value: cap?.isNativePlatform?.() ? `sí · ${cap.getPlatform?.() ?? "?"}` : "no",
        ok: Boolean(cap?.isNativePlatform?.()),
      });
      out.push({
        label: "window.PublicKeyCredential",
        value: "PublicKeyCredential" in window ? "existe" : "NO existe",
        ok: "PublicKeyCredential" in window,
      });
      out.push({
        label: "navigator.credentials",
        value: nav.credentials ? "existe" : "NO existe",
        ok: Boolean(nav.credentials),
      });
      out.push({
        label: "navigator.credentials.get",
        value: typeof nav.credentials?.get === "function" ? "función" : "NO disponible",
        ok: typeof nav.credentials?.get === "function",
      });
      out.push({
        label: "navigator.credentials.create",
        value: typeof nav.credentials?.create === "function" ? "función" : "NO disponible",
        ok: typeof nav.credentials?.create === "function",
      });

      try {
        const uvpaa = (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
        const available = uvpaa ? await uvpaa.call(window.PublicKeyCredential) : null;
        out.push({
          label: "Autenticador de plataforma (Face/Touch ID)",
          value: available === null ? "no consultable" : available ? "disponible" : "no disponible",
          ok: available === true,
        });
        const cond = (window as any).PublicKeyCredential?.isConditionalMediationAvailable;
        const condOk = cond ? await cond.call(window.PublicKeyCredential) : null;
        out.push({
          label: "Autofill condicional (passkeys)",
          value: condOk === null ? "no consultable" : condOk ? "disponible" : "no disponible",
          ok: condOk === true,
        });
      } catch (err) {
        out.push({ label: "Consulta de autenticador", value: `error: ${String(err)}` });
      }

      out.push({
        label: "Cookies habilitadas",
        value: navigator.cookieEnabled ? "sí" : "no",
        ok: navigator.cookieEnabled,
      });

      setUa(navigator.userAgent);
      setRows(out);
    };
    void run();
  }, []);

  const copy = async () => {
    const text = [
      ...rows.map((r) => `${r.label}: ${r.value}`),
      `UserAgent: ${ua}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* sin clipboard: se ve en pantalla */
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Card className="p-5">
        <h1 className="text-lg font-black text-white">Diagnóstico de biometría</h1>
        <p className="mt-1 text-xs text-gray-400">
          Qué expone este WebView. Si “navigator.credentials” no existe, Touch ID / Face ID por passkey no puede
          funcionar aquí (no es el hardware: es el WebView).
        </p>

        <div className="mt-4 space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2">
              <span className="text-[11px] font-bold text-gray-400">{r.label}</span>
              <span className={`text-[11px] font-black ${r.ok === undefined ? "text-gray-200" : r.ok ? "text-emerald-400" : "text-amber-400"}`}>
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={copy} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10">
            Copiar resultado
          </button>
          <Link href="/settings" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10">
            Volver a Ajustes
          </Link>
        </div>

        <p className="mt-4 break-all font-mono text-[10px] text-gray-500">{ua}</p>
      </Card>
    </div>
  );
}
