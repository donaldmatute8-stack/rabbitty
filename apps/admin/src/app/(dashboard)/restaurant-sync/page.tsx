"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Store, RefreshCw, Coins, Bike, PlugZap, Power, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@rabbitty/ui";

export default function RestaurantSyncPage() {
  const { data: restaurants } = trpc.admin.getRestaurants.useQuery();
  const { mutateAsync: syncRestaurant } = trpc.fastapi.syncRestaurant.useMutation();
  const { mutateAsync: importUberEats } = trpc.admin.importUberEatsMenu.useMutation();

  const [syncing, setSyncing] = useState(false);
  const rechargeBunz = trpc.fastapi.rechargeBusinessBunz.useMutation({
    onSuccess: (data) => toast.success(`Bunz recargados. Nuevo balance: ${data.bunzBalance}`),
    onError: (e) => toast.error(e.message),
  });
  const [rechargeAmount, setRechargeAmount] = useState<Record<string, string>>({});

  const handleSyncRestaurant = async (restaurantId: string) => {
    try {
      setSyncing(true);
      const restaurant = restaurants?.find(r => r.id === restaurantId);
      await syncRestaurant({ restaurantId, name: restaurant?.name ?? "Restaurant", slug: restaurant?.slug ?? "restaurant", acceptsBunz: restaurant?.acceptsBunz ?? true });
      toast.success("Restaurant sincronizado con FastAPI");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    if (!restaurants || restaurants.length === 0) {
      toast.error("No hay restaurantes para sincronizar");
      return;
    }

    setSyncing(true);
    try {
      for (const restaurant of restaurants) {
        await syncRestaurant({
          restaurantId: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          acceptsBunz: restaurant.acceptsBunz || false,
        });
      }
      toast.success(`${restaurants.length} restaurantes sincronizados`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">Sincronización de Restaurante</h1>
            <p className="text-sm font-medium text-gray-400 mt-1">Sincroniza restaurantes con FastAPI para Core transactions</p>
          </div>

          <UberEatsCard />

          <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Restaurantes Registrados</h3>
              <button
                onClick={handleSyncAll}
                disabled={syncing || !restaurants}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : `Sincronizar todos (${restaurants?.length || 0})`}
              </button>
            </div>

            {restaurants?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Store className="mb-3 h-12 w-12 text-pink-500/40" />
                <p className="text-sm text-gray-400">No hay restaurantes registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {restaurants?.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white text-base">{restaurant.name}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          ID: {restaurant.id.slice(0, 8)}...
                        </p>
                      </div>
                      <button
                        onClick={() => handleSyncRestaurant(restaurant.id)}
                        disabled={syncing}
                        className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-all"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Sincronizar FastAPI
                      </button>
                    </div>
                    
                    {/* Magic Onboarding Section */}
                    <div className="mt-2 border-t border-gray-200 pt-3">
                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const url = formData.get("ubereats_url") as string;
                          if (!url) return;
                          
                          try {
                            setSyncing(true);
                            const result = await importUberEats({ branchId: restaurant.id, url });
                            toast.success(result.message);
                            (e.target as HTMLFormElement).reset();
                          } catch (err: any) {
                            toast.error(err.message || "Error al importar menú de UberEats");
                          } finally {
                            setSyncing(false);
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <input 
                          type="url" 
                          name="ubereats_url"
                          placeholder="https://www.ubereats.com/store/..." 
                          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                          required
                        />
                        <button
                          type="submit"
                          disabled={syncing}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Importar Menú Mágico
                        </button>
                      </form>
                      <p className="mt-1 text-[10px] text-gray-400">Pega el enlace de UberEats para clonar platillos, categorías y precios instantáneamente.</p>
                    </div>

                    {/* Bunz Recharge Section */}
                    <div className="mt-2 border-t border-gray-200 pt-3">
                      <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        Recargar Inventario de Bunz
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Cantidad de Bunz"
                          value={rechargeAmount[restaurant.id] ?? ""}
                          onChange={(e) => setRechargeAmount(prev => ({ ...prev, [restaurant.id]: e.target.value }))}
                          className="w-36 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500"
                        />
                        <button
                          onClick={() => {
                            const amount = parseInt(rechargeAmount[restaurant.id]);
                            if (!amount || amount < 1) { toast.error("Ingresa una cantidad válida"); return; }
                            // W4 (auditoría H17): crear respaldo exige motivo documentado
                            // (actor + motivo van al ledger). No se puede recargar "porque sí".
                            const reason = window.prompt(
                              `Motivo de la recarga de ${amount} Bunz para ${restaurant.name}.\n\nQueda registrado en el ledger con tu usuario y la fecha.`
                            );
                            if (!reason || reason.trim().length < 5) {
                              toast.error("La recarga necesita un motivo (mín. 5 caracteres)");
                              return;
                            }
                            rechargeBunz.mutate({ businessId: restaurant.id, amount, reason: reason.trim() });
                            setRechargeAmount(prev => ({ ...prev, [restaurant.id]: "" }));
                          }}
                          disabled={rechargeBunz.isPending || !rechargeAmount[restaurant.id]}
                          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          Recargar
                        </button>
                      </div>
                      <p className="mt-1.5 text-[10px] text-gray-500">
                        Queda registrado en el ledger con actor, motivo y fecha — auditable para conciliación.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-green-50 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full bg-green-100 p-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-sm font-semibold text-green-700">
                ¿Cómo funciona?
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              Los restaurantes deben sincronizarse con FastAPI para que las transacciones
              de Core (`core.transactions`) se eleven automáticamente cuando un cliente
              pague en POS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Uber Eats Marketplace ────────────────────────────────────────────────────
function UberEatsCard() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.uberEats.status.useQuery(undefined, { retry: false });
  const [storeId, setStoreId] = useState("");

  const connect = trpc.uberEats.connect.useMutation({
    onSuccess: () => {
      toast.success("Tienda de Uber Eats guardada");
      utils.uberEats.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const disconnect = trpc.uberEats.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Tienda desconectada");
      utils.uberEats.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const syncMenu = trpc.uberEats.syncMenu.useMutation({
    onSuccess: (r: any) => {
      if (r?.success) {
        toast.success("Menú publicado en Uber Eats");
        utils.uberEats.status.invalidate();
      } else {
        toast.error(r?.message || "No se pudo publicar el menú");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const setOnline = trpc.uberEats.setOnline.useMutation({
    onSuccess: () => utils.uberEats.status.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const connection = status?.connection;
  const configured = Boolean(status?.configured);

  return (
    <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
          <Bike className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Uber Eats Marketplace</h3>
          <p className="text-xs text-gray-400">
            Pedidos del marketplace entran pagados y se preparan en cocina. Distinto de Uber Direct (reparto).
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 mb-4 text-[11px] font-bold">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
          {configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          Credenciales: {configured ? "listas" : "faltan"}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-gray-300">
          <PlugZap className="h-3.5 w-3.5" /> Entorno: {status?.environment ?? "sandbox"}
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${connection ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-gray-300"}`}>
          <Store className="h-3.5 w-3.5" /> Tienda: {connection?.storeId ?? "sin conectar"}
        </div>
      </div>

      {!configured && (
        <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          Para recibir pedidos reales Uber debe aprobar la integración (NDA, licencia de API, partner manager y
          whitelisting). Faltan <span className="font-mono">UBER_EATS_CLIENT_ID</span> y{" "}
          <span className="font-mono">UBER_EATS_CLIENT_SECRET</span>. Mientras tanto el webhook firmado ya funciona
          en sandbox.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[220px]">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Store ID de Uber Eats</span>
          <input
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder={connection?.storeId ?? "store_xxxxxxxx"}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white outline-none"
          />
        </label>
        <button
          onClick={() => storeId.trim().length >= 2 && connect.mutate({ storeId: storeId.trim() })}
          disabled={connect.isPending || storeId.trim().length < 2}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-40"
        >
          {connection ? "Actualizar tienda" : "Conectar tienda"}
        </button>
        <button
          onClick={() => syncMenu.mutate(undefined)}
          disabled={syncMenu.isPending || !connection}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10 disabled:opacity-40"
        >
          <UploadCloud className="h-3.5 w-3.5" /> {syncMenu.isPending ? "Publicando…" : "Publicar menú"}
        </button>
        <button
          onClick={() => setOnline.mutate({ online: true })}
          disabled={!connection || setOnline.isPending}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10 disabled:opacity-40"
        >
          <Power className="h-3.5 w-3.5" /> Abrir tienda
        </button>
        {connection && (
          <button
            onClick={() => disconnect.mutate(undefined)}
            disabled={disconnect.isPending}
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
          >
            Desconectar
          </button>
        )}
      </div>

      <div className="mt-3">
        <a
          href="/reports/products?channel=UBER_EATS"
          className="text-[11px] font-bold text-cyan-300 underline"
        >
          Ver ventas por producto de Uber Eats →
        </a>
      </div>

      {status?.recentEvents && status.recentEvents.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Últimos webhooks</p>
          <ul className="space-y-1 text-[11px] text-gray-400">
            {status.recentEvents.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-white/5 px-2 py-1">
                <span className="font-mono">{e.eventType}</span>
                <span>{e.externalId}</span>
                <span className={e.processed ? "text-emerald-400" : "text-amber-400"}>{e.processed ? "procesado" : "pendiente"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
