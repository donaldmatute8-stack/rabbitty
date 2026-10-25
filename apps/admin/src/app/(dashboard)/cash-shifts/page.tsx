import { useState } from "react";
import Link from "next/link";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, toast } from "@rabbitty/ui";
import { Banknote, ChevronDown, ChevronRight, RefreshCw, ShieldCheck, Settings2, Printer, FileText } from "lucide-react";

const fmt = (n: number | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`;
const dt = (d: any) => (d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—");

const EVENT_LABEL: Record<string, string> = {
  OPEN: "Apertura",
  WITHDRAWAL: "Retiro",
  PARTIAL_CLOSE: "Cierre parcial (X)",
  HANDOVER: "Traspaso",
  CLOSE: "Cierre (Z)",
};

function ShiftEvents({ shiftId }: { shiftId: string }) {
  const { data, isLoading } = trpc.cashShifts.events.useQuery({ shiftId });
  if (isLoading) return <p className="p-4 text-xs text-gray-500">Cargando bitácora...</p>;
  return (
    <div className="p-4 bg-black/30 border-t border-white/5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2 flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> Bitácora inmutable
      </p>
      <ul className="space-y-1.5">
        {data?.map((e: any) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 text-xs text-gray-300">
            <span className="font-mono text-gray-500">{dt(e.createdAt)}</span>
            <span className="font-bold text-white">{EVENT_LABEL[e.type] ?? e.type}</span>
            <span>{e.staffName ?? "—"}{e.toStaffName ? ` → ${e.toStaffName}` : ""}</span>
            {e.amount != null && <span>{fmt(e.amount)}</span>}
            {e.countedAmount != null && (
              <span>
                contado {fmt(e.countedAmount)} / esperado {fmt(e.expectedAmount)} ({e.difference > 0 ? "+" : ""}
                {fmt(e.difference)})
              </span>
            )}
            {e.authorizedByName && <span className="text-cyan-300">autorizó {e.authorizedByName}</span>}
            {e.notes && <span className="italic text-gray-400">“{e.notes}”</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CashShiftsPage() {
  const utils = trpc.useUtils();
  const { data: shifts, isLoading } = trpc.cashShifts.history.useQuery({});
  const { data: settings } = trpc.cashDrops.getSettings.useQuery({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mgrThreshold, setMgrThreshold] = useState<string>("");

  const save = trpc.cashDrops.updateSettings.useMutation({
    onSuccess: () => {
      utils.cashDrops.getSettings.invalidate();
      toast.success("Umbral actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const effectiveThreshold = mgrThreshold !== "" ? mgrThreshold : String(settings?.cashDropManagerThreshold ?? 1000);

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-500 flex items-center gap-3">
              <Banknote className="h-9 w-9 text-emerald-400" /> Turnos de Caja
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">
              Aperturas, retiros, arqueos, traspasos y cierres Z. Distinto de “Control de Turnos” del personal (asistencia).
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => utils.cashShifts.history.invalidate()}>
            <RefreshCw className="h-4 w-4" /> Refrescar
          </Button>
        </div>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <Settings2 className="h-5 w-5 text-orange-400" />
          <h3 className="font-bold text-white">Umbral de retiro con PIN de manager</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Retiros mayores a este monto piden PIN de manager/admin además del PIN del cajero.
        </p>
        <div className="flex items-end gap-3 max-w-sm">
          <div className="flex-1">
            <label htmlFor="mgr-threshold" className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Monto ($)
            </label>
            <input
              id="mgr-threshold"
              type="number"
              min="0"
              value={effectiveThreshold}
              onChange={(e) => setMgrThreshold(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <Button
            id="save-mgr-threshold"
            disabled={save.isPending || !settings}
            onClick={() =>
              settings &&
              save.mutate({
                cashDropEnabled: settings.cashDropEnabled,
                cashDropThreshold: settings.cashDropThreshold,
                cashDropManagerThreshold: Number(effectiveThreshold),
              })
            }
          >
            Guardar
          </Button>
        </div>
      </Card>

      <Card className="p-0 border border-white/5 bg-white/5 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5">
              <tr>
                {["", "Apertura", "Cajero", "Fondo", "Esperado", "Contado", "Diferencia", "Cierre", "Autorizó", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {shifts?.map((s: any) => (
                <>
                  <tr key={s.id} className="hover:bg-white/5 transition-all cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <td className="px-4 py-3 text-gray-500">{expanded === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{dt(s.openedAt)}</td>
                    <td className="px-4 py-3 font-bold text-white">{s.openedByName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(s.openingFloat)}</td>
                    <td className="px-4 py-3 text-gray-300">{s.status === "CLOSED" ? fmt(s.expectedCash) : "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{s.status === "CLOSED" ? fmt(s.countedCash) : "—"}</td>
                    <td className={`px-4 py-3 font-bold ${s.difference == null ? "text-gray-500" : Math.abs(s.difference) < 0.01 ? "text-emerald-400" : s.difference > 0 ? "text-cyan-300" : "text-red-400"}`}>
                      {s.difference == null ? "—" : `${s.difference > 0 ? "+" : ""}${fmt(s.difference)}`}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{dt(s.closedAt)}</td>
                    <td className="px-4 py-3 text-gray-300">{s.authorizedByName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "OPEN" ? "success" : "default"}>{s.status === "OPEN" ? "Abierto" : "Cerrado"}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/reports/audit?shiftId=${s.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs font-bold transition-all"
                        title="Ver y descargar reporte PDF del turno"
                      >
                        <FileText className="h-3 w-3" />
                        <span>PDF</span>
                      </Link>
                    </td>
                  </tr>
                  {expanded === s.id && (
                    <tr key={`${s.id}-ev`}>
                      <td colSpan={11} className="p-0"><ShiftEvents shiftId={s.id} /></td>
                    </tr>
                  )}
                </>
              ))}
              {!isLoading && !shifts?.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">
                    Aún no hay turnos de caja. Se abren desde el POS con el botón “Caja cerrada · Abrir”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
