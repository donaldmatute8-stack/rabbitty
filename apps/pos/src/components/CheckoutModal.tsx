"use client";

import { useState } from "react";
import { Dialog, toast, Button, Input } from "@rabbitty/ui";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { SplitBillModal } from "./SplitBillModal";
import { QrCustomerLogin } from "./QrCustomerLogin";
import { trpc } from "../lib/trpc-client";
import { User, QrCode } from "lucide-react";

interface CheckoutModalProps {
  orderId: string;
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ orderId, total, onClose, onSuccess }: CheckoutModalProps) {
  const [showSplit, setShowSplit] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [showQr, setShowQr] = useState(false);

  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const order = orders?.find((o) => o.id === orderId);

  const utils = trpc.useUtils();

  const payMutation = trpc.pos.payOrder.useMutation({
    onSuccess: () => {
      toast.success("¡Pago registrado con éxito!");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Error al procesar el pago");
    },
  });

  const linkMutation = trpc.pos.linkCustomerToOrder.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
      toast.success("¡Cliente asociado con éxito!");
      setPhoneInput("");
      setShowQr(false);
    },
    onError: (err) => {
      toast.error(err.message || "Error al asociar cliente");
    },
  });

  const handleSelectPayment = async (method: "cash" | "card" | "bunz" | "stripe", tip: number) => {
    let apiMethod: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "BUNZ";
    if (method === "cash") {
      apiMethod = "CASH";
    } else if (method === "card") {
      apiMethod = "CREDIT_CARD";
    } else if (method === "bunz") {
      apiMethod = "BUNZ";
    } else {
      apiMethod = "CREDIT_CARD"; // Stripe
    }

    try {
      await payMutation.mutateAsync({
        orderId,
        method: apiMethod,
        amount: total + tip,
      });
    } catch {
      // Error is handled in onError of payMutation
    }
  };

  const handleCustomerIdentified = async (userId: string) => {
    await linkMutation.mutateAsync({
      orderId,
      customerPhone: userId,
    });
  };

  return (
    <>
      <Dialog open={true} onClose={onClose} title="Procesar Pago">
        <div className="p-2 space-y-4">
          {/* Customer Linking Section */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <User className="h-4 w-4 text-pink-600" />
                Asociar Cliente (Recompensas Bunz)
              </h4>
              {order?.customerPhone && (
                <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-black text-pink-600">
                  Vinculado
                </span>
              )}
            </div>

            {order?.customerPhone ? (
              <div className="flex items-center justify-between text-sm bg-white p-3 rounded-lg border border-gray-100">
                <div>
                  <p className="font-semibold text-gray-700">Identificador/Tel: {order.customerPhone}</p>
                  {order.customerName && <p className="text-xs text-gray-400">Nombre: {order.customerName}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => linkMutation.mutate({ orderId, customerPhone: "" })}
                  className="text-red-500 hover:text-red-600 font-semibold text-xs"
                  disabled={linkMutation.isPending}
                >
                  Desvincular
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Teléfono del cliente o ID (e.g. 5512345678)"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="flex-1 bg-white text-black"
                  />
                  <Button
                    onClick={() => phoneInput && linkMutation.mutate({ orderId, customerPhone: phoneInput })}
                    disabled={!phoneInput || linkMutation.isPending}
                    size="sm"
                  >
                    Asociar
                  </Button>
                </div>
                
                <div className="flex justify-center">
                  {!showQr ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowQr(true)}
                      className="text-pink-600 flex items-center gap-1.5 text-xs font-semibold hover:bg-pink-50"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Escanear QR del Cliente
                    </Button>
                  ) : (
                    <div className="w-full border-t border-gray-100 pt-3">
                      <QrCustomerLogin
                        orderId={orderId}
                        onCustomerIdentified={handleCustomerIdentified}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowQr(false)}
                        className="w-full mt-2 text-xs"
                      >
                        Cancelar Escaneo
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <PaymentMethodSelector
            total={total}
            onSelect={handleSelectPayment}
            onSplitBill={() => setShowSplit(true)}
          />
        </div>
      </Dialog>

      {showSplit && (
        <SplitBillModal
          open={showSplit}
          onClose={() => {
            setShowSplit(false);
            onSuccess();
          }}
          orderId={orderId}
          total={total}
        />
      )}
    </>
  );
}
