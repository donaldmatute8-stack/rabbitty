"use client";

import { useState } from "react";
import { Dialog } from "@rabbitty/ui";
import { DollarSign, Split } from "lucide-react";
import { trpc } from "../lib/trpc-client";

interface SplitBillModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  total: number;
}

export function SplitBillModal({ open, onClose, orderId, total }: SplitBillModalProps) {
  const [splits, setSplits] = useState<{ method: "CASH" | "CREDIT_CARD"; amount: number }[]>([
    { method: "CASH", amount: Math.round(total / 2 * 100) / 100 },
    { method: "CREDIT_CARD", amount: Math.round(total / 2 * 100) / 100 },
  ]);

  const payMutation = trpc.pos.payOrder.useMutation();

  const updateSplit = (index: number, field: "method" | "amount", value: string | number) => {
    setSplits(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addSplit = () => {
    setSplits(prev => [...prev, { method: "CASH", amount: 0 }]);
  };

  const removeSplit = (index: number) => {
    setSplits(prev => prev.filter((_, i) => i !== index));
  };

  const handlePay = () => {
    splits.forEach(split => {
      payMutation.mutate({ orderId, method: split.method, amount: split.amount });
    });
    onClose();
  };

  const remaining = total - splits.reduce((s, split) => s + split.amount, 0);

  return (
    <Dialog open={open} onClose={onClose} title="Dividir Cuenta">
      <div className="space-y-4">
        {splits.map((split, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
            <select
              value={split.method}
              onChange={(e) => updateSplit(i, "method", e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={split.amount}
              onChange={(e) => updateSplit(i, "amount", parseFloat(e.target.value) || 0)}
              className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-right"
            />
            <button onClick={() => removeSplit(i)} className="text-sm text-red-500 hover:text-red-700">
              Quitar
            </button>
          </div>
        ))}

        <button onClick={addSplit} className="flex items-center gap-2 text-sm font-medium text-pink-600 hover:text-pink-700">
          <Split className="h-4 w-4" />
          Agregar forma de pago
        </button>

        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm text-gray-500">Total: ${total.toFixed(2)}</span>
          <span className={`text-sm font-semibold ${remaining === 0 ? "text-green-600" : "text-red-500"}`}>
            Restante: ${remaining.toFixed(2)}
          </span>
        </div>

        <button
          onClick={handlePay}
          disabled={remaining !== 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
        >
          <DollarSign className="h-4 w-4" />
          Pagar ({splits.length} formas)
        </button>
      </div>
    </Dialog>
  );
}
