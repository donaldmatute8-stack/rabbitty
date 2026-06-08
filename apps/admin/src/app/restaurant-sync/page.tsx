"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc-client";
import { Store, RefreshCw } from "lucide-react";
import { toast } from "@rabbitty/ui";

export default function RestaurantSyncPage() {
  const { data: restaurants } = trpc.admin.getRestaurants.useQuery();
  const { mutateAsync: syncRestaurant } = trpc.fastapi.syncRestaurant.useMutation();

  const [syncing, setSyncing] = useState(false);

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
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Sincronización de Restaurant</h2>
          <p className="text-sm text-gray-500">Sincroniza restaurantes con FastAPI para Core transactions</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Restaurantes</h3>
              <button
                onClick={handleSyncAll}
                disabled={syncing || !restaurants}
                className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : `Sincronizar todos (${restaurants?.length || 0})`}
              </button>
            </div>

            {restaurants?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Store className="mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-500">No hay restaurantes registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {restaurants?.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{restaurant.name}</p>
                      <p className="text-xs text-gray-500">
                        ID: {restaurant.id.slice(0, 8)}...
                      </p>
                    </div>
                    <button
                      onClick={() => handleSyncRestaurant(restaurant.id)}
                      disabled={syncing}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Sincronizar
                    </button>
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
