"use client";

import { trpc } from "../../lib/trpc-client";
import { PosSidebar } from "../../components/PosSidebar";
import { Badge, Button, toast } from "@rabbitty/ui";
import { useState } from "react";
import { ChevronDown, ChevronUp, DollarSign, Split, Percent, RotateCcw } from "lucide-react";
import { SplitBillModal } from "../../components/SplitBillModal";
import { DiscountModal } from "../../components/DiscountModal";

const statusColors: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  open: "warning",
  paid: "success",
  cancelled: "danger",
};

export default function OrdersPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [splitBill, setSplitBill] = useState<{ orderId: string; total: number } | null>(null);
  const [discount, setDiscount] = useState<{ orderId: string; total: number } | null>(null);
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const utils = trpc.useUtils();
  const payOrder = trpc.pos.payOrder.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
      utils.pos.getTables.invalidate();
      setPayingId(null);
      toast.success("Pago registrado");
    },
    onError: (e) => toast.error(e.message),
  });
  const voidOrder = trpc.pos.voidOrder.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
      utils.pos.getTables.invalidate();
      toast.success("Orden cancelada");
    },
    onError: (e) => toast.error(e.message),
  });

  const openOrders = orders?.filter((o) => o.status === "open") ?? [];
  const paidOrders = orders?.filter((o) => o.status === "paid") ?? [];

  const handleVoid = (orderId: string, reason: string) => {
    voidOrder.mutate({ orderId, reason });
  };

  return (
    <div className="flex h-screen">
      <PosSidebar />
      <main className="flex flex-1 flex-col">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Órdenes</h2>
          <p className="text-sm text-gray-500">
            {openOrders.length} activas · {paidOrders.length} pagadas
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!orders ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-medium text-gray-500">Sin órdenes</p>
              <p className="mt-1 text-sm text-gray-400">Las órdenes aparecerán aquí</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                    order.status === "open" ? "border-amber-200" : order.status === "cancelled" ? "border-red-200" : "border-gray-100"
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                     <div className="flex items-center gap-3">
                       <div>
                         <span className="font-bold text-gray-900">
                           {order.orderType === "TAKEOUT"
                             ? "Para llevar"
                             : order.orderType === "DELIVERY"
                               ? "Delivery"
                               : `Orden #${order.id.slice(0, 8)}`}
                         </span>
                        <p className="text-xs text-gray-400">
                          {order.customerName && `${order.customerName}`}
                          {order.customerPhone && ` · ${order.customerPhone}`}
                           {!order.customerName && !order.customerPhone && order.createdAt &&
                             new Date(order.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Badge variant={statusColors[order.status] ?? "default"}>
                        {order.status === "open" ? "Abierta" : order.status === "paid" ? "Pagada" : order.status === "cancelled" ? "Cancelada" : order.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900">${order.total.toFixed(2)}</span>
                      {expandedId === order.id ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expandedId === order.id && (
                    <div className="border-t border-gray-100 px-5 py-3">
                      <div className="space-y-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {item.quantity}x
                              </span>
                              <span className="text-gray-600">{item.name}</span>
                            </div>
                            <span className="text-gray-500">${item.totalPrice.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Subtotal</span>
                          <span>${order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>IVA</span>
                          <span>${order.tax.toFixed(2)}</span>
                        </div>
                        <div className="mt-1 flex justify-between font-bold text-gray-900">
                          <span>Total</span>
                          <span>${order.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {order.status === "open" && (
                        <div className="mt-4 flex flex-col gap-2">
                          {payingId === order.id ? (
                            <div className="flex w-full flex-wrap gap-2">
                               <Button
                                 variant="secondary"
                                 className="flex-1"
                                 onClick={() => payOrder.mutate({ orderId: order.id, method: "CASH", amount: order.total })}
                               >
                                 Efectivo
                               </Button>
                               <Button
                                 variant="secondary"
                                 className="flex-1"
                                 onClick={() => payOrder.mutate({ orderId: order.id, method: "CREDIT_CARD", amount: order.total })}
                               >
                                 Tarjeta
                               </Button>
                               <Button
                                 variant="secondary"
                                 className="flex-1"
                                 onClick={() => payOrder.mutate({ orderId: order.id, method: "BUNZ", amount: order.total })}
                               >
                                bunz
                              </Button>
                              <Button variant="ghost" onClick={() => setPayingId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button className="flex-1" onClick={() => setPayingId(order.id)}>
                                <DollarSign className="h-4 w-4" />
                                Cobrar
                              </Button>
                              <Button variant="secondary" onClick={() => setSplitBill({ orderId: order.id, total: order.total })}>
                                <Split className="h-4 w-4" />
                                Dividir
                              </Button>
                              <Button variant="secondary" onClick={() => setDiscount({ orderId: order.id, total: order.total })}>
                                <Percent className="h-4 w-4" />
                                Dcto
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {splitBill && (
        <SplitBillModal
          open={!!splitBill}
          onClose={() => setSplitBill(null)}
          orderId={splitBill.orderId}
          total={splitBill.total}
        />
      )}

      {discount && (
        <DiscountModal
          open={!!discount}
          onClose={() => setDiscount(null)}
          orderId={discount.orderId}
          currentTotal={discount.total}
          onApplyDiscount={(orderId, discountPercent, reason) => {
            const discountedTotal = discount.total * (1 - discountPercent / 100);
             payOrder.mutate({ orderId, method: "CASH", amount: discountedTotal });
            toast.success(`Descuento de ${discountPercent}% aplicado`);
          }}
          onVoid={handleVoid}
        />
      )}
    </div>
  );
}
