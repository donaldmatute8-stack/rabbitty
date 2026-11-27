"use client";

import { useState } from "react";
import { AlertTriangle, Coins, HandCoins, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Dialog, toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

/**
 * ── God · Economía del fondo (La Madriguera) ────────────────────────────────
 *
 * UN SOLO interruptor enciende las tres piezas que dependen del fondo:
 *   1. el bono de referido se paga desde `sys_growth_fund`,
 *   2. el co-op del afiliado se fondea (`MINT biz_ → fondo`),
 *   3. el match de plataforma se fondea (`MINT sys_treasury → fondo`).
 *
 * Sin ese interruptor no corre ninguna: no tiene sentido pagar desde un fondo
 * vacío ni fondear un fondo que no paga. Apagado = camino legado de 50 Bunz.
 * Todo exige identidad God, 2FA del servidor, frase exacta y queda auditado.
 */
export function GrowthFundPanel() {
  const utils = trpc.useUtils();
  const status = trpc.god.getGrowthFundReferralStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const preview = trpc.god.getGrowthFundFundingPreview.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ── Interruptor (activación / desactivación) ──
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [phrase, setPhrase] = useState("");
  const [fundOnActivate, setFundOnActivate] = useState(true);

  // ── Fondeo manual ──
  const [fundOpen, setFundOpen] = useState(false);
  const [fundEmail, setFundEmail] = useState("");
  const [fundPhrase, setFundPhrase] = useState("");
  const [fundReason, setFundReason] = useState("");

  const expectedPhrase = target ? "ACTIVAR REFERIDOS" : "DESACTIVAR REFERIDOS";
  const refresh = () => {
    void utils.god.getGrowthFundReferralStatus.invalidate();
    void utils.god.getGrowthFundFundingPreview.invalidate();
  };

  const mutation = trpc.god.setGrowthFundReferralPayouts.useMutation({
    onSuccess: (res: any) => {
      const funded = res?.funding && !res.funding.skipped ? Number(res.funding.mintedTotal ?? 0) : 0;
      toast.success(
        res.enabled
          ? `Economía del fondo activada${funded > 0 ? ` · fondeados ${funded.toLocaleString("es-MX")} Bunz` : ""}`
          : "Economía del fondo desactivada",
      );
      setOpen(false);
      refresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const fundMutation = trpc.god.fundGrowthCoopMatch.useMutation({
    onSuccess: (res: any) => {
      if (res?.skipped) {
        toast.info("El fondo ya cubre el objetivo del periodo; no se fondeó de más.");
      } else {
        toast.success(`Fondeo ejecutado · ${Number(res?.mintedTotal ?? 0).toLocaleString("es-MX")} Bunz`);
      }
      setFundOpen(false);
      setFundPhrase("");
      setFundReason("");
      refresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const start = (enabled: boolean) => {
    setTarget(enabled);
    setStep(1);
    setAck(false);
    setReason("");
    setEmail("");
    setPhrase("");
    setFundOnActivate(true);
    setOpen(true);
  };

  const data = status.data;
  const enabled = Boolean(data?.enabled);
  const fundBalance = Number(data?.fundBalance ?? 0);
  const pendingCount = Number(data?.pendingCount ?? 0);

  const coopTotal = Number(preview.data?.coopTotal ?? 0);
  const matchTotal = Number(preview.data?.matchTotal ?? 0);
  const deficit = Number(preview.data?.deficit ?? 0);
  const planned = coopTotal + matchTotal;
  const coopLines = (preview.data?.coop ?? []).filter(
    (c: { available: boolean; amount: number }) => c.available && c.amount > 0,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-300">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="m-0 text-sm font-black text-white">
                Economía del fondo · referidos + co-op + match
              </p>
              <p className="m-0 mt-1 max-w-2xl text-[11px] leading-relaxed text-gray-400">
                {enabled
                  ? "Activo: los referidos se pagan desde sys_growth_fund y el co-op/match pueden fondearlo. Si el fondo no alcanza, el referido queda PENDING y se reintenta."
                  : "Apagado: los referidos siguen pagando 50 Bunz por el camino actual y el co-op/match no se ejecutan. Un solo interruptor enciende las tres piezas."}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
              enabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            {enabled ? "Activo" : "Apagado"}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-gray-500">Fondo disponible</p>
            <p className="m-0 text-sm font-black text-white">{fundBalance.toLocaleString("es-MX")} Bunz</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-gray-500">Referidos pendientes</p>
            <p className="m-0 text-sm font-black text-white">
              {pendingCount} · {Number(data?.pendingAmount ?? 0).toLocaleString("es-MX")} Bunz
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-gray-500">Faltante del periodo</p>
            <p className="m-0 text-sm font-black text-white">{deficit.toLocaleString("es-MX")} Bunz</p>
          </div>
        </div>

        {!enabled && fundBalance < Number(data?.referralAmount ?? 50) && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            El fondo aún no alcanza para un bono. Puedes activar y fondear co-op/match en la misma acción.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={enabled ? "secondary" : "primary"} onClick={() => start(!enabled)}>
            {enabled ? "Desactivar economía del fondo" : "Activar economía del fondo"}
          </Button>
          <span className="self-center text-[10px] text-gray-500">
            Solo God · 2FA · doble confirmación
          </span>
        </div>
      </div>

      {/* ── Fondeo co-op + match (mismo interruptor) ── */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <p className="m-0 text-sm font-black text-white">Fondeo co-op + match</p>
              <p className="m-0 mt-1 max-w-2xl text-[11px] leading-relaxed text-gray-400">
                Co-op: el afiliado aporta capacidad promo (<code>biz_ → fondo</code>, MINT).
                Match: la plataforma aporta presupuesto (<code>sys_treasury → fondo</code>, MINT).
                Corre con el mismo interruptor y es idempotente por mes.
              </p>
            </div>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
              enabled
                ? planned > 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-gray-400"
                : "border-white/10 bg-white/5 text-gray-500"
            }`}
          >
            {!enabled ? "Requiere interruptor" : planned > 0 ? "Listo" : "Sin aportes"}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-gray-500">Co-op del mes</p>
            <p className="m-0 text-sm font-black text-white">{coopTotal.toLocaleString("es-MX")} Bunz</p>
            {coopLines.length === 0 ? (
              <p className="m-0 mt-1 text-[10px] text-gray-500">Sin afiliados pendientes de aportar.</p>
            ) : (
              <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
                {coopLines.slice(0, 4).map((c: any) => (
                  <li key={c.businessId} className="text-[10px] text-gray-400">
                    {c.name} · {Number(c.promoAuthorized).toLocaleString("es-MX")} × {Math.round(c.pct * 100)}% ={" "}
                    <span className="font-bold text-gray-200">{Number(c.amount).toLocaleString("es-MX")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-gray-500">Match del mes</p>
            <p className="m-0 text-sm font-black text-white">{matchTotal.toLocaleString("es-MX")} Bunz</p>
            <p className="m-0 mt-1 text-[10px] text-gray-500">
              {preview.data?.match?.available
                ? `Presupuesto ${Number(preview.data.match.budgeted).toLocaleString("es-MX")} · usado ${Number(
                    preview.data.match.spent,
                  ).toLocaleString("es-MX")}`
                : "Sin presupuesto de plataforma para este periodo."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={!enabled || planned <= 0}
            title={
              !enabled
                ? "Activa primero la economía del fondo"
                : planned <= 0
                  ? "No hay co-op ni match que fondear este mes"
                  : "Ejecuta los asientos MINT del periodo"
            }
            onClick={() => {
              setFundOpen(true);
              setFundEmail("");
              setFundPhrase("");
              setFundReason("");
            }}
          >
            Fondear ahora
          </Button>
          <span className="text-[10px] text-gray-500">
            {!enabled
              ? "Se habilita con el mismo interruptor de referidos."
              : planned <= 0
                ? "Sin aportes programados este mes."
                : `Fondearía ${planned.toLocaleString("es-MX")} Bunz (co-op ${coopTotal.toLocaleString(
                    "es-MX",
                  )} + match ${matchTotal.toLocaleString("es-MX")}).`}
          </span>
        </div>
      </div>

      {/* ── Diálogo: activar / desactivar ── */}
      <Dialog
        open={open}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        kicker="God · identidad y tesorería"
        title={target ? "Activar economía del fondo" : "Desactivar economía del fondo"}
      >
        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/85">
              <p className="m-0 flex items-center gap-1.5 font-black">
                <AlertTriangle className="h-3.5 w-3.5" /> Antes de continuar
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  {target
                    ? "Un solo interruptor: activa el pago de referidos desde el fondo Y el fondeo co-op/match."
                    : "Al desactivarlo, el bono vuelve al camino legado de 50 Bunz y el co-op/match deja de ejecutarse."}
                </li>
                <li>
                  {target
                    ? "Si el fondo no tiene saldo, el referido queda PENDING. No se emite de la nada."
                    : "Los referidos que ya están PENDING se pagarán por el camino legado."}
                </li>
                <li>El monto del referido es 50 Bunz y no cambia con este interruptor.</li>
                <li>La acción queda auditada con tu usuario, motivo y fecha.</li>
              </ul>
            </div>

            {target && coopLines.length + (matchTotal > 0 ? 1 : 0) > 0 && (
              <label className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                <input
                  type="checkbox"
                  checked={fundOnActivate}
                  onChange={(e) => setFundOnActivate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-500"
                />
                <span className="text-[11px] leading-snug text-gray-300">
                  <span className="flex items-center gap-1 font-black text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" /> Fondear co-op + match en la misma acción
                  </span>
                  Aportaría ~{planned.toLocaleString("es-MX")} Bunz al fondo (co-op{" "}
                  {coopTotal.toLocaleString("es-MX")} + match {matchTotal.toLocaleString("es-MX")}). Si el fondo ya
                  cubre el objetivo del mes, se omite.
                </span>
              </label>
            )}

            <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pink-500"
              />
              <span className="text-[11px] leading-snug text-gray-300">
                Entiendo el efecto en tesorería y confirmo que el fondo está listo para operar.
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
                Motivo (obligatorio, mínimo 10 caracteres)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={300}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-pink-500"
                placeholder="Ej. Piloto 626 con fondo fondeado; activación autorizada por el fundador."
              />
            </label>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!ack || reason.trim().length < 10}
                onClick={() => setStep(2)}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="m-0 flex items-center gap-1.5 text-[11px] font-black text-white">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Confirmación de identidad God
              </p>
              <p className="m-0 mt-1 text-[10px] leading-relaxed text-gray-400">
                Escribe tu correo God y la frase exacta. La sesión ya está validada; la mutación
                vuelve a exigir 2FA en el servidor.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
                Tu correo God
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-pink-500"
                placeholder="tu-correo@rabbitty.me"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
                Escribe: <span className="text-pink-300">{expectedPhrase}</span>
              </span>
              <input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm font-black tracking-wider text-white outline-none focus:border-pink-500"
                placeholder={expectedPhrase}
                autoComplete="off"
              />
            </label>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)} disabled={mutation.isPending}>
                Atrás
              </Button>
              <Button
                className="flex-1"
                variant={target ? "primary" : "danger"}
                disabled={
                  mutation.isPending ||
                  !email.includes("@") ||
                  phrase.trim().toUpperCase() !== expectedPhrase
                }
                onClick={() =>
                  mutation.mutate({
                    enabled: target,
                    identityEmail: email.trim(),
                    confirmation: phrase.trim(),
                    reason: reason.trim(),
                    fundCoopMatch: target ? fundOnActivate : false,
                  })
                }
              >
                {mutation.isPending ? "Guardando…" : target ? "Activar con identidad" : "Desactivar con identidad"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Diálogo: fondear ahora ── */}
      <Dialog
        open={fundOpen}
        onClose={() => {
          if (!fundMutation.isPending) setFundOpen(false);
        }}
        kicker="God · tesorería del fondo"
        title="Fondear co-op + match"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-[11px] leading-relaxed text-emerald-100/85">
            <p className="m-0 flex items-center gap-1.5 font-black">
              <HandCoins className="h-3.5 w-3.5" /> Asientos del mes
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Co-op: {coopTotal.toLocaleString("es-MX")} Bunz (MINT desde cada afiliado activo).</li>
              <li>Match: {matchTotal.toLocaleString("es-MX")} Bunz (MINT desde sys_treasury).</li>
              <li>Idempotente: si ya se fondeó este mes, no se duplica.</li>
              <li>Si el fondo ya cubre el objetivo ({Number(preview.data?.target ?? 0).toLocaleString("es-MX")} Bunz), se omite.</li>
            </ul>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Motivo (obligatorio, mínimo 10 caracteres)
            </span>
            <textarea
              value={fundReason}
              onChange={(e) => setFundReason(e.target.value)}
              rows={3}
              maxLength={300}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              placeholder="Ej. Fondeo del mes con capacidad promo de 626 y presupuesto aprobado."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Tu correo God
            </span>
            <input
              type="email"
              value={fundEmail}
              onChange={(e) => setFundEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="tu-correo@rabbitty.me"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">
              Escribe: <span className="text-emerald-300">FONDAR COOP Y MATCH</span>
            </span>
            <input
              value={fundPhrase}
              onChange={(e) => setFundPhrase(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm font-black tracking-wider text-white outline-none focus:border-emerald-500"
              placeholder="FONDAR COOP Y MATCH"
              autoComplete="off"
            />
          </label>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setFundOpen(false)} disabled={fundMutation.isPending}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={
                fundMutation.isPending ||
                !fundEmail.includes("@") ||
                fundPhrase.trim().toUpperCase() !== "FONDAR COOP Y MATCH" ||
                fundReason.trim().length < 10
              }
              onClick={() =>
                fundMutation.mutate({
                  identityEmail: fundEmail.trim(),
                  confirmation: fundPhrase.trim(),
                  reason: fundReason.trim(),
                })
              }
            >
              {fundMutation.isPending ? "Fondeando…" : "Ejecutar fondeo"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
