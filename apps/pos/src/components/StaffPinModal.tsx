"use client";

import { useState, useRef } from "react";
import { Dialog } from "@rabbitty/ui";
import { KeyRound } from "lucide-react";
import { trpc } from "../lib/trpc-client";

interface StaffPinModalProps {
  open: boolean;
  branchId: string;
  onClose: () => void;
  onAuthenticated: (staffName: string, role: string) => void;
}

export function StaffPinModal({ open, branchId, onClose, onAuthenticated }: StaffPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const verifyPin = trpc.staff.verifyPin.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("El PIN debe tener 4 dígitos");
      return;
    }

    const result = await verifyPin.mutateAsync({ pin, branchId });
    if (result.verified && "name" in result && result.name && "role" in result && result.role) {
      onAuthenticated(result.name, result.role);
      setPin("");
      setError("");
      onClose();
    } else {
      setError("PIN inválido");
      setPin("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Autenticación de Personal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-100">
            <KeyRound className="h-8 w-8 text-pink-600" />
          </div>
        </div>
        <p className="text-center text-sm text-gray-500">Ingresa tu PIN de 4 dígitos</p>
        <input
          ref={inputRef}
          type="password"
          maxLength={4}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
          className="mx-auto block w-32 rounded-xl border-2 border-gray-200 bg-white py-3 text-center text-2xl font-bold tracking-[0.5em] focus:border-pink-500 focus:outline-none"
          autoFocus
        />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-pink-600 py-3 text-sm font-semibold text-white hover:bg-pink-700">
          Ingresar
        </button>
      </form>
    </Dialog>
  );
}
