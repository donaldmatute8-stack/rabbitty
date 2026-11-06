"use client";

import { useState } from "react";
import { Dialog, Button, toast } from "@rabbitty/ui";
import { AlertTriangle } from "lucide-react";
import { trpc } from "../lib/trpc-client";

/**
 * OT-1 · Motivo del rechazo de una redención Bunz.
 *
 * El motivo es **obligatorio** y del catálogo cerrado. Escribe en
 * `bunz_redemption_attempts`; sin esto, la demanda no atendida no existe.
 */

const REASONS = [
  { id: "capacity_exhausted", label: "Sin capacidad de redención" },
  { id: "out_of_stock", label: "Sin inventario / servicio" },
  { id: "affiliate_refused", label: "El negocio rechazó la operación" },
  { id: "closed", label: "Negocio cerrado" },
  { id: "inactive_branch", label: "Sucursal inactiva" },
  { id: "tech_failure", label: "Fallo técnico" },
  { id: "user_cancelled", label: "El cliente canceló" },
  { id: "duplicate", label: "Solicitud duplicada" },
  { id: "fraud", label: "Sospecha de fraude" },
  { id: "unknown", label: "Otro / no se sabe" },
] as const;

type ReasonId = (typeof REASONS)[number]["id"];

interface Props {
  open: boolean;
  orderId: string;
  bunz: number;
  onClose: () => void;
  onRecorded?: () => void;
}

export function RedemptionRejectModal({ open, orderId, bunz, onClose, onRecorded }: Props) {
  const [reason, setReason] = useState<ReasonId | null>(null);

  const mutation = trpc.pos.recordRedemptionAttempt.useMutation({
    onSuccess: (res: { ok: boolean }) => {
      if (res?.ok) {
        toast.success("Motivo registrado");
        onRecorded?.();
        onClose();
      } else {
        toast.error("No se pudo registrar el motivo");
      }
    },
    onError: () => toast.error("No se pudo registrar el motivo"),
  });

  return (
    <Dialog open={open} onClose={onClose} title="¿Por qué no se pudo redimir?">
      <div className="p-2 space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Se registrará un intento de redención de <b>{bunz.toFixed(2)} Bunz</b> de la orden{" "}
            <b>{orderId}</b>. El motivo es obligatorio: sin él no se puede medir la demanda no atendida.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className={
                "text-left px-3 py-2 rounded-lg border text-sm transition-colors " +
                (reason === r.id
                  ? "border-pink-500 bg-pink-50 text-pink-700 font-semibold"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
              }
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!reason || mutation.isPending}
            onClick={() => {
              if (!reason) return;
              mutation.mutate({
                orderId,
                bunz,
                reasons: [reason],
                status: reason === "duplicate" ? "duplicate" : reason === "fraud" ? "fraud" : reason === "user_cancelled" ? "cancelled" : "unfulfilled",
                idempotencyKey: `rej-${orderId}-${Date.now()}`,
              });
            }}
          >
            {mutation.isPending ? "Registrando…" : "Registrar motivo"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
