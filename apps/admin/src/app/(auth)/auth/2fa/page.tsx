"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "../../../../lib/trpc-client";
import { Button, Input, toast } from "@rabbitty/ui";
import { Key, Fingerprint, Smartphone, Shield, CheckCircle, LogIn } from "lucide-react";

export default function TwoFactorAuthPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const [totpCode, setTotpCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);
  const [completed, setCompleted] = useState(false);

  const checkRequirement = trpc.totp.checkRequirement.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });

  const verifyTotp = trpc.totp.verify.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  const createTrusted = trpc.trustedSessions.create.useMutation();
  const generateAuthOptions = trpc.passkeys.generateAuthenticationOptions.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const verifyPasskey = trpc.passkeys.verifyAuthentication.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [session, router]);

  const handleTotpVerify = async () => {
    try {
      await verifyTotp.mutateAsync({ code: totpCode });

      if (trustDevice) {
        await createTrusted.mutateAsync({
          deviceName: `Navegador: ${navigator.userAgent.slice(0, 50)}...`,
          userAgent: navigator.userAgent,
          expiresInDays: 30,
        });
      }

      setCompleted(true);
      toast.success("Verificación exitosa");
      setTimeout(() => router.replace("/"), 800);
    } catch (e: any) {
      toast.error(e.message ?? "Código inválido");
    }
  };

  const handlePasskeyAuth = async () => {
    setVerifyingPasskey(true);
    try {
      const options = await generateAuthOptions.refetch();
      if (!options.data) { toast.error("No se pudieron generar las opciones de autenticación"); return; }

      const credential = await navigator.credentials.get({ publicKey: options.data as any });
      if (!credential) { toast.error("Autenticación cancelada"); return; }

      const response = (credential as any).response;
      const credentialData = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId))),
        response: {
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
          authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
          signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
          userHandle: response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(response.userHandle))) : undefined,
        },
        type: credential.type,
        clientExtensionResults: (credential as any).clientExtensionResults ?? {},
        authenticatorAttachment: (credential as any).authenticatorAttachment ?? null,
      };

      await verifyPasskey.mutateAsync({ credential: credentialData });

      if (trustDevice) {
        await createTrusted.mutateAsync({
          deviceName: `Passkey: ${navigator.userAgent.slice(0, 50)}...`,
          userAgent: navigator.userAgent,
          expiresInDays: 30,
        });
      }

      setCompleted(true);
      toast.success("Passkey verificada");
      setTimeout(() => router.replace("/"), 800);
    } catch (e: any) {
      toast.error(e.message ?? "Error de autenticación");
    } finally {
      setVerifyingPasskey(false);
    }
  };

  if (!session || checkRequirement.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
        <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white">Verificación exitosa</h1>
          <p className="text-sm text-gray-400">Redirigiendo al panel...</p>
        </div>
      </div>
    );
  }

  const hasTotp = checkRequirement.data?.totpEnabled;
  const hasPasskeys = false;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden p-4">
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Shield className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Verificación en dos pasos
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm font-medium">
              Ingresa el código de tu app de autenticación o usa tu passkey
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {hasTotp && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 border border-white/5">
                <Key className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="text-sm text-gray-300">Código de autenticación</span>
              </div>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              <Button
                className="w-full"
                onClick={handleTotpVerify}
                disabled={verifyTotp.isPending || totpCode.length !== 6}
              >
                <LogIn className="h-4 w-4" />
                {verifyTotp.isPending ? "Verificando..." : "Verificar"}
              </Button>
            </div>
          )}

          {hasTotp && hasPasskeys && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-2 text-gray-500">o</span>
              </div>
            </div>
          )}

          {hasPasskeys && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handlePasskeyAuth}
              disabled={verifyingPasskey}
            >
              <Fingerprint className="h-4 w-4" />
              {verifyingPasskey ? "Esperando..." : "Usar Passkey"}
            </Button>
          )}

          <label className="flex items-center gap-2.5 text-sm text-gray-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all duration-300 cursor-pointer"
            />
            <Smartphone className="h-4 w-4 text-gray-500" />
            Confiar en este dispositivo por 30 días
          </label>
        </div>
      </div>
    </div>
  );
}
