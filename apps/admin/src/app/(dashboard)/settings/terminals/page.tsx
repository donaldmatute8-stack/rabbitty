"use client";

/**
 * ── Terminales POS (Fase 5 del ADR-014) ──
 *
 * Vista de administración: qué dispositivos están autorizados, quién tiene el
 * turno abierto, cuándo se vieron por última vez y solicitudes de
 * reautorización pendientes.
 *
 * Vincular una terminal SIEMPRE se hace desde el dispositivo (/pos/link), no
 * desde aquí: el secreto del dispositivo nunca viaja a este panel.
 */

import { useState } from "react";
import Link from "next/link";
import { trpc } from "../../../../lib/trpc-client";
import { Card, Badge, Button, toast } from "@rabbitty/ui";
import {
  Ban,
  CheckCircle2,
  Clock,
  History,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  ShieldOff,
  UserRound,
  Wifi,
} from "lucide-react";

function fmt(value?: string | Date | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function statusBadge(status: string, expired: boolean) {
  if (status === "REVOKED") return <Badge variant="danger">Revocada</Badge>;
  if (expired) return <Badge variant="warning">Vencida</Badge>;
  return <Badge variant="success">Activa</Badge>;
}

export default function PosTerminalsPage() {
  const [busyId, setBusyId] = useState<string | null>(null);

  const feature = trpc.posTerminals.featureEnabled.useQuery(undefined, { retry: false });
  const overview = trpc.posTerminals.overview.useQuery(undefined, { retry: false });

  const utils = trpc.useUtils();

  const { data: stationsData } = trpc.stations.list.useQuery();
  const setStation = trpc.posTerminals.setStation.useMutation({
    onSuccess: () => { utils.posTerminals.list.invalidate(); toast.success("Estación de la terminal actualizada"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const revoke = trpc.posTerminals.revoke.useMutation({
    onSuccess: () => {
      toast.success("Terminal revocada. No podrá abrir nuevas sesiones.");
      utils.posTerminals.overview.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBusyId(null),
  });

  const endShift = trpc.posTerminals.forceEndShift.useMutation({
    onSuccess: (data) => {
      toast.success(data.closed ? "Turno cerrado en la terminal." : "Esa terminal no tenía turno abierto.");
      utils.posTerminals.overview.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBusyId(null),
  });

  const history = trpc.posTerminals.shiftHistory.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined, retry: false },
  );

  const terminals = overview.data?.terminals ?? [];
  const shifts = history.data?.pages.flatMap((p) => p.items) ?? [];
  const pending = overview.data?.pendingRequests ?? [];
  const enabled = feature.data?.enabled === true;

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">Operación</p>
          <h1 className="m-0 mt-1 text-2xl font-black">Terminales POS</h1>
          <p className="m-0 mt-1 max-w-xl text-sm text-gray-500">
            Dispositivos autorizados para cobrar sin la sesión del administrador. El turno del empleado se
            identifica con su PIN.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "success" : "warning"}>
            {enabled ? "Modo terminal activo" : "Modo terminal apagado"}
          </Badge>
          <Button variant="secondary" onClick={() => overview.refetch()} disabled={overview.isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${overview.isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {!enabled && (
        <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="m-0 text-sm font-bold text-amber-800 dark:text-amber-300">El modelo de terminal está apagado</p>
          <p className="m-0 mt-1 text-xs text-amber-700 dark:text-amber-200/80">
            El POS seguirá usando la sesión del administrador. Para habilitarlo, activa
            <code className="mx-1 rounded bg-black/10 px-1 py-0.5 text-[11px]">POS_TERMINAL_SESSIONS=1</code>
            en el entorno y vuelve a desplegar.
          </p>
        </Card>
      )}

      {/* Solicitudes pendientes */}
      {pending.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-pink-500" />
            <p className="m-0 text-sm font-black">Solicitudes pendientes</p>
          </div>
          <div className="space-y-2">
            {pending.map((r) => (
              <Link
                key={r.code}
                href={`/pos/auth?code=${r.code}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 hover:border-pink-400 dark:border-white/10"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{r.terminalName}</span>
                  <span className="block text-[11px] text-gray-500">
                    {r.requestedHours} h · vence {fmt(r.expiresAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-lg bg-pink-500/10 px-2 py-1 text-xs font-black tracking-widest text-pink-500">
                    {r.code}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Terminales */}
      {overview.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando terminales…
        </div>
      ) : overview.error ? (
        <Card className="p-4">
          <p className="m-0 text-sm font-bold text-red-500">No se pudieron cargar las terminales</p>
          <p className="m-0 mt-1 text-xs text-gray-500">{overview.error.message}</p>
        </Card>
      ) : terminals.length === 0 ? (
        <Card className="p-6 text-center">
          <MonitorSmartphone className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <p className="m-0 text-sm font-black">Aún no hay terminales vinculadas</p>
          <p className="m-0 mx-auto mt-1 max-w-md text-xs text-gray-500">
            Abre <code className="rounded bg-black/5 px-1 dark:bg-white/10">/pos/link</code> en el dispositivo que
            quieres usar como caja e inicia sesión como administrador. El secreto del dispositivo nunca sale de él.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {terminals.map((t) => {
            const busy = busyId === t.id;
            const isActive = t.status === "ACTIVE" && !t.expired;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
                      <MonitorSmartphone className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-black">{t.name}</p>
                      <p className="m-0 text-[11px] text-gray-500">
                        {t.platform || "web"} · alta {fmt(t.authorizedAt)}
                      </p>
                    </div>
                  </div>
                  {statusBadge(t.status, t.expired)}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                    <p className="m-0 font-bold uppercase text-gray-400">Última conexión</p>
                    <p className="m-0 mt-0.5 font-bold">{fmt(t.lastSeenAt)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                    <p className="m-0 font-bold uppercase text-gray-400">Autorización vence</p>
                    <p className="m-0 mt-0.5 font-bold">{fmt(t.expiresAt)}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Estación fija
                  </label>
                  <select
                    value={(t as { stationId?: string | null }).stationId ?? ""}
                    onChange={(e) => setStation.mutate({ terminalId: t.id, stationId: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white outline-none"
                  >
                    <option value="">Sin estación (elige la pantalla)</option>
                    {(stationsData ?? []).map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                {t.activeOperator ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="m-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <UserRound className="h-3 w-3" /> Turno abierto
                      </p>
                      <p className="m-0 truncate text-xs font-bold">
                        {t.activeOperator.name}
                        {t.activeOperator.role ? ` · ${t.activeOperator.role}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBusyId(t.id);
                        endShift.mutate({ terminalId: t.id });
                      }}
                      className="shrink-0 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-300"
                    >
                      Cerrar turno
                    </button>
                  </div>
                ) : (
                  <p className="m-0 mt-3 flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="h-3 w-3" /> Sin turno abierto
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/5">
                  <p className="m-0 flex items-center gap-1 text-[10px] text-gray-400">
                    <Wifi className={`h-3 w-3 ${isActive ? "text-emerald-500" : "text-gray-400"}`} />
                    {isActive ? "Puede abrir sesión" : "No puede abrir sesión"}
                  </p>
                  <button
                    type="button"
                    disabled={busy || t.status === "REVOKED"}
                    onClick={() => {
                      if (!window.confirm(`¿Revocar "${t.name}"? Dejará de poder abrir el POS hasta vincularla de nuevo.`)) return;
                      setBusyId(t.id);
                      revoke.mutate({ terminalId: t.id });
                    }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    Revocar
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Historial de turnos */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-pink-500" />
            <p className="m-0 text-sm font-black">Historial de turnos</p>
          </div>
          <span className="text-[11px] text-gray-400">{shifts.length} recientes</span>
        </div>

        {history.isLoading ? (
          <p className="m-0 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
          </p>
        ) : shifts.length === 0 ? (
          <p className="m-0 text-xs text-gray-500">Todavía no hay turnos registrados en esta sucursal.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {shifts.map((sh) => {
              const open = !sh.endedAt;
              return (
                <div key={sh.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-bold">
                      {sh.staffName}
                      {sh.staffRole ? <span className="ml-1 font-normal text-gray-400">· {sh.staffRole}</span> : null}
                    </p>
                    <p className="m-0 truncate text-[10.5px] text-gray-500">
                      {sh.terminalName} · {fmt(sh.startedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {open ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        Abierto
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-bold text-gray-500">
                        {sh.durationMinutes != null ? `${sh.durationMinutes} min` : "—"}
                      </span>
                    )}
                    {!open && <p className="m-0 text-[10px] text-gray-400">cerró {fmt(sh.endedAt)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {history.hasNextPage && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={history.isFetchingNextPage}
              onClick={() => history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? "Cargando…" : "Cargar más"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-2">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p className="m-0 text-[11px] leading-relaxed text-gray-500">
            Revocar no borra el historial de ventas: solo impide que ese dispositivo abra una sesión nueva. Para
            volver a usarlo, abre <code className="rounded bg-black/5 px-1 dark:bg-white/10">/pos/link</code> en el
            dispositivo con una cuenta de administrador, o genera una reautorización desde el propio POS.
          </p>
        </div>
      </Card>
    </div>
  );
}
