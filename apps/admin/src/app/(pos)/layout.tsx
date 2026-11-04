"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../lib/trpc-client";
import { initAppLifecycleHandlers } from "../../lib/print-engine";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Enforce auth on client side for POS & Kiosk
  const { data: profile, isLoading, error } = trpc.admin.getProfile.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Solo la falta REAL de sesión manda al login. Un error de negocio (p. ej.
  // "Sin sucursal asignada") NO debe expulsar al usuario a la pantalla de
  // credenciales: eso hacía que al volver al POS pidiera la clave otra vez.
  const errorCode = (error as { data?: { code?: string } } | null)?.data?.code;
  const isAuthError = errorCode === "UNAUTHORIZED" || (!profile && !isLoading && !error);

  useEffect(() => {
    if (!isLoading && error && isAuthError) {
      router.replace("/login");
    }
  }, [isLoading, error, isAuthError, router]);

  useEffect(() => {
    const cleanup = initAppLifecycleHandlers();
    return () => cleanup();
  }, []);

  if (isLoading) return <div className="h-[100dvh] w-screen bg-black" />;

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

  if (!profile) return null;

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
