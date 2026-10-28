"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, ArrowRight, Fingerprint, Loader2 } from "lucide-react";
import { Button, Input, cn } from "@rabbitty/ui";

export default function Verify2FAPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ required: boolean; verified: boolean; totpConfigured: boolean } | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const b64 = (bytes: Uint8Array) => {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  };

  useEffect(() => {
    fetch("/api/auth/2fa/verify")
      .then((r) => r.json())
      .then((d) => {
        setStatus(d);
        if (d.verified) window.location.href = "/";
      })
      .catch(() => setStatus({ required: true, verified: false, totpConfigured: true }));
  }, []);

  useEffect(() => {
    if (code.length === 6 && !loading) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/";
        return;
      }
      setError(data.error || "Código incorrecto");
      setCode("");
      inputRef.current?.focus();
    } catch {
      setError("Error de red");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const unlockWithPasskey = async () => {
    setPasskeyLoading(true);
    setError("");
    try {
      // 1. Pedir opciones al servidor (ret challenge + credenciales registradas)
      const optRes = await fetch("/api/auth/2fa/passkey", { method: "POST", body: JSON.stringify({ action: "unlock_options" }) });
      const options = await optRes.json();
      if (!options?.success) throw new Error(options?.error || "No hay passkeys registradas en este servidor");

      // 2. Ceremony WebAuthn (Face ID / Touch ID del dispositivo)
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
          allowCredentials: (options.allowCredentialIds || []).map((id: string) => ({
            type: "public-key" as const,
            id: Uint8Array.from(atob(id.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
          })),
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (!cred) throw new Error("Sin credencial");

      // 3. Verificar server-side
      const pkCred = cred as PublicKeyCredential;
      const resp = pkCred.response as unknown as AuthenticatorAssertionResponse;
      const verifyRes = await fetch("/api/auth/2fa/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock_verify",
          credentialId: b64(new Uint8Array(pkCred.rawId)),
          authenticatorData: b64(new Uint8Array(resp.authenticatorData)),
          clientDataJSON: b64(new Uint8Array(resp.clientDataJSON)),
          signature: b64(new Uint8Array(resp.signature)),
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        window.location.href = "/";
        return;
      }
      throw new Error(verifyData.error || "Verificación fallida");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Biometría no disponible";
      setError(msg.includes("NotAllowed") || msg.includes("not allowed") ? "Biometría cancelada o no permitida" : msg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0e0e14] p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-4 rounded-2xl bg-linear-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30">
            <ShieldCheck className="h-8 w-8 text-pink-400" />
          </div>
          <h1 className="text-xl font-black text-white">Verificación God Admin</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            Tu cuenta requiere doble factor. Ingresa el código de 6 dígitos de tu app de autenticación.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Input
            ref={inputRef as never}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="text-center text-2xl font-black tracking-[0.5em] h-14 bg-black/60 border-white/15 text-white"
          />

          {error && <p className="text-[11px] font-bold text-rose-400 text-center">{error}</p>}

          <Button
            onClick={submit}
            disabled={code.length !== 6 || loading}
            className="w-full h-12 rounded-xl bg-linear-to-r from-pink-600 to-purple-600 font-black text-white shadow-lg cursor-pointer disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
            {loading ? "Verificando..." : "Verificar y Entrar"}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-bold text-gray-500 uppercase">o</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            variant="secondary"
            onClick={unlockWithPasskey}
            disabled={passkeyLoading}
            className={cn(
              "w-full h-11 rounded-xl bg-white/5 border border-white/10 font-bold text-gray-200 hover:bg-white/10 cursor-pointer disabled:opacity-40"
            )}
          >
            {passkeyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-1 text-cyan-400" />}
            {passkeyLoading ? "Esperando biometría..." : "Usar Face ID / Touch ID (passkey)"}
          </Button>

          {status && !status.totpConfigured && (
            <p className="text-[11px] text-amber-400 text-center font-bold">
              ⚠️ El servidor no tiene GOD_ADMIN_TOTP_SECRET configurado.
            </p>
          )}
        </div>

        <p className="mt-6 text-[10px] text-gray-600 text-center leading-relaxed">
          Código de un solo uso con ventana de 30s · 8 intentos cada 5 min · Sesión 2FA válida por 12h
        </p>
      </motion.div>
    </div>
  );
}
