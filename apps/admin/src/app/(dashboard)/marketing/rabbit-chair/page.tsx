"use client";

import { useState } from "react";
import Link from "next/link";
import { Armchair, Play, Square, XCircle, Sparkles } from "lucide-react";
import { trpc } from "../../../../lib/trpc-client";
import { Button, Card, Input, Select, toast } from "@rabbitty/ui";

/**
 * ── Panel · Rabbit Chair (La Silla) ─────────────────────────────────────────
 * El negocio crea la activación, la abre y la cierra. Los créditos los otorga
 * Rabbitty (God) por hito; sin crédito activo no se puede abrir.
 */
export default function RabbitChairAdminPage() {
  const utils = trpc.useUtils();
  const credits = trpc.rabbitChair.credits.useQuery(undefined, { retry: false });
  const status = trpc.rabbitChair.status.useQuery(undefined, { retry: false });
  const toggle = trpc.rabbitChair.enable.useMutation({
    onSuccess: (res) => {
      toast.success(res.enabled ? "Rabbit Chair activado" : "Rabbit Chair desactivado");
      utils.rabbitChair.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const list = trpc.rabbitChair.list.useQuery(undefined, { retry: false });

  const activate = trpc.rabbitChair.activate.useMutation({
    onSuccess: () => {
      toast.success("Activación creada");
      utils.rabbitChair.list.invalidate();
      utils.rabbitChair.credits.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const open = trpc.rabbitChair.open.useMutation({
    onSuccess: () => {
      toast.success("La Silla está abierta");
      utils.rabbitChair.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const close = trpc.rabbitChair.close.useMutation({
    onSuccess: () => {
      toast.success("Activación cerrada");
      utils.rabbitChair.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const scheduleRandom = trpc.rabbitChair.scheduleRandom.useMutation({
    onSuccess: (res: any) => {
      toast.success(`Fecha sorteada: ${new Date(res.startsAt).toLocaleString("es-MX")}`);
      utils.rabbitChair.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const launch = trpc.rabbitChair.launch.useMutation({
    onSuccess: (res: any) => {
      toast.success(`La Silla abierta · aviso a ${res.notified}/${res.audience}`);
      utils.rabbitChair.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.rabbitChair.cancel.useMutation({
    onSuccess: () => {
      toast.success("Borrador cancelado. Crédito devuelto.");
      utils.rabbitChair.list.invalidate();
      utils.rabbitChair.credits.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    name: "La Silla",
    format: "BLOCK",
    capacity: "10",
    partySize: "2",
    waveMinutes: "20",
    chargeMode: "PREPAID",
    minContribution: "50",
    durationMinutes: "10",
    menuMode: "BOTH",
    playlist: "TERROR",
    lightPreset: "red",
    bartenderMode: "ROTATING",
    windowFrom: "",
    windowTo: "",
  });

  const remaining = credits.data?.creditsRemaining ?? 0;

  return (
    <div className="space-y-6 p-1">
      <div>
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Experiencia</p>
        <h1 className="mt-1 text-2xl font-black text-white">Rabbit Chair · La Silla</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Una silla, una luz, diez minutos y diez lugares. El cliente no habla: configura y paga desde el
          teléfono. Aquí abres la activación y la operas desde el POS.
        </p>
      </div>

      {/* Activación por el dueño: sin esto el POS no muestra La Silla */}
      <Card className={`p-4 border ${status.data?.enabled ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-sm font-black text-white">
              {status.data?.enabled ? "Rabbit Chair está activo en tu negocio" : "Rabbit Chair está desactivado"}
            </p>
            <p className="m-0 mt-1 max-w-xl text-xs text-gray-400">
              {status.data?.enabled
                ? "El POS muestra La Silla y puedes abrir activaciones."
                : "Hasta que lo actives aquí, el POS no muestra nada y no se puede crear una activación."}
            </p>
          </div>
          <Button
            variant={status.data?.enabled ? "secondary" : "primary"}
            onClick={() => toggle.mutate({ enabled: !status.data?.enabled })}
            disabled={toggle.isPending}
          >
            {toggle.isPending
              ? "Guardando…"
              : status.data?.enabled
                ? "Desactivar"
                : "Activar Rabbit Chair"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="m-0 text-sm font-black text-white">Créditos de activación</p>
              <p className="m-0 text-xs text-gray-400">
                {remaining > 0
                  ? `${remaining} activaciones disponibles`
                  : "Sin créditos. Rabbitty los otorga por hito."}
              </p>
            </div>
          </div>
          <Link
            href="/pos/rabbit-chair"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10"
          >
            Abrir vista del POS
          </Link>
        </div>
      </Card>

      <Card className="p-4">
        <p className="m-0 mb-3 text-sm font-black text-white">Nueva activación</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Nombre</span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Formato</span>
            <Select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              options={[
                { value: "SINGLE", label: "Una silla" },
                { value: "BLOCK", label: "Varias a la vez" },
                { value: "WAVES", label: "Por oleadas" },
                { value: "COUPLES", label: "Parejas" },
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Cupo</span>
            <Input
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, "") })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Aporte mínimo (MXN)
            </span>
            <Input
              inputMode="numeric"
              value={form.minContribution}
              onChange={(e) => setForm({ ...form, minContribution: e.target.value.replace(/\D/g, "") })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Duración (min)
            </span>
            <Input
              inputMode="numeric"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value.replace(/\D/g, "") })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Carta</span>
            <Select
              value={form.menuMode}
              onChange={(e) => setForm({ ...form, menuMode: e.target.value })}
              options={[
                { value: "COFFEE", label: "Solo café" },
                { value: "ALCOHOL", label: "Coctelería" },
                { value: "BOTH", label: "Café y coctelería" },
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Cobro</span>
            <Select
              value={form.chargeMode}
              onChange={(e) => setForm({ ...form, chargeMode: e.target.value })}
              options={[
                { value: "PREPAID", label: "Al tomar el lugar" },
                { value: "POSTPAID", label: "Aporte al final" },
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Bartender</span>
            <Select
              value={form.bartenderMode}
              onChange={(e) => setForm({ ...form, bartenderMode: e.target.value })}
              options={[
                { value: "ROTATING", label: "Sorpresa rotativo" },
                { value: "FIXED", label: "Fijo" },
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Playlist</span>
            <Select
              value={form.playlist}
              onChange={(e) => setForm({ ...form, playlist: e.target.value })}
              options={[
                { value: "TERROR", label: "Terror" },
                { value: "RITUAL", label: "Ritual" },
                { value: "AFTER", label: "After" },
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Ventana aleatoria · desde
            </span>
            <Input
              type="datetime-local"
              value={form.windowFrom}
              onChange={(e) => setForm({ ...form, windowFrom: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Ventana aleatoria · hasta
            </span>
            <Input
              type="datetime-local"
              value={form.windowTo}
              onChange={(e) => setForm({ ...form, windowTo: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              activate.mutate({
                name: form.name,
                format: form.format as any,
                capacity: Number(form.capacity) || undefined,
                partySize: Number(form.partySize) || undefined,
                waveMinutes: form.format === "WAVES" ? Number(form.waveMinutes) || null : null,
                chargeMode: form.chargeMode as any,
                minContributionCents: Math.max(5000, (Number(form.minContribution) || 50) * 100),
                durationMinutes: Number(form.durationMinutes) || 10,
                menuMode: form.menuMode as any,
                playlist: form.playlist,
                lightPreset: form.lightPreset,
                bartenderMode: form.bartenderMode as any,
                randomWindowFrom: form.windowFrom ? new Date(form.windowFrom).toISOString() : null,
                randomWindowTo: form.windowTo ? new Date(form.windowTo).toISOString() : null,
              })
            }
            disabled={activate.isPending || remaining <= 0 || !status.data?.enabled}
          >
            {activate.isPending ? "Creando…" : "Crear activación"}
          </Button>
          {!status.data?.enabled && (
            <p className="m-0 self-center text-[11px] font-bold text-amber-400">
              Activa Rabbit Chair arriba para poder crear activaciones.
            </p>
          )}
          {status.data?.enabled && remaining <= 0 && (
            <p className="m-0 self-center text-[11px] font-bold text-amber-400">
              Sin créditos: pide a Rabbitty que te asigne activaciones.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <p className="m-0 mb-3 text-sm font-black text-white">Activaciones</p>
        {(list.data ?? []).length === 0 ? (
          <p className="m-0 text-xs text-gray-500">Todavía no hay activaciones.</p>
        ) : (
          <div className="space-y-2">
            {(list.data ?? []).map((a: any) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="min-w-0">
                  <p className="m-0 text-xs font-black text-white">
                    {a.name ?? "La Silla"} · {a.status}
                  </p>
                  <p className="m-0 text-[10px] text-gray-500">
                    {a.format} · {a.capacity} lugares · {a.durationMinutes} min
                    {a.startsAt ? ` · ${new Date(a.startsAt).toLocaleString("es-MX")}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.status === "DRAFT" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => scheduleRandom.mutate({ activationId: a.id })}
                        disabled={scheduleRandom.isPending}
                        title="Bunzy elige día y hora dentro de la ventana"
                      >
                        <Sparkles className="mr-1 h-3 w-3" /> Sortear
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => launch.mutate({ activationId: a.id })}
                        disabled={launch.isPending}
                        title="Abre La Silla y avisa a los Rabbitters"
                      >
                        <Play className="mr-1 h-3 w-3" /> Lanzar ahora
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => open.mutate({ activationId: a.id })}>
                        Abrir sin aviso
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => cancel.mutate({ activationId: a.id })}>
                        <XCircle className="mr-1 h-3 w-3" /> Cancelar
                      </Button>
                    </>
                  )}
                  {a.status === "LIVE" && (
                    <Button size="sm" variant="secondary" onClick={() => close.mutate({ activationId: a.id })}>
                      <Square className="mr-1 h-3 w-3" /> Cerrar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
