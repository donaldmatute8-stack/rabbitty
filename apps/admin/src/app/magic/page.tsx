"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function MagicLoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const sid = searchParams.get("sid");

    if (!token || !sid) {
      setStatus("error");
      setErrorMsg("Enlace inválido: faltan parámetros");
      return;
    }

    signIn("magic-link", { token, sid, redirect: false }).then((result) => {
      if (result?.ok) {
        setStatus("success");
        setTimeout(() => router.replace("/"), 1500);
      } else {
        setStatus("error");
        setErrorMsg(result?.error ?? "El enlace ha expirado o es inválido");
      }
    });
  }, [searchParams, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
      <div className={`absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[120px] pointer-events-none ${
        status === "success" ? "bg-emerald-500/10" : status === "error" ? "bg-red-500/10" : "bg-pink-500/10"
      }`} />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
        {status === "loading" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="text-2xl font-black text-white">Verificando acceso...</h1>
            <p className="text-sm text-gray-400">Estamos validando tu enlace mágico</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-white">¡Acceso concedido!</h1>
            <p className="text-sm text-gray-400">Redirigiendo al panel de administración...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-white">Enlace inválido o expirado</h1>
            <p className="text-sm text-gray-400">{errorMsg}</p>
            <p className="text-xs text-gray-500">Solicita un nuevo enlace de acceso en el panel de administración.</p>
          </>
        )}
      </div>
    </div>
  );
}
