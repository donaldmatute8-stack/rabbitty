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
  const grants = trpc.rabbitChair.grants.useQuery(undefined, { retry: false });
  const status = trpc.rabbitChair.status.useQuery(undefined, { retry: false });
  const metrics = trpc.rabbitChair.metrics.useQuery({}, { retry: false });
  const staffList = trpc.staff.getStaff.useQuery({}, { retry: false });
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
      utils.rabbitChair.grants.invalidate();
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
      toast.success(
        `La Silla abierta · aviso a ${res.notified}/${res.audience}${res.broadcast ? " (masivo)" : ""}`,
      );
      utils.rabbitChair.list.invalidate();
    },
    onError: (e, vars: any) => {
      // Sin audiencia o envío a todos: nunca se manda masivo sin confirmar.
      if (/masivo/i.test(e.message)) {
        const ok = window.confirm(
          "Esta audiencia no tiene historial suficiente o elegiste a todos.\n\n¿Mandar el aviso a los Rabbitters con push activo (máximo 100) y abrir La Silla?",
        );
        if (ok)
          launch.mutate({
            activationId: vars.activationId,
            allowBroadcast: true,
            audience: vars.audience ?? "ALL",
          });
        return;
      }
      toast.error(e.message);
    },
  });
  const settings = trpc.rabbitChair.settings.useMutation({
    onSuccess: () => {
      toast.success("Ajustes guardados");
      utils.rabbitChair.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.rabbitChair.cancel.useMutation({
    onSuccess: () => {
      toast.success("Borrador cancelado. Crédito devuelto.");
      utils.rabbitChair.list.invalidate();
      utils.rabbitChair.credits.invalidate();
      utils.rabbitChair.grants.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [audience, setAudience] = useState<
    "PRESENCE" | "RADIO" | "WAITLIST" | "MEMBERS" | "ALL"
  >(
    "PRESENCE",
  );
  const [form, setForm] = useState({
    name: "La Silla",
    format: "BLOCK",
    capacity: "10",
    partySize: "2",
    waveMinutes: "20",
    chargeMode: "PREPAID",
    cardOnly: true,
    minContribution: "50",
    durationMinutes: "10",
    menuMode: "BOTH",
    playlist: "TERROR",
    lightPreset: "red",
    bartenderMode: "ROTATING",
    windowFrom: "",
    windowTo: "",
    radiusMeters: "1000",
    staffId: "",
    staffMinutes: "",
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

        {/* Historial: de dónde salió cada crédito y en qué activación se usó */}
        {(grants.data?.grants ?? []).length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-white/[0.03] text-[9px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">Otorgado</th>
                  <th className="px-2 py-1.5 text-right">Créditos</th>
                  <th className="px-2 py-1.5 text-right">Usados</th>
                  <th className="px-2 py-1.5 text-right">Restantes</th>
                  <th className="px-2 py-1.5">Vence</th>
                  <th className="px-2 py-1.5">Origen</th>
                  <th className="px-2 py-1.5">Se usó en</th>
                </tr>
              </thead>
              <tbody>
                {(grants.data?.grants ?? []).map((grant: any) => {
                  const left = Math.max(0, Number(grant.creditsTotal) - Number(grant.creditsUsed));
                  const expires = grant.expiresAt ? new Date(grant.expiresAt) : null;
                  const expired = Boolean(expires && expires.getTime() <= Date.now());
                  const revoked = Boolean(grant.revokedAt);
                  const uses = (grant.uses ?? []) as Array<{ activationName?: string | null }>;
                  return (
                    <tr key={grant.id} className="border-t border-white/5">
                      <td className="px-2 py-1.5 text-gray-300">
                        {new Date(grant.createdAt).toLocaleDateString("es-MX")}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold text-gray-200">
                        {grant.creditsTotal}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">{grant.creditsUsed}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-black ${
                          revoked || expired ? "text-gray-500" : left > 0 ? "text-emerald-300" : "text-gray-400"
                        }`}
                      >
                        {revoked ? "Revocado" : expired ? "Vencido" : left}
                      </td>
                      <td className="px-2 py-1.5 text-gray-400">
                        {expires ? expires.toLocaleDateString("es-MX") : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-gray-400">
                        {grant.requestId ? "Solicitud" : "Rabbitty"}
                      </td>
                      <td className="px-2 py-1.5 text-gray-300">
                        {uses.length > 0
                          ? uses
                              .map((use) => use.activationName || "Activación")
                              .filter(Boolean)
                              .join(", ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-gray-500">
            Aún no hay movimientos. Rabbitty otorga créditos por hito.
          </p>
        )}
      </Card>

      {/* Métricas de La Silla */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-sm font-black text-white">Cómo va La Silla</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/reports/rabbit-chair"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-red-200 hover:bg-white/10"
            >
              Reporte de La Silla
            </Link>
            <Link
              href="/reports/products?channel=RABBIT_CHAIR"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-white/10"
            >
              Ver ingresos de La Silla
            </Link>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Ocupación", `${metrics.data?.totals.occupancyPct ?? 0}%`],
            ["Lugares vendidos", metrics.data?.totals.sold ?? 0],
            ["Ingreso", `$${(metrics.data?.totals.revenue ?? 0).toFixed(2)}`],
            ["Aporte promedio", `$${(metrics.data?.totals.avgContribution ?? 0).toFixed(2)}`],
            ["En fila", metrics.data?.totals.waiting ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="m-0 text-sm font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        {(metrics.data?.activations ?? []).length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-white/[0.03] text-[9px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">Activación</th>
                  <th className="px-2 py-1.5">Estado</th>
                  <th className="px-2 py-1.5 text-right">Vendidos</th>
                  <th className="px-2 py-1.5 text-right">Ocupación</th>
                  <th className="px-2 py-1.5 text-right">Ingreso</th>
                  <th className="px-2 py-1.5 text-right">Servicio prom.</th>
                  <th className="px-2 py-1.5 text-right">Fila</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {(metrics.data?.activations ?? []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="px-2 py-1.5 font-bold text-white">{a.name}</td>
                    <td className="px-2 py-1.5">{a.status}</td>
                    <td className="px-2 py-1.5 text-right">{a.sold}/{a.capacity}</td>
                    <td className="px-2 py-1.5 text-right">{a.occupancyPct}%</td>
                    <td className="px-2 py-1.5 text-right">${Number(a.revenue).toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right">{a.avgServiceMin ? `${a.avgServiceMin} min` : "—"}</td>
                    <td className="px-2 py-1.5 text-right">{a.waiting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <input
              type="checkbox"
              checked={form.cardOnly}
              onChange={(e) => setForm({ ...form, cardOnly: e.target.checked })}
              className="h-4 w-4 accent-red-500"
            />
            <span className="text-[11px] font-bold text-gray-300">
              Solo tarjeta (sin efectivo en el POS)
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Empleado extra (opcional)
            </span>
            <Select
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              options={[
                { value: "", label: "Sin staff extra" },
                ...((staffList.data ?? []) as any[])
                  .filter((member) => member.isActive)
                  .map((member) => ({
                    value: member.id,
                    label: `${member.name}${Number(member.hourlyRate) > 0 ? ` · $${Number(member.hourlyRate).toFixed(0)}/h` : ""}`,
                  })),
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Minutos de staff
            </span>
            <Input
              inputMode="numeric"
              placeholder="= duración"
              value={form.staffMinutes}
              onChange={(e) => setForm({ ...form, staffMinutes: e.target.value.replace(/\D/g, "") })}
            />
            {form.staffId && (() => {
              const member = ((staffList.data ?? []) as any[]).find((m) => m.id === form.staffId);
              const minutes =
                Number(form.staffMinutes) || Number(form.durationMinutes) || 10;
              const cost = (Number(member?.hourlyRate ?? 0) * minutes) / 60;
              return (
                <span className="mt-1 block text-[10px] text-gray-500">
                  Costo estimado: ${cost.toFixed(2)}
                </span>
              );
            })()}
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Radio de proximidad (m)
            </span>
            <Input
              inputMode="numeric"
              value={form.radiusMeters}
              onChange={(e) => setForm({ ...form, radiusMeters: e.target.value.replace(/\D/g, "") })}
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
                cardOnly: form.cardOnly,
                minContributionCents: Math.max(5000, (Number(form.minContribution) || 50) * 100),
                durationMinutes: Number(form.durationMinutes) || 10,
                menuMode: form.menuMode as any,
                playlist: form.playlist,
                lightPreset: form.lightPreset,
                bartenderMode: form.bartenderMode as any,
                randomWindowFrom: form.windowFrom ? new Date(form.windowFrom).toISOString() : null,
                randomWindowTo: form.windowTo ? new Date(form.windowTo).toISOString() : null,
                radiusMeters: Number(form.radiusMeters) || 1000,
                staffId: form.staffId || null,
                staffMinutes: form.staffMinutes ? Number(form.staffMinutes) : null,
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
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <p className="m-0 text-sm font-black text-white">Activaciones</p>
          <div className="w-full max-w-xs">
            <Select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              options={[
                { value: "PRESENCE", label: "Presencia reciente" },
                { value: "RADIO", label: "Radio / proximidad" },
                { value: "WAITLIST", label: "Lista de espera" },
                { value: "MEMBERS", label: "Miembros activos" },
                { value: "ALL", label: "Todos con push (masivo)" },
              ]}
            />
            <p className="m-0 mt-1 text-[10px] text-gray-500">
              {audience === "PRESENCE"
                ? "Quienes han estado en el negocio en los últimos 60 días."
                : audience === "RADIO"
                  ? "Quienes han estado en negocios dentro del radio (usa la ubicación del local)."
                  : audience === "WAITLIST"
                  ? "Quienes alguna vez entraron a la fila de La Silla."
                  : audience === "MEMBERS"
                    ? "Miembros con membresía activa y vigente."
                    : "Todos con push activo (máx. 100). Pide confirmación."}
            </p>
          </div>
        </div>
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
                    {Number(a.staffCostCents) > 0
                      ? ` · staff $${(Number(a.staffCostCents) / 100).toFixed(0)}`
                      : ""}
                  </p>
                </div>
                {["DRAFT", "LIVE"].includes(String(a.status)) && (
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                    <input
                      type="checkbox"
                      checked={a.cardOnly !== false}
                      disabled={settings.isPending}
                      onChange={(e) =>
                        settings.mutate({ activationId: a.id, cardOnly: e.target.checked })
                      }
                      className="h-3.5 w-3.5 accent-red-500"
                    />
                    Solo tarjeta
                  </label>
                )}
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
                        onClick={() => launch.mutate({ activationId: a.id, audience })}
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
