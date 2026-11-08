"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { capacityScenarios, estimateCapacity, formatBunz } from "@/lib/capacity";
import { CONTRACT_VERSION } from "@/lib/contractContent";

type ValidateResponse = {
  ok: boolean;
  error?: string;
  business?: {
    id: string;
    name: string;
    category: string | null;
    niche: string | null;
    address: string | null;
    rewardPercentage: number | null;
  };
  owner?: { name: string; email: string; phone: string };
  legalProfile?: {
    legalName?: string;
    rfc?: string;
    representative?: string;
    representativePosition?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  expiresAt?: string;
};

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-white/25 outline-none transition-colors focus:border-pink-500/60 focus:bg-white/[0.06]";

export default function ReonboardingPage() {
  const params = useParams();
  const token = String((params as Record<string, string>)?.token ?? "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidateResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ capacity: number; businessName: string } | null>(null);

  const [form, setForm] = useState({
    businessName: "",
    legalName: "",
    rfc: "",
    representative: "",
    representativePosition: "CEO",
    address: "",
    email: "",
    phone: "",
    monthlySales: 60_000,
    rewardPercentage: 30,
    coverageMonths: 2,
    signature: "",
    acceptedTerms: false,
  });

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`/api/re-onboarding/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as ValidateResponse;
        if (!alive) return;
        if (!res.ok || !json.ok) {
          setError(
            json.error === "token_used"
              ? "Este enlace ya fue utilizado."
              : json.error === "token_expired"
                ? "Este enlace venció. Pide uno nuevo."
                : "No pudimos validar el enlace de re-onboarding."
          );
          return;
        }
        setData(json);
        const legal = json.legalProfile ?? {};
        setForm((prev) => ({
          ...prev,
          businessName: json.business?.name ?? "",
          legalName: legal.legalName ?? "",
          rfc: legal.rfc ?? "",
          representative: legal.representative ?? "",
          representativePosition: legal.representativePosition ?? "CEO",
          address: legal.address ?? json.business?.address ?? "",
          email: legal.email ?? json.owner?.email ?? "",
          phone: legal.phone ?? json.owner?.phone ?? "",
          rewardPercentage: Number(json.business?.rewardPercentage) || 30,
        }));
      })
      .catch(() => alive && setError("Error de conexión al validar el enlace."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  const capacity = useMemo(
    () =>
      estimateCapacity({
        monthlySales: form.monthlySales,
        rewardPct: form.rewardPercentage,
        months: form.coverageMonths,
      }),
    [form.monthlySales, form.rewardPercentage, form.coverageMonths]
  );
  const scenarios = useMemo(
    () => capacityScenarios(form.monthlySales, form.rewardPercentage),
    [form.monthlySales, form.rewardPercentage]
  );

  const valid =
    form.businessName.trim().length >= 2 &&
    form.legalName.trim().length >= 2 &&
    form.rfc.trim().length >= 10 &&
    form.representative.trim().length >= 3 &&
    form.address.trim().length >= 4 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email) &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    form.rewardPercentage >= 10 &&
    form.rewardPercentage <= 50 &&
    form.signature.trim().length >= 3 &&
    form.acceptedTerms;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/re-onboarding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ...form,
          category: data?.business?.category ?? null,
          contractVersion: CONTRACT_VERSION,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        capacity?: number;
      };
      if (!res.ok || !json.ok) {
        setError(
          json.error === "token_used"
            ? "Este enlace ya fue utilizado."
            : json.error === "token_expired"
              ? "Este enlace venció. Pide uno nuevo."
              : "No pudimos guardar el re-onboarding. Revisa los datos."
        );
        return;
      }
      setDone({
        capacity: Number(json.capacity) || capacity,
        businessName: form.businessName,
      });
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070F] text-white">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Validando enlace…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070F] px-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-300" />
          <h1 className="mt-3 text-xl font-black">Enlace no disponible</h1>
          <p className="mt-2 text-sm text-white/60">{error}</p>
          <Link
            href="https://admin.rabbitty.me"
            className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black"
          >
            Ir al panel
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070F] px-4 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-7 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">
            Re-onboarding completado
          </p>
          <h1 className="mt-1 text-2xl font-black">{done.businessName}</h1>
          <p className="mt-2 text-sm text-white/60">
            Capacidad autorizada: <strong className="text-white">{formatBunz(done.capacity)} Bunz</strong>.
            Los datos legales y la aceptación quedaron registrados.
          </p>
          <Link
            href="https://admin.rabbitty.me"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-pink-600 to-purple-600 px-6 py-3 text-sm font-black text-white"
          >
            Entrar al panel <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070F] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pink-500/30 bg-pink-500/15">
            <Store className="h-5 w-5 text-pink-300" />
          </div>
          <div>
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">
              Re-onboarding
            </p>
            <h1 className="m-0 text-xl font-black">Actualiza tu negocio y tu capacidad</h1>
            <p className="m-0 text-xs text-white/45">
              Enlace de un solo uso para {data?.business?.name ?? "tu negocio"}.
            </p>
          </div>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <p className="m-0 text-[11px] leading-relaxed text-sky-100/80">
            Ya estás registrado. Este enlace no crea otro negocio: actualiza el existente,
            registra tus datos legales y define la capacidad con la que vas a operar.
          </p>
        </div>

        <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <h2 className="m-0 text-sm font-black">Datos del negocio</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nombre del negocio">
                <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Giro / categoría">
                <input value={data?.business?.category ?? ""} readOnly className={`${inputClass} opacity-60`} />
              </Field>
              <Field label="Razón social *">
                <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} className={inputClass} placeholder="Ej. Café 626 SA de CV" />
              </Field>
              <Field label="RFC *">
                <input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })} className={inputClass} placeholder="XAXX010101000" />
              </Field>
              <Field label="Representante legal *">
                <input value={form.representative} onChange={(e) => setForm({ ...form, representative: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Cargo">
                <input value={form.representativePosition} onChange={(e) => setForm({ ...form, representativePosition: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Correo *">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </Field>
              <Field label="WhatsApp *">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Domicilio *" className="sm:col-span-2">
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <h2 className="m-0 text-sm font-black">Capacidad</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label={`Ventas mensuales: $${form.monthlySales.toLocaleString("es-MX")}`}>
                <input
                  type="range"
                  min={10_000}
                  max={500_000}
                  step={5_000}
                  value={form.monthlySales}
                  onChange={(e) => setForm({ ...form, monthlySales: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
              </Field>
              <Field label={`Recompensa: ${form.rewardPercentage}%`}>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={1}
                  value={form.rewardPercentage}
                  onChange={(e) => setForm({ ...form, rewardPercentage: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {scenarios.map((s) => {
                const active = form.coverageMonths === s.months;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm({ ...form, coverageMonths: s.months })}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      active ? "border-pink-500/60 bg-pink-500/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className="m-0 text-[10px] font-black uppercase tracking-wider text-white/40">
                      {s.months} {s.months === 1 ? "mes" : "meses"}
                    </p>
                    <p className="m-0 mt-1 text-sm font-black text-white">{s.label}</p>
                    <p className="m-0 text-[11px] font-bold text-pink-300">{formatBunz(s.capacity)} Bunz</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-4">
              <p className="m-0 text-[10px] font-black uppercase tracking-wider text-pink-300">
                Capacidad propuesta
              </p>
              <p className="m-0 mt-1 text-3xl font-black">
                {formatBunz(capacity)} <span className="text-sm text-white/60">Bunz</span>
              </p>
              <p className="m-0 mt-1 text-[11px] text-white/50">
                Cobertura {form.coverageMonths} {form.coverageMonths === 1 ? "mes" : "meses"} · Recompensa {form.rewardPercentage}%
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <h2 className="m-0 text-sm font-black">Aceptación</h2>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/60">
              <p className="m-0">
                La capacidad no es dinero, depósito ni inversión. Puede incluir un incentivo y
                capacidad adelantada recuperable. La recuperación se propone por ciclo con el
                importe exacto y requiere tu aceptación; nunca se aplica sobre capacidad
                comprometida. La aceptación se registra con tu nombre completo + checkbox.
              </p>
            </div>
            <Field label="Nombre completo del firmante *" className="mt-3">
              <input value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} className={inputClass} placeholder="Nombre completo" />
            </Field>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] text-white/60">
              <input
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                He revisado y acepto el Contrato de Participación {CONTRACT_VERSION}, el Aviso de
                Privacidad y la capacidad propuesta. Declaro ser el representante legal del negocio.{" "}
                <a href="/contrato" target="_blank" rel="noreferrer" className="text-pink-300 underline">
                  Leer contrato completo
                </a>
              </span>
            </label>
          </div>

          {error && (
            <p className="m-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!valid || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-pink-600 to-purple-600 px-5 py-3.5 text-sm font-black text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Guardar re-onboarding
              </>
            )}
          </button>
          <p className="m-0 text-center text-[10px] text-white/35">
            Este enlace se invalida al guardar. Si necesitas otro, pídelo a Rabbitty.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}
