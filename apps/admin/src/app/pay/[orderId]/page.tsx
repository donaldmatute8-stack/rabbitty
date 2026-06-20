"use client";

import { use, useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card } from "@rabbitty/ui";
import { QrCode, Receipt } from "lucide-react";
import { PaymentClient } from "./PaymentClient";

export default function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { data, error } = trpc.payments.getOrderForPayment.useQuery({ orderId });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <Card className="max-w-md w-full border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <QrCode className="h-16 w-16 mx-auto text-gray-500 mb-4" />
          <h1 className="text-xl font-black text-white mb-2">Error</h1>
          <p className="text-sm text-gray-400">{error.message}</p>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <div className="animate-pulse text-center">
          <div className="h-16 w-16 rounded-full bg-white/5 mx-auto mb-4" />
          <div className="h-6 w-48 bg-white/5 rounded-xl mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 p-4">
      <div className="mx-auto max-w-lg space-y-4 pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Tu Cuenta
          </h1>
          {data.tableNumber && (
            <p className="text-sm text-gray-400 mt-1">Mesa {data.tableNumber}</p>
          )}
        </div>

        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-5 w-5 text-pink-400" />
            <h2 className="font-bold text-white">Resumen</h2>
          </div>
          <div className="space-y-2">
            {data.items.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-300">
                  {item.quantity}x {item.menuItemId?.slice(0, 8)}
                </span>
                <span className="text-white font-bold">${item.totalPrice?.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-4 flex justify-between">
            <span className="font-bold text-white">Total</span>
            <span className="font-black text-pink-400 text-lg">${data.order.total?.toFixed(2)}</span>
          </div>
        </Card>

        <PaymentClient order={data.order} />
      </div>
    </div>
  );
}
