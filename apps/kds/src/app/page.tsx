"use client";

import { trpc } from "../lib/trpc-client";
import { cn, useWakeLock } from "@rabbitty/ui";
import { useState, useCallback, useEffect, useRef } from "react";
import { ChefHat, Timer, CheckCircle2, UtensilsCrossed, Bell } from "lucide-react";
import { useSound } from "../hooks/useSound";
import { OrderTimer } from "../components/OrderTimer";
import { CompletedOrders } from "../components/CompletedOrders";

const itemStatusConfig: Record<"PENDING" | "IN_PROGRESS" | "READY" | "SERVED", { label: string; color: string; dot: string; next: "PENDING" | "IN_PROGRESS" | "READY" | "SERVED" | null }> = {
  PENDING: { label: "Pendiente", color: "border-yellow-600/50 bg-yellow-900/20", dot: "bg-yellow-500", next: "IN_PROGRESS" as const },
  IN_PROGRESS: { label: "Preparando", color: "border-blue-600/50 bg-blue-900/20", dot: "bg-blue-500", next: "READY" as const },
  READY: { label: "Listo", color: "border-green-600/50 bg-green-900/20", dot: "bg-green-500", next: "SERVED" as const },
  SERVED: { label: "Servido", color: "border-gray-700/50 bg-gray-800/40", dot: "bg-gray-500", next: null },
};

/** Tras este tiempo sin comandas activas, el KDS deja de consultar la base.
 *  Motivo: una pantalla encendida toda la noche polleando cada 10 s impide que
 *  el compute de Neon se suspenda (y consume el cupo de horas). */
const IDLE_TO_REST_MS = 10 * 60 * 1000;

