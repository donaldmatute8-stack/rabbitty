"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/features/auth/AuthProvider";
import { PlatformBridge } from "@/lib/platform";

/**
 * ── Rabbit Chair · La Silla (app) ───────────────────────────────────────────
 * El Rabbiter ve si hay una silla abierta, toma su lugar, configura la bebida
 * sin hablar y recibe su pase con QR.
 */

/**
 * Salida visible de la pantalla. En nativo el gesto de swipe-right funciona,
 * pero no es descubrible: esta flecha da una salida explícita a cualquiera.
 */
function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Volver atrás"
      onClick={() => {
        void PlatformBridge.hapticFeedback("light");
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/");
      }}
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      className="absolute left-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-xs font-black text-white backdrop-blur-md active:scale-95"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver
    </button>
  );
}

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
  branchId?: string | null;
  branchName?: string | null;
  freeSlots?: number;
  soldOut?: boolean;
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
  const branchFromLink = params.get("branch") || "";
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [branch, setBranch] = useState(branchFromLink);
  const [state, setState] = useState<{
    enabled: boolean;
    activation: Activation | null;
    freeSlots: number;
    soldOut?: boolean;
    activations?: Activation[];
  } | null>(null);
  const [slot, setSlot] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [waitlisted, setWaitlisted] = useState<{ position: number } | null>(null);
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
      const query = new URLSearchParams({ businessId });
      if (branch) query.set("branchId", branch);
      const res = await fetch(`/api/rabbit-chair?${query.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setState(data);
      if (data?.activation?.id && userId) {
        const pass = await fetch(
          `/api/rabbit-chair/slot?activationId=${encodeURIComponent(data.activation.id)}`,
          { headers: await headers(), cache: "no-store" },
        ).then((r) => r.json());
        if (pass?.slot) setSlot(pass.slot);
      } else {
        setSlot(null);
      }
    } catch {
      setError("No se pudo cargar La Silla.");
    } finally {
      setLoading(false);
    }
  }, [businessId, branch, userId, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  // PREPAID: mientras se paga en Stripe, refrescamos el lugar hasta verlo PAID.
  useEffect(() => {
    if (!state?.activation || !user?.id) return;
    if (state.activation.chargeMode !== "PREPAID") return;
    if (slot?.paidCents) return;
    const id = setInterval(async () => {
      try {
        const pass = await fetch(
          `/api/rabbit-chair/slot?activationId=${encodeURIComponent(state.activation!.id)}`,
          { headers: await headers(), cache: "no-store" },
        ).then((r) => r.json());
        if (pass?.slot?.paidCents) setSlot(pass.slot);
      } catch {
        /* sin red: seguimos */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [state?.activation, slot?.paidCents, user?.id, headers]);

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

  const joinQueue = async () => {
    if (!state?.activation) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rabbit-chair/waitlist", {
        method: "POST",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ activationId: state.activation.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo entrar a la fila.");
        return;
      }
      setWaitlisted({ position: Number(data.position) });
      await PlatformBridge.hapticFeedback("success");
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const pay = async () => {
    if (!state?.activation || !slot) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rabbit-chair/checkout", {
        method: "POST",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ activationId: state.activation.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setError(data?.error || "No se pudo iniciar el pago.");
        return;
      }
      await PlatformBridge.openExternalUrl(data.url);
    } catch {
      setError("Error de conexión con el pago.");
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
      <main className="relative flex min-h-screen items-center justify-center bg-black px-6 text-center">
        <BackButton />
        <p className="text-sm text-gray-400">Este enlace no tiene negocio. Pide el enlace al local.</p>
      </main>
    );
  }

  const openActivations = state?.activations ?? [];
  if (state?.enabled && openActivations.length > 1 && !branch) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
        <BackButton />
        <div className="w-full max-w-lg">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-500">Rabbit Chair</p>
          <h1 className="mt-2 text-3xl font-black">¿En qué sucursal?</h1>
          <p className="mt-2 text-sm text-gray-400">
            Hay más de una silla abierta. Elige la sucursal donde estás.
          </p>
          <div className="mt-6 space-y-2">
            {openActivations.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => setBranch(String(candidate.branchId || ""))}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.08]"
              >
                <span>
                  <span className="block text-sm font-black">{candidate.branchName || candidate.name}</span>
                  <span className="block text-[11px] text-gray-400">
                    {candidate.soldOut
                      ? "Silla llena · lista de espera"
                      : `${candidate.freeSlots ?? 0} lugares libres`}
                  </span>
                </span>
                <span className="text-xs font-black text-red-400">Entrar</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!state?.enabled || !state?.activation) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-black px-6 text-center">
        <BackButton />
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
    <main className="relative min-h-screen bg-black px-5 pb-8 pt-16 text-white">
      <BackButton />
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-500">Rabbit Chair · La Silla</p>
        <h1 className="mt-2 text-3xl font-black">{activation.name}</h1>
        <p className="mt-2 text-sm text-gray-400">
          {state.freeSlots > 0 ? `${state.freeSlots} lugares libres` : "Silla llena"} · mínimo $
          {(activation.minContributionCents / 100).toFixed(0)} · {activation.durationMinutes} min
          {activation.requiresAgeCheck ? " · +18" : ""}
        </p>

        {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{error}</p>}

        {!user?.id ? (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
            Entra a tu cuenta de Rabbitty para tomar la silla.
          </p>
        ) : !slot ? (
          state.freeSlots <= 0 ? (
            waitlisted ? (
              <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5 text-center">
                <p className="m-0 text-sm font-black text-purple-200">Estás en la fila (#{waitlisted.position})</p>
                <p className="m-0 mt-1 text-xs text-purple-300/80">
                  Si se libera un lugar, te avisamos por push y tendrás 10 minutos para tomarlo.
                </p>
              </div>
            ) : (
              <button
                onClick={joinQueue}
                disabled={saving}
                className="mt-6 w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3.5 text-sm font-black text-purple-200 disabled:opacity-50"
              >
                {saving ? "Entrando a la fila…" : "Silla llena · entrar a la lista de espera"}
              </button>
            )
          ) : (
            <button
              onClick={claim}
              disabled={saving}
              className="mt-6 w-full rounded-full bg-red-600 px-6 py-3.5 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? "Tomando lugar…" : "Tomar la silla"}
            </button>
          )
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

            {/* Pago del aporte (PREPAID) */}
            {slot.config && activation.chargeMode === "PREPAID" && !slot.paidCents && (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Aporte</p>
                <p className="mt-2 text-sm text-gray-300">
                  Mínimo ${(activation.minContributionCents / 100).toFixed(0)} · pago seguro con tarjeta
                </p>
                <button
                  onClick={pay}
                  disabled={saving}
                  className="mt-4 w-full rounded-full bg-white px-6 py-3 text-sm font-black text-black disabled:opacity-40"
                >
                  {saving ? "Abriendo pago…" : "Pagar aporte"}
                </button>
                <p className="mt-2 text-[10px] text-gray-500">
                  Al terminar el pago, esta pantalla se actualiza sola.
                </p>
              </div>
            )}

            {/* Pase */}
            {slot.config && (activation.chargeMode !== "PREPAID" || slot.paidCents) && (
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
