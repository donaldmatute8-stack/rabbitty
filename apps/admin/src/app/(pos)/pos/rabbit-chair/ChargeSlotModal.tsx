"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { Button, Dialog, cn } from "@rabbitty/ui";

/**
 * ── Cobro del aporte de La Silla (POS) ──────────────────────────────────────
 * Reemplaza el `window.prompt`: monto editable, método explícito y desglose de
 * IVA. El efectivo solo se ofrece cuando la activación lo permite
 * (`cardOnly = false`); el backend vuelve a validarlo.
 */

export type ChargeMethod = "CARD" | "CASH";

export function ChargeSlotModal({
  open,
  slot,
  minContributionCents,
  cardOnly,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  slot: { id: string; index: number; guestName?: string | null } | null;
  minContributionCents: number;
  cardOnly: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: (input: { amountCents: number; method: ChargeMethod }) => void;
}) {
  const min = Math.max(0, Math.round(Number(minContributionCents) || 0)) / 100;
  const [amount, setAmount] = useState(min.toFixed(2));
  const [method, setMethod] = useState<ChargeMethod>("CARD");
  const [error, setError] = useState("");

  // Cada lugar abre con el mínimo y tarjeta; si el negocio no acepta efectivo,
  // el método queda fijo en tarjeta.
  useEffect(() => {
    if (!open) return;
    setAmount(min.toFixed(2));
    setMethod("CARD");
    setError("");
  }, [open, slot?.id, min]);

  const parsed = Number(amount);
  const amountCents = Math.round((Number.isFinite(parsed) ? parsed : 0) * 100);
  const breakdown = useMemo(() => {
    const total = Math.max(0, amountCents) / 100;
    const subtotal = Math.round((total / 1.16) * 100) / 100;
    return {
      total: Math.round(total * 100) / 100,
      subtotal,
      tax: Math.round((total - subtotal) * 100) / 100,
    };
  }, [amountCents]);

  const belowMin = amountCents < Math.round(min * 100);

  const submit = () => {
    if (belowMin) {
      setError(`El aporte mínimo es de $${min.toFixed(0)}`);
      return;
    }
    if (cardOnly && method === "CASH") {
      setError("Esta experiencia es solo con tarjeta");
      return;
    }
    setError("");
    onConfirm({ amountCents, method });
  };

  return (
    <Dialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      kicker="Rabbit Chair · La Silla"
      title={slot ? `Cobrar lugar #${slot.index}` : "Cobrar aporte"}
    >
      <div className="space-y-4">
        {slot?.guestName && (
          <p className="m-0 text-xs text-gray-400">Invitado: {slot.guestName}</p>
        )}

        <div>
          <label
            htmlFor="rabbit-chair-amount"
            className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500"
          >
            Aporte (mínimo ${min.toFixed(0)})
          </label>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-gray-400">$</span>
            <input
              id="rabbit-chair-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-lg font-black text-white outline-none focus:border-cyan-500"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAmount(min.toFixed(2))}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-gray-300 hover:bg-white/10"
            >
              Mínimo
            </button>
            {[50, 100].map((extra) => (
              <button
                key={extra}
                type="button"
                onClick={() =>
                  setAmount((Number((min * 100 + extra * 100) / 100)).toFixed(2))
                }
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-gray-300 hover:bg-white/10"
              >
                +${extra}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
            Método
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("CARD")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black",
                method === "CARD"
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                  : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10",
              )}
            >
              <CreditCard className="h-4 w-4" /> Tarjeta
            </button>
            <button
              type="button"
              onClick={() => {
                if (cardOnly) return;
                setMethod("CASH");
              }}
              disabled={cardOnly}
              title={cardOnly ? "Esta experiencia es solo con tarjeta" : undefined}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40",
                method === "CASH"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10",
              )}
            >
              <Banknote className="h-4 w-4" /> Efectivo
            </button>
          </div>
          {cardOnly && (
            <p className="mt-1 text-[10px] text-gray-500">
              Esta experiencia es solo con tarjeta.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-gray-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${breakdown.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA 16%</span>
            <span>${breakdown.tax.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-sm font-black text-white">
            <span>Total</span>
            <span>${breakdown.total.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <p className="m-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={submit} disabled={pending || belowMin}>
            {pending ? "Cobrando…" : `Cobrar $${breakdown.total.toFixed(2)}`}
          </Button>
        </div>
        <p className="m-0 text-center text-[10px] text-gray-500">
          Se registra en caja como una venta con canal Rabbit Chair.
        </p>
      </div>
    </Dialog>
  );
}