export default function KdsPage() {
  const utils = trpc.useUtils();
  const [resting, setResting] = useState(false);

  // Estación de esta pantalla (ADR-023). Se recuerda en el dispositivo.
  const [stationId, setStationId] = useState<string>("");
  useEffect(() => {
    setStationId(window.localStorage.getItem("rabbitty_kds_station") ?? "");
  }, []);
  const { data: stationsList } = trpc.stations.list.useQuery();

  // El reposo por inactividad pausa el polling (neon) sin perder la estación.
  const refetch = resting ? false : 10_000;
  const stationQueue = trpc.kds.getStationQueue.useQuery(
    { stationId },
    { enabled: Boolean(stationId), refetchInterval: refetch, refetchOnWindowFocus: false },
  );
  const allQueue = trpc.kds.getOrders.useQuery(undefined, {
    enabled: !stationId,
    refetchInterval: refetch,

    refetchOnWindowFocus: false,
  });
  const orders = stationId ? stationQueue.data : allQueue.data;

  const pickStation = (id: string) => {
    setStationId(id);
    if (id) window.localStorage.setItem("rabbitty_kds_station", id);
    else window.localStorage.removeItem("rabbitty_kds_station");
  };

  const updateItemStatus = trpc.kds.updateOrderItemStatus.useMutation({
    onSuccess: () => { utils.kds.getOrders.invalidate(); utils.kds.getStationQueue.invalidate(); },
  });

  const [activeTab, setActiveTab] = useState<"all" | "PENDING" | "IN_PROGRESS" | "READY">("all");
  const prevCountRef = useRef(0);
  const { play } = useSound();

  // Screen WakeLock for Kitchen Display tablets / iPads
  useWakeLock();

  useEffect(() => {
    const es = new EventSource("/api/sse");
    const refresh = () => utils.kds.getOrders.invalidate();
    es.addEventListener("kds.item.updated", refresh);
    es.addEventListener("order.created", refresh);
    es.addEventListener("order.paid", refresh);
    return () => es.close();
  }, [utils]);

  useEffect(() => {
    const current = orders?.length ?? 0;
    if (current > prevCountRef.current && prevCountRef.current > 0) {
      play();
    }
    prevCountRef.current = current;
  }, [orders, play]);

  // ── Reposo por inactividad ──────────────────────────────────────────────
  // Con comandas activas se refresca cada 10 s. Sin comandas durante
  // IDLE_TO_REST_MS, el KDS deja de pollear (permite suspender Neon) y queda
  // un aviso para reanudar con un toque.
  const activeItems = (orders ?? []).reduce(
    (n, order) => n + (order.items ?? []).filter((i) => i.status !== "SERVED").length,
    0,
  );
  const lastActiveRef = useRef<number>(Date.now());

  useEffect(() => {
    if (activeItems > 0) {
      lastActiveRef.current = Date.now();
      if (resting) setResting(false);
    }
  }, [activeItems, resting]);

  useEffect(() => {
    if (resting) return;
    // Intervalo local: no toca la red ni la base.
    const id = setInterval(() => {
      if (Date.now() - lastActiveRef.current >= IDLE_TO_REST_MS) setResting(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [resting]);

  const wake = useCallback(() => {
    lastActiveRef.current = Date.now();
    setResting(false);
    void utils.kds.getOrders.invalidate();
  }, [utils]);

  const handleStatus = useCallback(
    (orderId: string, item: { id: string }, status: "PENDING" | "IN_PROGRESS" | "READY" | "SERVED") => {
      updateItemStatus.mutate({ orderItemId: item.id, status });
    },
    [updateItemStatus]
  );

  const filteredOrders = orders?.filter((order) => {
    if (activeTab === "all") return true;
    return order.items.some((item) => item.status === activeTab);
  });

  const counts = {
    PENDING: orders?.reduce((sum: number, o) => sum + o.items.filter((i) => i.status === "PENDING").length, 0) ?? 0,
    IN_PROGRESS: orders?.reduce((sum: number, o) => sum + o.items.filter((i) => i.status === "IN_PROGRESS").length, 0) ?? 0,
    READY: orders?.reduce((sum: number, o) => sum + o.items.filter((i) => i.status === "READY").length, 0) ?? 0,
  };

  const hasPending = counts.PENDING > 0 || counts.READY > 0;

  return (
    <div className="flex h-[100dvh] flex-col">
      {resting && (
        <button
          type="button"
          onClick={wake}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/92 text-white"
        >
          <span className="text-4xl">🌙</span>
          <span className="text-xl font-bold">Pantalla en reposo</span>
          <span className="max-w-sm text-center text-sm text-gray-400">
            Sin comandas activas. El KDS dejó de consultar el servidor para ahorrar
            consumo. Toca la pantalla para reanudar.
          </span>
        </button>
      )}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-lg font-black">
            R
          </div>
          <div>
            <h1 className="text-xl font-bold">Kitchen Display</h1>
            <p className="text-sm text-gray-400">Sistema de cocina</p>
            <select
              value={stationId}
              onChange={(e) => pickStation(e.target.value)}
              className="mt-1 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-[11px] font-bold text-white outline-none"
              aria-label="Estación de esta pantalla"
            >
              <option value="">Todas las estaciones</option>
              {(stationsList ?? []).map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasPending && (
            <div className="flex items-center gap-2 rounded-full bg-pink-600/20 px-4 py-2 text-pink-400">
              <Bell className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-semibold">Nuevas órdenes</span>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm text-gray-400">{new Date().toLocaleDateString("es-MX")}</p>
            <p className="text-xs text-gray-500">{orders?.length ?? 0} órdenes activas</p>
          </div>
        </div>
      </header>

      <div className="flex gap-1 border-b border-white/10 px-6 py-3">
        {(["all", "PENDING", "IN_PROGRESS", "READY"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            {tab === "all" && "Todas"}
            {tab === "PENDING" && `Pendientes (${counts.PENDING})`}
            {tab === "IN_PROGRESS" && `Preparando (${counts.IN_PROGRESS})`}
            {tab === "READY" && `Listas (${counts.READY})`}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {!orders ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : filteredOrders?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat className="mb-4 h-16 w-16 text-gray-600" />
            <p className="text-lg font-medium text-gray-400">Sin órdenes</p>
            <p className="mt-1 text-sm text-gray-500">Esperando nuevas órdenes...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredOrders?.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-bold">
                      {order.tableNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-300">Mesa {order.tableNumber}</p>
                      <p className="text-xs text-gray-500">
                        {order.createdAt && new Date(order.createdAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                   <OrderTimer createdAt={order.createdAt || new Date().toISOString()} />
                </div>

                <div className="space-y-2">
                  {order.items.map((item) => {
                    const config = itemStatusConfig[item.status as "PENDING" | "IN_PROGRESS" | "READY" | "SERVED"];
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-xl border p-3 transition-all",
                          config.color,
                          item.status === "PENDING" && "animate-pulse border-yellow-500/70"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", config.dot)} />
                            <span className="text-sm font-medium">
                              {item.quantity}x {item.name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{config.label}</span>
                        </div>
                        {item.notes && (
                          <p className="mt-1 text-xs text-yellow-400/80">Nota: {item.notes}</p>
                        )}
                        {config.next && (
                          <div className="mt-3 flex gap-2">
                            {config.next === "IN_PROGRESS" && (
                              <button
                                onClick={() => handleStatus(order.id, item, "IN_PROGRESS")}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-600/30 py-3 text-sm font-bold text-yellow-400 transition-colors hover:bg-yellow-600/50 active:scale-95"
                              >
                                <Timer className="h-4 w-4" />
                                Aceptar
                              </button>
                            )}
                            {config.next === "READY" && (
                              <button
                                onClick={() => handleStatus(order.id, item, "READY")}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600/30 py-3 text-sm font-bold text-blue-400 transition-colors hover:bg-blue-600/50 active:scale-95"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Listo
                              </button>
                            )}
                            {config.next === "SERVED" && (
                              <button
                                onClick={() => handleStatus(order.id, item, "SERVED")}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600/30 py-3 text-sm font-bold text-green-400 transition-colors hover:bg-green-600/50 active:scale-95"
                              >
                                <UtensilsCrossed className="h-4 w-4" />
                                Servir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <CompletedOrders paused={resting} />
        </div>
      </main>
    </div>
  );
}
