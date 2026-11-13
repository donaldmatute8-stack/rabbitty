"use client";

/**
 * ── Reloj checador (ADR-025 D7) ────────────────────────────────────────────
 *
 * Esta pantalla se deja abierta en el admin (o en una tablet de la sucursal):
 * muestra el QR que el mesero escanea al entrar a su comandero. El código rota
 * cada minuto, así que un QR fotografiado deja de servir.
 *
 * Aquí también se ve quién está en turno y se puede cerrar un turno huérfano.
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { trpc } from "../../../../lib/trpc-client";
import { Card, Badge, Button, toast } from "@rabbitty/ui";
import { Clock, LogOut, RefreshCw, QrCode, ShieldCheck } from "lucide-react";

function fmt(value?: string | Date | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function elapsed(from?: string | Date | null) {
  if (!from) return "—";
  const ms = Date.now() - new Date(from).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function CheckinPage() {
  const utils = trpc.useUtils();
  const [now, setNow] = useState(Date.now());

  const code = trpc.comandero.presenceCode.useQuery(undefined, {
    refetchInterval: 20_000,
    staleTime: 0,
  });
  const active = trpc.staff.getActiveShifts.useQuery(undefined, { refetchInterval: 30_000 });
  const history = trpc.staff.shiftHistory.useQuery({ limit: 20 });

  const forceOut = trpc.staff.forceClockOut.useMutation({
    onSuccess: () => {
      utils.staff.getActiveShifts.invalidate();
      utils.staff.shiftHistory.invalidate();
      toast.success("Turno cerrado");
    },
    onError: (e) => toast.error(e.message),
  });

  // Reloj local: solo para el contador de "lleva X tiempo".
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const onShift = active.data ?? [];
  const secondsLeft = code.data?.expiresAt
    ? Math.max(0, Math.round((new Date(code.data.expiresAt).getTime() - now) / 1000))
    : 0;

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-6">
      <div>
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">Equipo</p>
        <h1 className="m-0 mt-1 text-2xl font-black">Reloj checador</h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-gray-500">
          El mesero escanea este código desde su comandero y captura su PIN. El código
          rota cada minuto: prueba que el dispositivo está en la sucursal.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex flex-col items-center gap-3 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <QrCode className="h-4 w-4" />
            Código de sucursal
          </div>

          {code.data ? (
            <div className="rounded-2xl bg-white p-3">
              <QRCodeSVG value={code.data.code} size={220} level="M" />
            </div>
          ) : (
            <div className="flex h-[244px] w-[244px] items-center justify-center rounded-2xl bg-white/5 text-sm text-gray-500">
              Cargando…
            </div>
          )}

          <p className="m-0 font-mono text-2xl font-black tracking-[0.3em]">{code.data?.code ?? "········"}</p>
          <Badge variant={secondsLeft > 5 ? "success" : "warning"}>
            {secondsLeft > 0 ? `Rota en ${secondsLeft}s` : "Actualizando…"}
          </Badge>

          <Button variant="secondary" onClick={() => code.refetch()} disabled={code.isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${code.isFetching ? "animate-spin" : ""}`} />
            Regenerar
          </Button>

          <p className="m-0 mt-1 text-center text-[11px] leading-snug text-gray-500">
            Déjalo visible en la caja o en una tablet de la entrada. No lo compartas por
            foto: caduca en menos de un minuto.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="m-0 flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                <Clock className="h-4 w-4 text-emerald-400" /> En turno ({onShift.length})
              </h2>
              <Button variant="secondary" onClick={() => active.refetch()} disabled={active.isFetching}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${active.isFetching ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>

            {onShift.length === 0 ? (
              <p className="m-0 py-6 text-center text-sm text-gray-500">Nadie ha checado todavía.</p>
            ) : (
              <ul className="m-0 space-y-2 p-0">
                {onShift.map((row: any) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-bold">{row.staff?.[0]?.name ?? row.staffId}</p>
                      <p className="m-0 text-[11px] text-gray-500">
                        Entró {fmt(row.checkIn)} · lleva {elapsed(row.checkIn)}
                      </p>
                    </div>
                    <button
                      onClick={() => forceOut.mutate({ shiftId: row.id })}
                      disabled={forceOut.isPending}
                      className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Cerrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="m-0 flex items-center gap-2 text-sm font-black uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-gray-400" /> Últimas checadas
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="py-2 text-left">Empleado</th>
                    <th className="py-2 text-left">Rol</th>
                    <th className="py-2 text-left">Entrada</th>
                    <th className="py-2 text-left">Salida</th>
                    <th className="py-2 text-right">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {(history.data ?? []).map((row: any) => {
                    const hours =
                      row.checkIn && row.checkOut
                        ? ((new Date(row.checkOut).getTime() - new Date(row.checkIn).getTime()) / 3_600_000).toFixed(1)
                        : row.status === "ACTIVE"
                        ? elapsed(row.checkIn)
                        : "—";
                    return (
                      <tr key={row.id} className="border-b border-white/5 last:border-0">
                        <td className="py-2">{row.name ?? row.staffId}</td>
                        <td className="py-2 text-gray-400">{row.role ?? "—"}</td>
                        <td className="py-2 text-gray-400">{fmt(row.checkIn)}</td>
                        <td className="py-2 text-gray-400">{row.checkOut ? fmt(row.checkOut) : <Badge variant="success">En turno</Badge>}</td>
                        <td className="py-2 text-right font-mono text-xs">{hours}</td>
                      </tr>
                    );
                  })}
                  {(history.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                        Sin checadas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
