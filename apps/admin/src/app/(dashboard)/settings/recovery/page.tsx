"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Coins,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card, Button, toast, cn } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

/**
 * Recuperación dinámica.
 *
 * El afiliado ve la tasa del ciclo, el importe exacto y el efecto antes de
 * aceptar. Sin aceptación no se descuenta nada. En shadow solo se registra la
 * conformidad; en dual/enforce se aplica.
 */

const n = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : "—";
const pct = (v: number | null | undefined) =>
  typeof v === "number" ? `${Math.round(v * 1000) / 10}%` : "—";

type Proposal = {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossGenerated: number;
  proposedRate: number;
  proposedAmount: number;
  outstandingBefore: number;
  outstandingAfter: number;
  availableBefore: number;
  availableAfter: number;
  coverageBefore: number | null;
  coverageAfter: number | null;
  status: string;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente de aceptación",
  ACCEPTED: "Aceptada (shadow)",
  APPLIED: "Aplicada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ACCEPTED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  APPLIED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
  EXPIRED: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

export default function RecoverySettingsPage() {
  const { data, isLoading, refetch } = trpc.admin.getRecovery.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const accept = trpc.admin.acceptRecovery.useMutation();
  const reject = trpc.admin.rejectRecovery.useMutation();

  const [open, setOpen] = useState(false);
  const [acceptedName, setAcceptedName] = useState("");
  const [checked, setChecked] = useState(false);

  const pending = (data?.pending ?? null) as Proposal | null;
  const proposals = (data?.proposals ?? []) as Proposal[];
  const account = data?.account ?? null;
  const terms = data?.terms ?? null;

  const shadow = data?.engineMode !== "dual" && data?.engineMode !== "enforce";
  const progress = useMemo(() => {
    if (!account) return 0;
    const disbursed = Number(account.creditDisbursed) || 0;
    if (disbursed <= 0) return 0;
    return Math.min(100, Math.round((Number(account.creditRepaid) / disbursed) * 100));
  }, [account]);

  const submit = () => {
    if (!pending) return;
    if (acceptedName.trim().length < 3) {
      toast.error("Escribe tu nombre completo para aceptar.");
      return;
    }
    if (!checked) {
      toast.error("Confirma que revisaste y aceptas la propuesta.");
      return;
    }
    accept.mutate(
      {
        id: pending.id,
        acceptedName: acceptedName.trim(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
      {
        onSuccess: (res) => {
          toast.success(
            res.applied
              ? "Propuesta aceptada y aplicación registrada."
              : "Conformidad registrada. El motor está en shadow: no se movieron saldos."
          );
          setOpen(false);
          setAcceptedName("");
          setChecked(false);
          void refetch();
        },
        onError: (e) => toast.error(e.message || "No se pudo aceptar la propuesta."),
      }
    );
  };

  const decline = (id: string) => {
    reject.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Propuesta rechazada. No se descontó nada.");
          setOpen(false);
          void refetch();
        },
        onError: (e) => toast.error(e.message || "No se pudo rechazar la propuesta."),
      }
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
          <Coins className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Recuperación de capacidad</h1>
          <p className="text-xs text-gray-400">
            Propuestas por ciclo con importe exacto. No se descuenta nada sin tu aceptación.
          </p>
        </div>
      </div>

      {shadow && (
        <div className="flex items-start gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-sky-300 mt-0.5" />
          <p className="text-[11px] text-sky-200/90">
            El motor está en <span className="font-mono font-bold">shadow</span>. Si aceptas, se
            registra tu conformidad y la evidencia, pero no se mueven saldos hasta pasar a{" "}
            <span className="font-mono">dual</span> o <span className="font-mono">enforce</span>.
          </p>
        </div>
      )}

      <Card className="p-5 bg-white/5 border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Tu capacidad</h2>
          <Button variant="ghost" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {!account ? (
          <p className="text-xs text-gray-400">
            Aún no tienes una cuenta de capacidad asignada. Cuando se autorice, aquí verás tu
            capacidad y las propuestas.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Disponible" value={n(account.available)} />
            <Metric label="Comprometido" value={n(account.committed)} />
            <Metric label="Pendiente de recuperar" value={n(account.creditOutstanding)} />
            <Metric label="Cobertura" value={`${n(account.coverageDays)} días`} />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>Progreso de recuperación</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {terms && (
          <p className="text-[11px] text-gray-500">
            Horizonte: {terms.targetMonths} meses · Rango: {pct(terms.rateMin)}–{pct(terms.rateMax)} ·
            Cobertura mínima: {terms.minCoverageDays} días
          </p>
        )}
      </Card>

      <Card
        className={cn(
          "p-5 border",
          pending ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10"
        )}
      >
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-300" /> Propuesta del ciclo
        </h2>

        {pending ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] text-amber-200/80 uppercase tracking-wider font-bold">
                  Importe a retener
                </p>
                <p className="text-3xl font-black text-white">
                  {n(pending.proposedAmount)} <span className="text-sm text-gray-300">Bunz</span>
                </p>
                <p className="text-[11px] text-gray-400">
                  Tasa del ciclo: {pct(pending.proposedRate)} sobre {n(pending.grossGenerated)} Bunz
                  generados
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => setOpen(true)}>
                  Revisar y aceptar
                </Button>
                <Button variant="ghost" onClick={() => decline(pending.id)} disabled={reject.isPending}>
                  Rechazar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Metric label="Pendiente antes" value={n(pending.outstandingBefore)} />
              <Metric label="Pendiente después" value={n(pending.outstandingAfter)} />
              <Metric label="Cobertura después" value={`${n(pending.coverageAfter)} días`} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-400">
            No hay propuestas pendientes. Al cierre de cada ciclo calculamos una propuesta si hay
            capacidad generada y compromiso pendiente.
          </p>
        )}
      </Card>

      <Card className="p-5 bg-white/5 border-white/10 space-y-3">
        <h2 className="text-sm font-bold text-white">Historial</h2>
        {proposals.length === 0 ? (
          <p className="text-xs text-gray-400">Todavía no hay propuestas.</p>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-bold text-white">
                    {n(p.proposedAmount)} Bunz · {pct(p.proposedRate)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(p.periodStart).toLocaleDateString("es-MX")} —{" "}
                    {new Date(p.periodEnd).toLocaleDateString("es-MX")}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-full border",
                    STATUS_CLASS[p.status] ?? "bg-white/10 text-gray-300 border-white/20"
                  )}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-amber-500/5 border-amber-500/25">
        <p className="text-[11px] text-amber-200/90 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          La recuperación sale de la capacidad nueva generada, nunca de la capacidad comprometida.
          No es comisión ni interés. Si rechazas, no se descuenta nada y el pendiente sigue igual.
        </p>
      </Card>

      {open && pending && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#130725] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] text-pink-400 uppercase">
                  RABBITTY
                </p>
                <h3 className="text-lg font-black text-white">Aceptar propuesta de recuperación</h3>
                <p className="text-[11px] text-gray-400">
                  Revisa el importe exacto y el efecto antes de confirmar.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-300">
                Se retendrán
              </p>
              <p className="text-3xl font-black text-white">
                {n(pending.proposedAmount)} <span className="text-sm text-gray-300">Bunz</span>
              </p>
              <p className="text-[11px] text-gray-300">
                Tasa del ciclo: {pct(pending.proposedRate)} · Base generada:{" "}
                {n(pending.grossGenerated)} Bunz
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Row label="Pendiente antes" value={n(pending.outstandingBefore)} />
              <Row label="Pendiente después" value={n(pending.outstandingAfter)} />
              <Row label="Disponible antes" value={n(pending.availableBefore)} />
              <Row label="Disponible después" value={n(pending.availableAfter)} />
              <Row label="Cobertura antes" value={`${n(pending.coverageBefore)} días`} />
              <Row label="Cobertura después" value={`${n(pending.coverageAfter)} días`} />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2 text-[11px] text-gray-300">
              <p className="font-bold text-white">Condiciones</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Solo se retiene de la capacidad nueva generada en el ciclo.</li>
                <li>No se toca la capacidad comprometida.</li>
                <li>No hay intereses, comisión ni cambios retroactivos.</li>
                <li>
                  {shadow
                    ? "En shadow se registra tu conformidad, sin mover saldos."
                    : "Al aceptar se aplica la retención y se actualiza tu estado de cuenta."}
                </li>
                <li>La propuesta vence en 15 días.</li>
              </ul>
            </div>

            <label className="block text-[11px] text-gray-400">
              Nombre completo del firmante *
              <input
                value={acceptedName}
                onChange={(e) => setAcceptedName(e.target.value)}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Nombre completo"
              />
            </label>

            <label className="flex items-start gap-2 text-[11px] text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                He revisado la propuesta y acepto la retención de {n(pending.proposedAmount)} Bunz
                conforme a los términos. Confirmo que no se afecta capacidad comprometida.
              </span>
            </label>

            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={submit}
                disabled={accept.isPending}
              >
                {accept.isPending ? "Registrando…" : "Aceptar propuesta"}
              </Button>
              <Button variant="ghost" onClick={() => decline(pending.id)} disabled={reject.isPending}>
                Rechazar
              </Button>
            </div>
            <p className="text-[10px] text-gray-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Se guarda versión, importe, fecha, método y
              evidencia. Face ID/Touch ID es opcional y no sustituye e.firma.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
