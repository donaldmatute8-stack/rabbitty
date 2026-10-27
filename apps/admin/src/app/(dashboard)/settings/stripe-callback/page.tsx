"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RotateCw } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

export default function StripeCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isRefresh = searchParams?.get("status") === "refresh";
  const [closedAttempted, setClosedAttempted] = useState(false);

  useEffect(() => {
    // 1. Notificar a la ventana principal de la app si fue abierta como popup
    if (window.opener) {
      window.opener.postMessage(
        { type: isRefresh ? "STRIPE_CONNECT_REFRESH" : "STRIPE_CONNECT_COMPLETED" },
        "*"
      );
    }

    if (!isRefresh) {
      // Intentar autocerrar la ventana después de 1 segundo
      const timer = setTimeout(() => {
        try {
          window.close();
          setClosedAttempted(true);
        } catch {
          setClosedAttempted(true);
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isRefresh]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-gray-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          {isRefresh ? (
            <RotateCw className="h-10 w-10 animate-spin text-amber-400" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-black text-white">
            {isRefresh ? "Sesión de Stripe Expirada" : "¡Verificación de Stripe Completada!"}
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            {isRefresh
              ? "El enlace de incorporación caducó. Puedes regresar a la app y generar uno nuevo con un solo clic."
              : "Tu cuenta bancaria ha quedado vinculada en la plataforma Rabbitty. Ya puedes recibir cobros con tarjeta y Apple Pay."}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                router.push("/settings");
              }
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-sm shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
          >
            {closedAttempted || !window.opener ? "Regresar a Configuración" : "Cerrar esta ventana"}
          </button>
        </div>
      </div>
    </div>
  );
}
