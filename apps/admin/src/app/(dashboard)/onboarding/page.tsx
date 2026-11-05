"use client";

/**
 * ── Bienvenida / re-onboarding (tenants existentes) ──
 *
 * No vuelve a pedir datos: muestra lo que YA está inyectado (sucursales,
 * personal, menú) y permite confirmar el giro. Al terminar, el dueño entra a su
 * panel completo.
 *
 * El checklist de "Preparación del Negocio" también se reinicia aquí para que lo
 * vea fresco con sus pasos ya detectados.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../../lib/trpc-client";
import { Button, Card, toast } from "@rabbitty/ui";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, Store, Users, Utensils, GitBranch } from "lucide-react";
import { BunzyVideoStage } from "../../../components/BunzyVideoStage";

export default function OnboardingPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const status = trpc.admin.onboardingStatus.useQuery(undefined, { retry: false });
  const niches = trpc.admin.onboardingNiches.useQuery(undefined, { retry: false });

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (status.data?.business?.niche) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(status.data.business.niche);
    }
  }, [status.data?.business?.niche]);

  const business = status.data?.business ?? null;
  const counts = status.data?.counts ?? null;

  const complete = trpc.admin.completeOnboarding.useMutation({
    onSuccess: async () => {
      // Refresca el estado ANTES de navegar: el gate no debe rebotarlo.
      await utils.admin.onboardingStatus.refetch();

      // Checklist fresco (los pasos se auto-detectan con sus datos reales).
      try {
        localStorage.removeItem("rabbitty_onboarding_completed");
        window.dispatchEvent(new Event("rabbitty-readiness-sync"));
      } catch {
        /* sin localStorage: no es crítico */
      }

      toast.success("Todo listo. Bienvenido a tu panel.");
      router.replace("/");
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedNiche = useMemo(
    () => niches.data?.find((n) => n.id === selected) ?? null,
    [niches.data, selected],
  );

  const canConfirm = Boolean(selected) && !complete.isPending;

  if (status.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando tu negocio…
      </div>
    );
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="p-6 text-center">
          <p className="m-0 text-sm font-bold">No encontramos un negocio asociado a tu cuenta</p>
          <p className="m-0 mt-1 text-xs text-gray-500">
            Si ya tienes un negocio, entra desde la cuenta que lo registró o contacta a soporte.
          </p>
          <Button className="mt-4" onClick={() => router.replace("/")}>
            Volver al panel
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Bunzy Video Stage - Re-onboarding & Bienvenida */}
      <BunzyVideoStage
        videoSrc="/videos/bunzy/bunzy-1-hi.mp4"
        poster="/videos/bunzy/bunzy-1-hi.jpg"
        stepLabel="Paso 1 · Bienvenida"
        title={`${business.name} está listo`}
        description="Confirma tu tipo de negocio para habilitar tus módulos de mesas, cocina o caja. Tu historial, personal y productos siguen intactos."
      />

      {/* Resumen de infraestructura inyectada */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-gray-900 via-black to-gray-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="m-0 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-pink-400">
            <Sparkles className="h-3.5 w-3.5" /> Tu configuración actual
          </p>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            En vivo
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: GitBranch, label: "Sucursales", value: counts?.branches ?? "—" },
            { icon: Users, label: "Personal", value: counts?.staff ?? "—" },
            { icon: Utensils, label: "Platillos", value: counts?.menu ?? "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-center sm:text-left">
              <item.icon className="h-4 w-4 text-cyan-300 mx-auto sm:mx-0" />
              <p className="m-0 mt-1.5 text-xl font-black text-white">{item.value}</p>
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Nicho */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Store className="h-4 w-4 text-pink-500" />
          <p className="m-0 text-sm font-black">Confirma tu tipo de negocio</p>
        </div>
        <p className="m-0 mb-3 text-xs text-gray-500">
          De aquí salen tus módulos: mesas, cocina, citas, inventario… Puedes cambiarlo después.
        </p>

        {niches.isLoading ? (
          <p className="m-0 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando giros…
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(niches.data ?? []).map((n) => {
              const active = selected === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelected(n.id)}
                  className={`rounded-2xl border p-3 text-left transition-all ${
                    active
                      ? "border-pink-500/60 bg-pink-500/10"
                      : "border-gray-200 hover:border-pink-400/40 dark:border-white/10 dark:hover:border-pink-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black">{n.name}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-pink-500" />}
                  </div>
                  {n.description && (
                    <span className="mt-1 block line-clamp-2 text-[10.5px] leading-snug text-gray-500">
                      {n.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedNiche && (
          <p className="m-0 mt-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            Vas con {selectedNiche.name}. Tu operación existente se conserva.
          </p>
        )}
      </Card>

      {/* CTA */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" disabled={!canConfirm} onClick={() => complete.mutate({ niche: selected ?? undefined })}>
          {complete.isPending ? "Guardando…" : "Confirmar y entrar"} <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={complete.isPending}
          onClick={() => complete.mutate({ niche: undefined })}
        >
          Saltar por ahora
        </Button>
      </div>

      <p className="m-0 text-center text-[10.5px] text-gray-500">
        Esto solo cambia el giro si eliges otro. Tus ventas, menú, personal y configuración quedan intactos.
      </p>
    </div>
  );
}
