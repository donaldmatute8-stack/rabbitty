"use client";

/**
 * ── AccountBiometricsCard ── Face ID / Touch ID para cuentas de NEGOCIO.
 *
 * La tarjeta de god (God2FAPasskeysCard) devuelve null si la cuenta no es god,
 * por eso el afiliado no veía nada de biometría en su admin. Esta usa los
 * passkeys POR USUARIO (packages/api/passkeys), disponibles para cualquier
 * cuenta autenticada.
 */

import { useState } from "react";
import { Fingerprint, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Card, Button, toast } from "@rabbitty/ui";
import { trpc } from "../lib/trpc-client";

const b64urlToBytes = (value: string): Uint8Array => {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const bytesToB64url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function AccountBiometricsCard() {
  const utils = trpc.useUtils();
  const { data: passkeys = [], isLoading } = trpc.passkeys.list.useQuery(undefined, { retry: false });
  const generateOptions = trpc.passkeys.generateRegistrationOptions.useMutation();
  const verifyRegistration = trpc.passkeys.verifyRegistration.useMutation();
  const removePasskey = trpc.passkeys.delete.useMutation({
    onSuccess: () => {
      toast.success("Llave biométrica eliminada");
      void utils.passkeys.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "No se pudo eliminar"),
  });
  const [busy, setBusy] = useState(false);

  const addPasskey = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!window.PublicKeyCredential) {
        toast.error("Este navegador no soporta llaves biométricas");
        return;
      }
      const options = await generateOptions.mutateAsync() as unknown as {
        challenge: string;
        user: { id: string; name: string; displayName: string };
        rp: { id: string; name: string };
        pubKeyCredParams: Array<{ type: "public-key"; alg: number }>;
        timeout?: number;
        attestation?: AttestationConveyancePreference;
        excludeCredentials?: Array<{ id: string; type: "public-key"; transports?: AuthenticatorTransport[] }>;
        authenticatorSelection?: AuthenticatorSelectionCriteria;
      };

      const credential = (await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: b64urlToBytes(options.challenge),
          user: { ...options.user, id: b64urlToBytes(options.user.id) },
          excludeCredentials: (options.excludeCredentials ?? []).map((c) => ({
            ...c,
            id: b64urlToBytes(c.id),
          })),
        } as PublicKeyCredentialCreationOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        toast.info("Registro cancelado");
        return;
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      await verifyRegistration.mutateAsync({
        credential: {
          id: credential.id,
          rawId: bytesToB64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bytesToB64url(response.clientDataJSON),
            attestationObject: bytesToB64url(response.attestationObject),
            transports: response.getTransports?.() ?? [],
          },
          clientExtensionResults: credential.getClientExtensionResults(),
        },
        deviceName: "Face ID / Touch ID",
      });

      toast.success("✅ Face ID activado para tu cuenta");
      void utils.passkeys.list.invalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo activar";
      if (!/cancel|abort/i.test(msg)) toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 border border-white/10 bg-white/5 backdrop-blur-md space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
          <Fingerprint className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white m-0">Face ID / Huella</h3>
          <p className="text-xs text-gray-400 m-0">Entra sin contraseña usando la biometría de este dispositivo.</p>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-gray-500">Cargando…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-xs text-gray-500">Aún no tienes llaves registradas en este dispositivo.</p>
        ) : (
          passkeys.map((pk) => (
            <div key={pk.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-black/40 border border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-gray-200 m-0 truncate">{pk.deviceName || "Passkey"}</p>
                  <p className="text-[10px] text-gray-500 m-0">
                    {pk.createdAt ? new Date(pk.createdAt).toLocaleDateString("es-MX") : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removePasskey.mutate({ id: pk.id })}
                disabled={removePasskey.isPending}
                className="shrink-0 p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-40"
                aria-label="Eliminar llave"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <Button
        onClick={() => void addPasskey()}
        disabled={busy}
        className="w-full rounded-xl py-2.5 text-xs font-black bg-linear-to-r from-emerald-500 to-teal-500 text-white cursor-pointer disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-1.5" />}
        {busy ? "Pidiendo biometría…" : "Activar Face ID / Huella"}
      </Button>

      <p className="text-[10px] text-gray-500 m-0">
        Se guarda en este dispositivo (iCloud Keychain / Google). Puedes eliminarla cuando quieras.
      </p>
    </Card>
  );
}
