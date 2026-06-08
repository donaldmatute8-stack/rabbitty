"use client";

import { useEffect, useState } from "react";
import { Dialog, cn } from "@rabbitty/ui";
import { trpc } from "../lib/trpc-client";
import { Plus } from "lucide-react";

interface ModifierModalProps {
  open: boolean;
  onClose: () => void;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  onConfirm: (modifiers: { id: string; name: string; priceAdjust: number }[]) => void;
}

export function ModifierModal({ open, onClose, menuItemId, menuItemName, menuItemPrice, onConfirm }: ModifierModalProps) {
  const { data: modifiers, isLoading } = trpc.pos.getModifiers.useQuery({ itemId: menuItemId }, { enabled: open });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelectedIds([]);
  }, [open]);

  const handleToggle = (modId: string, maxSelect: number) => {
    if (maxSelect <= 1) {
      setSelectedIds((prev) => (prev.includes(modId) ? [] : [modId]));
    } else {
      setSelectedIds((prev) =>
        prev.includes(modId)
          ? prev.filter((id) => id !== modId)
          : prev.length < maxSelect
            ? [...prev, modId]
            : prev
      );
    }
  };

  const handleConfirm = () => {
    const selectedMods = (modifiers ?? []).filter((m) => selectedIds.includes(m.id));
    onConfirm(selectedMods);
    onClose();
  };

  const extraCost = (modifiers ?? [])
    .filter((m) => selectedIds.includes(m.id))
    .reduce((sum, m) => sum + m.priceAdjust, 0);

  return (
    <Dialog open={open} onClose={onClose} title="Personalizar">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{menuItemName}</p>
            <p className="text-sm text-gray-500">
              ${menuItemPrice.toFixed(2)} base
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-600 border-t-transparent" />
          </div>
        )}

        {!isLoading && modifiers?.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            Sin opciones disponibles
          </p>
        )}

        {!isLoading && modifiers && modifiers.length > 0 && (
          <div className="space-y-2">
            {modifiers.map((mod) => {
              const isSelected = selectedIds.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  onClick={() => handleToggle(mod.id, mod.maxSelect)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all",
                    isSelected
                      ? "border-pink-500 bg-pink-50"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {mod.name}
                    </p>
                    {mod.priceAdjust !== 0 && (
                      <p className="text-xs text-gray-400">
                        {mod.priceAdjust > 0
                          ? `+$${mod.priceAdjust.toFixed(2)}`
                          : `-$${Math.abs(mod.priceAdjust).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center border-2",
                      mod.maxSelect <= 1 ? "rounded-full" : "rounded-md",
                      isSelected
                        ? "border-pink-500 bg-pink-500"
                        : "border-gray-300"
                    )}
                  >
                    {isSelected &&
                      (mod.maxSelect <= 1 ? (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      ) : (
                        <span className="text-[10px] font-bold text-white">
                          ✓
                        </span>
                      ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {extraCost !== 0 && !isLoading && (
          <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="text-gray-500">Cargo adicional</span>
            <span className="font-medium text-green-600">
              +${extraCost.toFixed(2)}
            </span>
          </div>
        )}

        {!isLoading && (
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Agregar (${(menuItemPrice + extraCost).toFixed(2)})
          </button>
        )}
      </div>
    </Dialog>
  );
}
