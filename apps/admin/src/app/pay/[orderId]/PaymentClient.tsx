"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Button, toast } from "@rabbitty/ui";
import { CreditCard, Users, Coins, Check, Receipt } from "lucide-react";

const TIP_OPTIONS = [0, 10, 15, 20];

export function PaymentClient({ order }: { order: any }) {
  const utils = trpc.useUtils();
  const [view, setView] = useState<"pay" | "split" | "tip" | "done">("pay");
  const [tipPercent, setTipPercent] = useState(15);
  const [customTip, setCustomTip] = useState("");
  const [splitCount, setSplitCount] = useState(2);
  const [paying, setPaying] = useState(false);

  const processPayment = trpc.payments.processPayment.useMutation({
    onSuccess: () => { setView("done"); toast.success("Pago exitoso"); },
    onError: (e) => toast.error(e.message),
  });
  const splitBill = trpc.payments.splitBill.useMutation({
    onSuccess: () => { setView("done"); toast.success("Cuenta dividida"); },
    onError: (e) => toast.error(e.message),
  });
  const addTip = trpc.payments.addTip.useMutation({
    onSuccess: () => { setView("done"); toast.success("Propina agregada"); },
    onError: (e) => toast.error(e.message),
  });

  const tipAmount = order.total * (tipPercent / 100);
  const splitAmount = order.total / splitCount;

  const handlePay = () => {
    processPayment.mutate({ orderId: order.id, method: "CREDIT_CARD", amount: order.total });
  };

  const handleSplitPay = () => {
    const splits = Array(splitCount).fill(null).map(() => ({ amount: splitAmount, method: "CASH" as const }));
    splitBill.mutate({ orderId: order.id, splits });
  };

  const handleTip = () => {
    addTip.mutate({ orderId: order.id, tip: customTip ? parseFloat(customTip) : tipAmount, method: "CREDIT_CARD" });
  };

  if (view === "done") {
    return (
      <Card className="border border-emerald-500/20 bg-emerald-500/5 p-8 text-center backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mx-auto mb-4">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">¡Pago Exitoso!</h2>
        <p className="text-sm text-gray-400">Tu recibo se ha enviado a la cocina. ¡Gracias por tu visita!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {view === "pay" && (
        <>
          <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setView("split")}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:border-pink-500/30 transition-all"
              >
                <Users className="h-6 w-6 text-blue-400" />
                <span className="text-xs font-bold text-gray-300">Dividir</span>
              </button>
              <button
                onClick={() => setView("tip")}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:border-pink-500/30 transition-all"
              >
                <Coins className="h-6 w-6 text-amber-400" />
                <span className="text-xs font-bold text-gray-300">Propina</span>
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex flex-col items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 p-4 hover:bg-pink-500/20 transition-all"
              >
                <CreditCard className="h-6 w-6 text-pink-400" />
                <span className="text-xs font-bold text-pink-400">{paying ? "..." : "Pagar"}</span>
              </button>
            </div>
          </Card>
          <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-5 w-5 text-white/70" />
              <h3 className="font-bold text-white">Recibo Digital</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Al pagar, recibirás tu recibo en Telegram</p>
            <Button className="w-full" onClick={handlePay} disabled={paying}>
              <CreditCard className="h-4 w-4" />
              Pagar ${order.total.toFixed(2)}
            </Button>
          </Card>
        </>
      )}

      {view === "split" && (
        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md">
          <h3 className="font-bold text-white mb-4">Dividir Cuenta</h3>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white hover:border-pink-500/30"
            >-</button>
            <span className="text-2xl font-black text-white">{splitCount}</span>
            <button
              onClick={() => setSplitCount(Math.min(10, splitCount + 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white hover:border-pink-500/30"
            >+</button>
          </div>
          <p className="text-sm text-gray-400 mb-4">${splitAmount.toFixed(2)} por persona</p>
          <Button className="w-full" onClick={handleSplitPay} disabled={paying}>
            <Users className="h-4 w-4" />
            Dividir en {splitCount}
          </Button>
        </Card>
      )}

      {view === "tip" && (
        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md">
          <h3 className="font-bold text-white mb-4">Agregar Propina</h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {TIP_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => { setTipPercent(p || 0); setCustomTip(""); }}
                className={`rounded-xl border py-3 text-center text-sm font-bold transition-all ${
                  tipPercent === p && !customTip
                    ? "border-pink-500/50 bg-pink-500/10 text-pink-400"
                    : "border-white/10 bg-white/5 text-gray-300 hover:border-pink-500/30"
                }`}
              >
                {p === 0 ? "Sin" : `${p}%`}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Otra cantidad</label>
            <input
              type="number"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none mt-1"
              placeholder="0.00"
              value={customTip}
              onChange={(e) => { setCustomTip(e.target.value); setTipPercent(0); }}
            />
          </div>
          {tipPercent > 0 && !customTip && (
            <p className="text-sm text-pink-400 font-bold mb-4">${tipAmount.toFixed(2)} de propina</p>
          )}
          <Button className="w-full" onClick={handleTip} disabled={paying || (!tipPercent && !customTip)}>
            <Coins className="h-4 w-4" />
            Agregar Propina
          </Button>
        </Card>
      )}
    </div>
  );
}
