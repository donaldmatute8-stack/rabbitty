"use client";

import { useState } from "react";
import { Banknote, CreditCard, Coins, Smartphone, Split } from "lucide-react";
import { cn } from "@rabbitty/ui";

interface PaymentMethodSelectorProps {
  total: number;
  bunzBalance?: number;
  onSelect: (method: "cash" | "card" | "bunz" | "stripe", tip: number) => void;
  onSplitBill: () => void;
}

const methods = [
  { id: "cash" as const, label: "Efectivo", icon: Banknote, description: "Pago en efectivo" },
  { id: "card" as const, label: "Tarjeta", icon: CreditCard, description: "Débito o crédito" },
  { id: "stripe" as const, label: "Stripe", icon: Smartphone, description: "Pago con link" },
  { id: "bunz" as const, label: "Bunz", icon: Coins, description: "Paga con tus Bunz" },
];

const tipOptions = [0, 10, 15, 20];

export function PaymentMethodSelector({ total, bunzBalance = 0, onSelect, onSplitBill }: PaymentMethodSelectorProps) {
  const [selected, setSelected] = useState<"cash" | "card" | "bunz" | "stripe" | null>(null);
  const [tipPercent, setTipPercent] = useState(0);
  const [customTip, setCustomTip] = useState(false);

  const tipAmount = customTip ? 0 : total * (tipPercent / 100);
  const finalTotal = total + tipAmount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {methods.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
              selected === id
                ? "border-pink-500 bg-pink-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <Icon className={cn("h-6 w-6", selected === id ? "text-pink-600" : "text-gray-400")} />
            <span className={cn("text-sm font-semibold", selected === id ? "text-pink-700" : "text-gray-700")}>{label}</span>
            <span className="text-xs text-gray-400">{description}</span>
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Propina</p>
        <div className="flex gap-2">
          {tipOptions.map(pct => (
            <button
              key={pct}
              onClick={() => { setTipPercent(pct); setCustomTip(false); }}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium",
                !customTip && tipPercent === pct ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {pct === 0 ? "Sin" : `${pct}%`}
            </button>
          ))}
          <button
            onClick={() => { setCustomTip(true); setTipPercent(0); }}
            className={cn("rounded-lg px-4 py-2 text-sm font-medium", customTip ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-4">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Subtotal</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Propina ({tipPercent}%)</span>
          <span>${tipAmount.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
          <span>Total</span>
          <span>${finalTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSplitBill}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Split className="h-4 w-4" />
          Dividir
        </button>
        <button
          onClick={() => selected && onSelect(selected, tipAmount)}
          disabled={!selected}
          className="flex-1 rounded-xl bg-pink-600 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
        >
          Pagar ${finalTotal.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
