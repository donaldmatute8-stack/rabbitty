"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/features/auth/AuthProvider";
import { PlatformBridge } from "@/lib/platform";

/**
 * ── Rabbit Chair · La Silla (app) ───────────────────────────────────────────
 * El Rabbiter ve si hay una silla abierta, toma su lugar, configura la bebida
 * sin hablar y recibe su pase con QR.
 */

const CONFIG_STEPS: Array<{ key: string; label: string; options: string[] }> = [
  { key: "base", label: "Base", options: ["Espresso", "Filtrado", "Cold brew"] },
  { key: "intensidad", label: "Intensidad", options: ["Suave", "Media", "Oscura"] },
  { key: "textura", label: "Textura", options: ["Solo", "Leche", "Espuma"] },
  { key: "temperatura", label: "Temperatura", options: ["Caliente", "Frío"] },
  { key: "dulzor", label: "Dulzor", options: ["Sin", "Poco", "Punto"] },
  { key: "aroma", label: "Aroma", options: ["Vainilla", "Cacao", "Cítrico", "Ninguno"] },
  { key: "extra", label: "Extra", options: ["Shot extra", "Sin lactosa", "Hielo grande", "Ninguno"] },
];

type Activation = {
  id: string;
  name: string;
  format: string;
  capacity: number;
  minContributionCents: number;
  durationMinutes: number;
  menuMode: string;
  chargeMode: string;
  requiresAgeCheck: boolean;
  playlist?: string | null;
};

export default function RabbitChairPage() {
  const params = useSearchParams();
  const businessId = params.get("business") || "";
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<{
    enabled: boolean;
    activation: Activation | null;
    freeSlots: number;
  } | null>(null);
  const [slot, setSlot] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const headers = useMemo(
    () => async () => PlatformBridge.getAuthHeaders(),
    [],
  );

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/rabbit-chair?businessId=${encodeURIComponent(businessId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setState(data);
      if (data?.activation?.id && user?.id) {
        const pass = await fetch(
          `/api/rabbit-chair/slot?activationId=${encodeURIComponent(data.activation.id)}`,
          { headers: await headers(), cache: "no-store" },
        ).then((r) => r.json());
        if (pass?.slot) setSlot(pass.slot);
      }
    } catch {
      setError("No se pudo cargar La Silla.");
    } finally {
      setLoading(false);
    }
  }, [businessId, user?.id, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async () => {
    if (!state?.activation) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/rabbit-chair/claim", {
        method: "POST",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ activationId: state.activation.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo tomar el lugar.");
        return;
      }
      setSlot(data.slot);
      await PlatformBridge.hapticFeedback("success");
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!slot) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rabbit-chair/config", {
        method: "POST",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, config }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo guardar tu configuración.");
        return;
      }
      setSlot({ ...slot, config });
      await PlatformBridge.hapticFeedback("success");
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">Cargando La Silla…</main>;
  }

  if (!businessId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center">
        <p className="text-sm text-gray-400">Este enlace no tiene negocio. Pide el enlace al local.</p>
      </main>
    );
  }

  if (!state?.enabled || !state?.activation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-500">Rabbit Chair</p>
          <h1 className="mt-3 text-3xl font-black text-white">No hay una silla abierta</h1>
          <p className="mt-3 text-sm text-gray-400">
            Cuando el lugar la abra, te avisamos. No hay fecha: el que llega, llega.
          </p>
        </div>
      </main>
    );
  }

  const activation = state.activation;
  const configComplete = CONFIG_STEPS.every((step) => Boolean(config[step.key]));

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-500">Rabbit Chair · La Silla</p>
        <h1 className="mt-2 text-3xl font-black">{activation.name}</h1>
        <p className="mt-2 text-sm text-gray-400">
          {state.freeSlots} lugares libres · mínimo ${(activation.minContributionCents / 100).toFixed(0)} ·{" "}
          {activation.durationMinutes} min
          {activation.requiresAgeCheck ? " · +18" : ""}
        </p>

        {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{error}</p>}

        {!user?.id ? (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
            Entra a tu cuenta de Rabbitty para tomar la silla.
          </p>
        ) : !slot ? (
          <button
            onClick={claim}
            disabled={saving || state.freeSlots <= 0}
            className="mt-6 w-full rounded-full bg-red-600 px-6 py-3.5 text-sm font-black text-white disabled:opacity-50"
          >
            {state.freeSlots <= 0 ? "Silla llena" : saving ? "Tomando lugar…" : "Tomar la silla"}
          </button>
        ) : (
          <>
            {/* Configurador silencioso */}
            <div className="mt-6 space-y-4">
              {CONFIG_STEPS.map((step) => (
                <div key={step.key}>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">{step.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {step.options.map((option) => {
                      const active = config[step.key] === option;
                      return (
                        <button
                          key={option}
                          onClick={() => setConfig((c) => ({ ...c, [step.key]: option }))}
                          className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                            active
                              ? "border-red-500 bg-red-500 text-white"
                              : "border-white/15 bg-white/[0.04] text-white/75"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={saveConfig}
                disabled={saving || !configComplete}
                className="w-full rounded-full bg-white px-6 py-3 text-sm font-black text-black disabled:opacity-40"
              >
                {saving ? "Guardando…" : "Guardar y ver mi pase"}
              </button>
            </div>

            {/* Pase */}
            {slot.config && (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Tu pase</p>
                <p className="mt-2 text-2xl font-black">Lugar #{slot.index}</p>
                <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
                  <QRCodeSVG value={`rabbit-chair:${slot.id}`} size={160} level="M" />
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  Llega, siéntate en la silla y muestra este pase. No hables: tu bebida ya está configurada.
                </p>
                <p className="mt-2 text-[10px] text-gray-500">
                  Aporte mínimo ${(activation.minContributionCents / 100).toFixed(0)} ·{" "}
                  {activation.chargeMode === "PREPAID" ? "se cobra en el local" : "se cobra al final"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
