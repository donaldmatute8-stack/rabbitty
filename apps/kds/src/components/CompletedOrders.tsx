"use client";

import { trpc } from "../lib/trpc-client";
import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function CompletedOrders() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { data: orders } = trpc.kds.getOrders.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

   const completed = (orders ?? []).filter((order) => {
     if (dismissedIds.has(order.id)) return false;
     const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
     if (createdAt < oneHourAgo) return false;
     return order.items.length > 0 && order.items.every((item) => item.status === "SERVED");
   });

  if (completed.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-400">Completadas recientemente</h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
         {completed.map((order) => (
           <div
             key={order.id}
             className="flex items-center justify-between rounded-xl border border-green-800/30 bg-green-950/20 px-4 py-3"
           >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-300">Mesa {order.tableNumber || 0}</p>
                <p className="text-xs text-gray-500">
                   {order.createdAt && new Date(order.createdAt).toLocaleTimeString("es-MX", {
                     hour: "2-digit",
                     minute: "2-digit",
                   })}
                  {" · "}
                  {order.items.length} items
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(order.id))}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
