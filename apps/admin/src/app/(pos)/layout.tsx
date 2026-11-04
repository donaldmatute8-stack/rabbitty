"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "../../lib/trpc-client";
import { initAppLifecycleHandlers } from "../../lib/print-engine";
import { getPosTerminalToken } from "../../lib/pos-terminal";
import { PosShiftGate } from "../../components/PosShiftGate";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // ── Fase 2: ¿este dispositivo es una terminal vinculada? ──
  // El token vive en localStorage; se lee en efecto para no romper la hidratación.
  const [terminalToken, setTerminalToken] = useState<string | null>(null);
  useEffect(() => {
    // Lectura de localStorage tras montar (evita mismatch de hidratación).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTerminalToken(getPosTerminalToken());
  }, [pathname]);

  const isLinkPage = pathname === "/pos/link";
  const hasTerminalToken = !!terminalToken && !isLinkPage;

  // El flag decide si el servidor acepta el token de terminal. Se consulta
  // siempre, es público y barato; con el flag apagado el POS se comporta igual.
  const { data: feature, isLoading: featureLoading } = trpc.posTerminals.featureEnabled.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const terminalMode = hasTerminalToken && feature?.enabled === true;

  // Doble lectura: se usa el principal que corresponda. El admin conserva
  // exactamente el query de siempre cuando no hay terminal.
  const profileQuery = trpc.admin.getProfile.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !terminalMode,
  });
  const sessionQuery = trpc.posTerminals.sessionContext.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: terminalMode,
  });

  // Doble lectura de verdad: si la terminal no es válida pero hay sesión de
  // admin en el mismo equipo, el administrador NO queda bloqueado.
  const adminFallbackQuery = trpc.admin.getProfile.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: terminalMode && !!sessionQuery.error,
  });

  // ── Fase 3: turno del empleado (solo terminal, nunca kiosk ni /pos/link) ──
  const isKiosk = pathname.startsWith("/kiosk");
  const operatorGate = terminalMode && !isLinkPage && !isKiosk;
  const { data: operatorStatus, refetch: refetchOperator } = trpc.posOperators.status.useQuery(undefined, {
    enabled: operatorGate,
    retry: false,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const isLoading = hasTerminalToken
    ? featureLoading ||
      (terminalMode && (sessionQuery.isLoading || (sessionQuery.error && adminFallbackQuery.isLoading)))
    : profileQuery.isLoading;

  const authorized = terminalMode
    ? !!sessionQuery.data || !!adminFallbackQuery.data
    : !!profileQuery.data;
  const error = terminalMode
    ? adminFallbackQuery.data
      ? null
      : sessionQuery.error
    : profileQuery.error;

  // Solo la falta REAL de sesión manda al login. Un error de negocio (p. ej.
  // "Sin sucursal asignada") NO debe expulsar al usuario a la pantalla de
  // credenciales: eso hacía que al volver al POS pidiera la clave otra vez.
  const errorCode = (error as { data?: { code?: string } } | null)?.data?.code;
  const isAuthError = errorCode === "UNAUTHORIZED" || (!authorized && !isLoading && !error);

  useEffect(() => {
    if (isLoading) return;
    // Terminal con token que el servidor ya no acepta (revocada/vencida):
    // no se borra sola; se ofrece re-vincular desde /pos/link tras login.
    if (hasTerminalToken && !terminalMode && !featureLoading) return;
    if (error && isAuthError && !hasTerminalToken) {
      router.replace("/login");
    }
  }, [isLoading, error, isAuthError, hasTerminalToken, terminalMode, featureLoading, router]);

  useEffect(() => {
    const cleanup = initAppLifecycleHandlers();
    return () => cleanup();
  }, []);

  if (isLoading) return <div className="h-[100dvh] w-screen bg-black" />;

  // ── Token presente pero modo terminal apagado o rechazado ──
  if (hasTerminalToken && !authorized) {
    const disabled = !featureLoading && feature?.enabled !== true;
    return (
      <div className="h-[100dvh] w-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 space-y-3">
          <p className="text-lg font-black m-0">
            {disabled ? "Modo terminal desactivado" : "Esta terminal necesita autorización"}
          </p>
          <p className="text-sm text-gray-300 m-0">
            {disabled
              ? "El POS está operando con sesión de administrador. Entra con tu cuenta para continuar."
              : "La autorización de esta terminal venció o fue revocada. Entra como administrador para vincularla de nuevo."}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-black cursor-pointer"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 px-4 py-2.5 text-xs font-black cursor-pointer"
            >
              Entrar como admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isAuthError) {
    return (
      <div className="h-[100dvh] w-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 space-y-3">
          <p className="text-lg font-black m-0">No se pudo abrir la terminal</p>
          <p className="text-sm text-gray-300 m-0">
            {error.message || "La sesión no tiene una sucursal asignada."}
          </p>
          <p className="text-xs text-gray-500 m-0">
            Tu sesión sigue activa. Elige una sucursal en el admin y vuelve a entrar; no necesitas capturar tus
            credenciales de nuevo.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-black cursor-pointer"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 px-4 py-2.5 text-xs font-black cursor-pointer"
            >
              Ir al admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  // La terminal está autorizada pero falta identificar al empleado.
  if (operatorGate && operatorStatus?.required === true && !operatorStatus.active) {
    return (
      <PosShiftGate
        terminalName={sessionQuery.data?.terminalName ?? null}
        branchName={sessionQuery.data?.branches?.[0]?.name ?? null}
        onStarted={() => {
          void refetchOperator();
        }}
      />
    );
  }

  return (
    <div className="relative flex h-[100dvh] w-screen overflow-hidden bg-black text-white select-none">
      {/* Dark modern background for POS and Kiosk */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none" />

      <main className="relative z-10 flex-1 flex flex-col h-[100dvh] overflow-hidden pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
        {children}
      </main>
    </div>
  );
}
