"use client";

import { useState } from "react";
import { AlertTriangle, Coins, ShieldCheck } from "lucide-react";
import { Button, Dialog, toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

/**
 * ── God · pagos de referido desde el fondo ──────────────────────────────────
 * Apagado por defecto. Mientras esté apagado, los referidos siguen pagando
 * 50 Bunz por el camino legado. Encenderlo exige doble confirmación e
 * identidad God; la mutación vuelve a exigir 2FA y deja auditoría.
 */
export function GrowthFundPanel() {
  const utils = trpc.useUtils();
  const status = trpc.god.getGrowthFundReferralStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [phrase, setPhrase] = useState("");

  const expectedPhrase = target ? "ACTIVAR REFERIDOS" : "DESACTIVAR REFERIDOS";

  const mutation = trpc.god.setGrowthFundReferralPayouts.useMutation({
    onSuccess: (res) => {
      toast.success(res.enabled ? "Pagos desde el fondo activados" : "Pagos desde el fondo desactivados");
      setOpen(false);
      void utils.god.getGrowthFundReferralStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const start = (enabled: boolean) => {
    setTarget(enabled);
    setStep(1);
    setAck(false);
    setReason("");
    setEmail("");
    setPhrase("");
    setOpen(true);
  };

  const data = status.data;
  const enabled = Boolean(data?.enabled);
  const fundBalance = Number(data?.fundBalance ?? 0);
  const pendingCount = Number(data?.pendingCount ?? 0);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-300">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="m-0 text-sm font-black text-white">Referidos · pago desde el fondo</p>
              <p className="m-0 mt-1 max-w-2xl text-[11px] leading-relaxed text-gray-400">
                {enabled
                  ? "Activo: el bono de referido sale de sys_growth_fund. Si el fondo no alcanza, el referido queda PENDING y se reintenta."
                  : "Apagado: los referidos siguen pagando 50 Bunz por el camino actual. El fondo no se toca."}
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
            <p className="m-0 text-sm font-black text-white">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-gray-500">Bono actual</p>
            <p className="m-0 text-sm font-black text-white">{Number(data?.referralAmount ?? 50)} Bunz</p>
          </div>
        </div>

        {!enabled && fundBalance < Number(data?.referralAmount ?? 50) && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            El fondo aún no alcanza para un bono. Si lo activas ahora, los referidos quedarán en PENDING.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={enabled ? "secondary" : "primary"} onClick={() => start(!enabled)}>
            {enabled ? "Desactivar pagos desde el fondo" : "Activar pagos desde el fondo"}
          </Button>
          <span className="self-center text-[10px] text-gray-500">
            Solo God · 2FA · doble confirmación
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-sm font-black text-white">Fondeo co-op + match</p>
            <p className="m-0 mt-1 max-w-2xl text-[11px] leading-relaxed text-gray-400">
              Preparado, no activo. Se habilita cuando los pagos de referido estén activos y el
              contrato del afiliado y el presupuesto de plataforma estén aprobados.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-gray-400">
            En espera
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled title="Se habilita al activar pagos de referido y firmar co-op">
            Aportar co-op
          </Button>
          <Button variant="secondary" disabled title="Se habilita con presupuesto de plataforma aprobado">
            Match de plataforma
          </Button>
          <span className="self-center text-[10px] text-gray-500">
            Un clic cuando esté configurado; hoy no mueve Bunz.
          </span>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        kicker="God · identidad y tesorería"
        title={target ? "Activar pagos desde el fondo" : "Desactivar pagos desde el fondo"}
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
                    ? "Al activarlo, el bono de referido se pagará desde sys_growth_fund, no desde sys_referrals."
                    : "Al desactivarlo, el bono vuelve al camino legado de 50 Bunz."}
                </li>
                <li>
                  {target
                    ? "Si el fondo no tiene saldo, el referido queda PENDING. No se emite de la nada."
                    : "Los referidos que ya están PENDING se pagarán por el camino legado."}
                </li>
                <li>El monto actual es 50 Bunz y no cambia con este interruptor.</li>
                <li>La acción queda auditada con tu usuario, motivo y fecha.</li>
              </ul>
            </div>

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
                  })
                }
              >
                {mutation.isPending
                  ? "Guardando…"
                  : target
                    ? "Activar con identidad"
                    : "Desactivar con identidad"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
