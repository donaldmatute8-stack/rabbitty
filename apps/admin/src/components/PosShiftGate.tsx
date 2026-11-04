"use client";

/**
 * ── Inicio de turno por PIN (Fase 3 del ADR-014) ──
 *
 * La terminal identifica al dispositivo; este paso identifica a la PERSONA.
 * Se muestra solo cuando `POS_OPERATOR_SESSIONS=1` y la terminal ya está
 * autorizada. El PIN es el `staff.pinCode` existente: no se guarda en claro.
 */

import { useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc-client";
import { savePosOperator } from "../lib/pos-terminal";
import { toast } from "@rabbitty/ui";
import { Delete, Lock, LogOut, ShieldCheck, UserRound } from "lucide-react";

export function PosShiftGate({
  terminalName,
  branchName,
  onStarted,
}: {
  terminalName?: string | null;
  branchName?: string | null;
  onStarted: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  // Evita disparar el mismo PIN dos veces si el efecto se reevalúa.
  const submittedRef = useRef(false);

  const { data: staffList } = trpc.posOperators.staffList.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const startShift = trpc.posOperators.startShift.useMutation({
    onSuccess: (data) => {
      submittedRef.current = false;
      setPin("");
      setError("");
      if (data.token) {
        savePosOperator(data.token, {
          staffId: data.operator.staffId,
          name: data.operator.name,
          role: data.operator.role,
          expiresAt:
            "expiresAt" in data && data.expiresAt
              ? new Date(data.expiresAt).toISOString()
              : null,
        });
      }
      toast.success(`Turno iniciado: ${data.operator.name}`);
      onStarted();
    },
    onError: (err) => {
      submittedRef.current = false;
      setPin("");
      setError(err.message || "No se pudo iniciar el turno");
    },
  });

  useEffect(() => {
    if (pin.length !== 4 || submittedRef.current) return;
    submittedRef.current = true;
    startShift.mutate({ pin });
    // Solo depende del PIN; el ref evita dobles envíos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const press = (digit: string) => {
    if (startShift.isPending || pin.length >= 4) return;
    submittedRef.current = false;
    setError("");
    setPin((prev) => prev + digit);
  };

  const noStaffWithPin = Array.isArray(staffList) && staffList.length === 0;

  return (
    <div className="flex h-[100dvh] w-screen items-center justify-center bg-black p-5 text-white">
      <div
        className="w-full max-w-sm rounded-3xl p-6"
        style={{
          background: "linear-gradient(180deg,#140A12 0%,#09040B 100%)",
          border: "1px solid rgba(34,211,238,0.28)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <Lock className="h-7 w-7" />
          </div>
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">Rabbitty POS</p>
          <h1 className="m-0 mt-1 text-xl font-black">Inicia tu turno</h1>
          <p className="m-0 mt-1 text-xs text-gray-400">
            {terminalName ? `${terminalName} · ` : ""}
            {branchName || "Sucursal"}
          </p>
        </div>

        {noStaffWithPin ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <p className="m-0 text-sm font-bold text-amber-300">No hay empleados con PIN</p>
            <p className="m-0 mt-1 text-xs text-gray-300">
              Pide a un administrador que configure un PIN de 4 dígitos para tu usuario en Admin → Personal.
            </p>
          </div>
        ) : (
          <>
            {/* Puntos del PIN */}
            <div className="mb-4 flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-3.5 w-3.5 rounded-full transition-all"
                  style={{
                    background: pin.length > i ? "#22D3EE" : "rgba(255,255,255,0.12)",
                    boxShadow: pin.length > i ? "0 0 12px rgba(34,211,238,0.6)" : "none",
                  }}
                />
              ))}
            </div>

            {error && (
              <p className="m-0 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                {error}
              </p>
            )}

            {/* Teclado */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => press(d)}
                  disabled={startShift.isPending}
                  className="rounded-2xl border border-white/10 bg-white/5 py-4 text-xl font-black text-white active:scale-95 disabled:opacity-40"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  submittedRef.current = false;
                  setError("");
                  setPin((p) => p.slice(0, -1));
                }}
                disabled={startShift.isPending || !pin}
                aria-label="Borrar"
                className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-4 text-gray-300 active:scale-95 disabled:opacity-30"
              >
                <Delete className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => press("0")}
                disabled={startShift.isPending}
                className="rounded-2xl border border-white/10 bg-white/5 py-4 text-xl font-black text-white active:scale-95 disabled:opacity-40"
              >
                0
              </button>
              <div className="flex items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/5 py-4 text-[10px] font-bold text-cyan-300/70">
                {startShift.isPending ? "Validando…" : "4 dígitos"}
              </div>
            </div>

            <p className="m-0 mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Tu PIN no se guarda en este equipo
            </p>

            {Array.isArray(staffList) && staffList.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="m-0 mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                  <UserRound className="h-3 w-3" /> Empleados con PIN
                </p>
                <p className="m-0 text-[11px] leading-snug text-gray-400">
                  {staffList.map((s) => s.name).join(" · ")}
                </p>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => window.location.assign("/login")}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Entrar como administrador
        </button>
      </div>
    </div>
  );
}
