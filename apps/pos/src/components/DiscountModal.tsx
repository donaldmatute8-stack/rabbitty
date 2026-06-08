"use client";

import { useState } from "react";
import { Dialog } from "@rabbitty/ui";
import { Percent, RotateCcw } from "lucide-react";

interface DiscountModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  currentTotal: number;
  onApplyDiscount: (orderId: string, discountPercent: number, reason: string) => void;
  onVoid: (orderId: string, reason: string) => void;
}

export function DiscountModal({ open, onClose, orderId, currentTotal, onApplyDiscount, onVoid }: DiscountModalProps) {
  const [discount, setDiscount] = useState(0);
  const [reason, setReason] = useState("");

  const discountedTotal = currentTotal * (1 - discount / 100);

  return (
    <Dialog open={open} onClose={onClose} title="Descuento / Cancelar">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Descuento (%)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={discount}
            onChange={(e) => setDiscount(parseInt(e.target.value))}
            className="mt-2 w-full accent-pink-600"
          />
          <div className="mt-1 flex justify-between text-sm text-gray-500">
            <span>{discount}%</span>
            <span className="font-semibold text-gray-900">-${(currentTotal - discountedTotal).toFixed(2)}</span>
          </div>
        </div>

        <div className="rounded-xl bg-green-50 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total original</span>
            <span className="font-medium text-gray-900">${currentTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Descuento ({discount}%)</span>
            <span className="font-medium text-red-500">-${(currentTotal - discountedTotal).toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-green-200 pt-1">
            <span className="font-semibold text-gray-900">Total final</span>
            <span className="font-bold text-green-700">${discountedTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Razón</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Cliente frecuente"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { onApplyDiscount(orderId, discount, reason); onClose(); }}
            disabled={discount === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Percent className="h-4 w-4" />
            Aplicar {discount}%
          </button>
          <button
            onClick={() => { onVoid(orderId, reason); onClose(); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            <RotateCcw className="h-4 w-4" />
            Cancelar orden
          </button>
        </div>
      </div>
    </Dialog>
  );
}
