"use client";

import { useState } from "react";
import { Dialog, toast } from "@rabbitty/ui";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { SplitBillModal } from "./SplitBillModal";
import { trpc } from "../lib/trpc-client";

interface CheckoutModalProps {
  orderId: string;
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ orderId, total, onClose, onSuccess }: CheckoutModalProps) {
  const [showSplit, setShowSplit] = useState(false);
  const payMutation = trpc.pos.payOrder.useMutation({
    onSuccess: () => {
      toast.success("¡Pago registrado con éxito!");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Error al procesar el pago");
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

  return (
    <>
      <Dialog open={true} onClose={onClose} title="Procesar Pago">
        <div className="p-1">
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
