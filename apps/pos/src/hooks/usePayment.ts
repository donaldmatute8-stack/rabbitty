"use client";

import { trpc } from "../lib/trpc-client";
import { toast } from "@rabbitty/ui";

export function usePayment() {
  const utils = trpc.useUtils();
  const payMutation = trpc.pos.payOrder.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
      utils.pos.getTables.invalidate();
      toast.success("Pago exitoso");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return {
    pay: payMutation.mutate,
    isPaying: payMutation.isPending,
  };
}
