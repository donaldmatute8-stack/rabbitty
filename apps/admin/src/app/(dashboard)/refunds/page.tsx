"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { AlertCircle, CreditCard, ArrowLeft, Check } from "lucide-react";
import { toast } from "@rabbitty/ui";

interface Payment {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function RefundsPage() {
  const { data: payments } = trpc.payments.getTotals.useQuery({ startDate: "", endDate: "" });
  const { mutate: refundPayment, isPending } = trpc.payments.refund.useMutation({
    onSuccess: () => toast.success("Reembolso procesado"),
    onError: (err) => toast.error(err.message),
  });

  const [refundOrder, setRefundOrder] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState("");

  const handleRefund = (paymentId: string) => {
    refundPayment({ paymentId, amount: 0, reason: refundNote || "Sin razón especificada" });
    setRefundOrder(null);
    setRefundNote("");
  };

  if (!payments) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-600 border-t-transparent" />
      </div>
    );
  }

  const pendingPayments = { cash: 0, card: 0, bunz: 0 };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reembolsos</h2>
            <p className="text-sm text-gray-500">Procesar reembolsos de pagos</p>
          </div>
          <div className="flex gap-2 text-sm">
            <div className="rounded-lg bg-gray-100 px-3 py-1">
              <span className="text-gray-500">Total vendido:</span>
              <span className="ml-2 font-semibold text-gray-900">
                ${payments.total.toFixed(2)}
              </span>
            </div>
             <div className="rounded-lg bg-gray-100 px-3 py-1">
               <span className="text-gray-500">Total:</span>
               <span className="ml-2 font-semibold text-gray-900">
                 ${payments.total.toFixed(2)}
               </span>
             </div>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Efectivo", value: ` $${pendingPayments.cash?.toFixed(2) ?? "0.00"}`, color: "bg-green-500" },
              { label: "Tarjeta", value: ` $${pendingPayments.card?.toFixed(2) ?? "0.00"}`, color: "bg-blue-500" },
              { label: "Bunz", value: ` $${pendingPayments.bunz?.toFixed(2) ?? "0.00"}`, color: "bg-pink-500" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-xl font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Refund List */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
              <h3 className="font-semibold text-gray-900">Historial de Pagos</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Placeholder: Show recent payments from POS orders */}
              <div className="p-6 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Los pagos procesados aparecerán aquí una vez se completen
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Para reembolsar, selecciona un pago y proporciona una razón
                </p>
              </div>
            </div>
          </div>

          {/* Refund Form */}
          <div className="rounded-2xl border border-pink-200 bg-pink-50/30 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-pink-700">
              <AlertCircle className="h-5 w-5" />
              Procesar Reembolso
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID de Pago
                </label>
                <input
                  type="text"
                  placeholder="payment_123..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                  readOnly
                />
                <p className="mt-1 text-xs text-gray-400">
                  (Selecciona un pago desde el historial)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo del Reembolso
                </label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="Ej: Pedido incorrecto, cancelación por el cliente..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-pink-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-pink-100 p-3">
                <CreditCard className="h-5 w-5 text-pink-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-pink-800">
                    Reembolso automático a Bunz
                  </p>
                  <p className="text-xs text-pink-600">
                    El usuario recibirá Bunz equivalentes al monto reembolsado
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRefund("pending_payment_id")}
                disabled={isPending || !refundNote}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {isPending ? "Procesando..." : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirmar Reembolso
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
