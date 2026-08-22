"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { AlertCircle, CreditCard, ArrowLeft, Check, Search, RotateCcw } from "lucide-react";
import { toast, Card, Badge } from "@rabbitty/ui";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta Crédito",
  DEBIT_CARD: "Tarjeta Débito",
  BUNZ: "Bunz",
};

const METHOD_COLORS: Record<string, string> = {
  CASH: "bg-green-500/10 text-green-400 border-green-500/20",
  CREDIT_CARD: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DEBIT_CARD: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  BUNZ: "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

export default function RefundsPage() {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState("");

  const { data: payments, isLoading, refetch } = trpc.payments.list.useQuery({ limit: 100 });
  const todayStr = new Date().toISOString().split("T")[0]!;
  const { data: totals } = trpc.payments.getTotals.useQuery({ startDate: todayStr, endDate: todayStr });
  const { mutate: refundPayment, isPending } = trpc.payments.refund.useMutation({
    onSuccess: () => { toast.success("Reembolso procesado"); setSelectedPaymentId(null); setRefundNote(""); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const completedPayments = payments?.filter(p => p.payment.status !== "REFUNDED") ?? [];
  const refundedPayments = payments?.filter(p => p.payment.status === "REFUNDED") ?? [];

  const handleRefund = () => {
    if (!selectedPaymentId) return;
    refundPayment({ paymentId: selectedPaymentId, amount: 0, reason: refundNote || "Sin razón especificada" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Reembolsos</h2>
            <p className="text-sm text-gray-400">Procesa y consulta reembolsos de pagos</p>
          </div>
          <div className="flex gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-gray-400">Total:</span>
              <span className="ml-2 font-bold text-white">${totals?.total.toFixed(2) ?? "0.00"}</span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Efectivo", value: totals?.cash ?? 0, color: "from-green-500/20 to-green-600/10 border-green-500/30" },
            { label: "Tarjeta", value: totals?.card ?? 0, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30" },
            { label: "Bunz", value: totals?.bunz ?? 0, color: "from-pink-500/20 to-pink-600/10 border-pink-500/30" },
            { label: "Reembolsados", value: refundedPayments.reduce((s, p) => s + Math.abs(p.payment.amount), 0), color: "from-red-500/20 to-red-600/10 border-red-500/30" },
          ].map((item, i) => (
            <Card key={i} className={`bg-gradient-to-br ${item.color} border p-5 backdrop-blur-md`}>
              <p className="text-sm text-gray-400">{item.label}</p>
              <p className="text-2xl font-black text-white">${item.value.toFixed(2)}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Payment List */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-white/10 bg-white/5 backdrop-blur-md">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="font-bold text-white">Pagos Procesados</h3>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                </div>
              ) : completedPayments.length === 0 ? (
                <div className="p-12 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-gray-600" />
                  <p className="text-sm text-gray-500">No hay pagos procesados aún</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {completedPayments.map(({ payment, order }) => (
                    <div
                      key={payment.id}
                      onClick={() => setSelectedPaymentId(payment.id)}
                      className={`flex items-center justify-between px-6 py-4 transition-colors cursor-pointer hover:bg-white/5 ${
                        selectedPaymentId === payment.id ? "bg-pink-500/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${METHOD_COLORS[payment.method] ?? "border-white/10 text-gray-400"}`}>
                          {METHOD_LABELS[payment.method] ?? payment.method}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">${payment.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{order?.customerName ?? "Sin cliente"} · {new Date(payment.createdAt ?? "").toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge variant={payment.status === "REFUNDED" ? "danger" : "success"}>
                        {payment.status === "REFUNDED" ? "Reembolsado" : "Completado"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Refunded History */}
            {refundedPayments.length > 0 && (
              <Card className="border border-red-500/10 bg-red-500/5 backdrop-blur-md">
                <div className="border-b border-white/10 px-6 py-4">
                  <h3 className="font-bold text-red-400">Historial de Reembolsos</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {refundedPayments.map(({ payment }) => (
                    <div key={payment.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <RotateCcw className="h-4 w-4 text-red-400" />
                        <p className="text-sm text-gray-400">${Math.abs(payment.amount).toFixed(2)} · {payment.reference ?? ""}</p>
                      </div>
                      <p className="text-xs text-gray-500">{new Date(payment.createdAt ?? "").toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Refund Form */}
          <div>
            <Card className="border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <RotateCcw className="h-5 w-5 text-pink-400" />
                Procesar Reembolso
              </h3>

              {!selectedPaymentId ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                  <AlertCircle className="mx-auto mb-3 h-8 w-8 text-gray-500" />
                  <p className="text-sm text-gray-400">Selecciona un pago de la lista para reembolsar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-4">
                    <p className="text-xs text-gray-400 mb-1">Pago seleccionado</p>
                    <p className="text-sm font-bold text-white">{selectedPaymentId}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Motivo del Reembolso</label>
                    <textarea
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                      placeholder="Ej: Pedido incorrecto, cancelación por el cliente..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                    <CreditCard className="h-5 w-5 text-amber-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-300">Reembolso automático a Bunz</p>
                      <p className="text-xs text-amber-400/70">El usuario recibirá Bunz equivalentes al monto reembolsado</p>
                    </div>
                  </div>

                  <button
                    onClick={handleRefund}
                    disabled={isPending || !refundNote}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-700 px-4 py-3 text-sm font-bold text-white hover:from-pink-500 hover:to-pink-600 disabled:opacity-50 transition-all"
                  >
                    {isPending ? "Procesando..." : (
                      <>
                        <Check className="h-4 w-4" />
                        Confirmar Reembolso
                      </>
                    )}
                  </button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
