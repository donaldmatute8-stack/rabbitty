"use client";

import { useState } from "react";
import { trpc } from "../lib/trpc-client";
import { toast } from "@rabbitty/ui";
import { ShieldCheck, FileText, ExternalLink } from "lucide-react";

/**
 * ── Aceptación de documentos del AFILIADO ───────────────────────────────────
 *
 * Bloquea el panel hasta que el negocio acepta la versión vigente de los
 * documentos publicados. Se registra en `business_consents` con quién y cuándo
 * (prueba de aceptación, igual que hace el Rabbitter).
 *
 * El comodato de equipos NO aparece mientras no haya hardware: se publica solo
 * cuando el servidor lo marca como vigente (`legalVersions.ts`).
 */
export function BusinessConsentGate() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.consents.getBusinessAcceptance.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const [checked, setChecked] = useState(false);

  const accept = trpc.consents.acceptBusinessTerms.useMutation({
    onSuccess: () => {
      toast.success("Documentos aceptados. Ya puedes operar.");
      utils.consents.getBusinessAcceptance.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data?.required) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-gray-950 shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-pink-500/20 to-purple-500/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pink-500/30 bg-pink-500/15">
              <ShieldCheck className="h-5 w-5 text-pink-300" />
            </div>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.18em] text-pink-300">
                Antes de operar
              </p>
              <h2 className="m-0 mt-0.5 text-lg font-black text-white">
                Acepta los documentos del servicio
              </h2>
            </div>
          </div>
        </div>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto px-6 py-5">
          <p className="m-0 text-[12.5px] leading-relaxed text-white/60">
            Son los documentos que rigen tu cuenta, las comisiones y el uso de Bunz.
            Al aceptar registramos la fecha, tu usuario y la versión aceptada
            ({data.currentVersion}).
          </p>

          {(data.docs ?? []).map((doc) => (
            <a
              key={doc.doc}
              href={`https://app.rabbitty.me/legal/${doc.doc.toLowerCase()}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 no-underline transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-2 text-[12px] font-bold text-white/80">
                <FileText className="h-3.5 w-3.5 text-pink-300" />
                {doc.label}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/30" />
            </a>
          ))}

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-pink-500"
            />
            <span className="text-[11.5px] leading-relaxed text-white/60">
              He leído y acepto los documentos anteriores en su versión{" "}
              <b className="text-white/80">{data.currentVersion}</b>. Entiendo que los Bunz son
              puntos de lealtad y no dinero.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            disabled={!checked || accept.isPending}
            onClick={() => accept.mutate({ version: data.currentVersion, accepted: true })}
            className="rounded-xl bg-pink-500 px-4 py-2.5 text-[12px] font-black text-white transition-all hover:bg-pink-400 disabled:opacity-40"
          >
            {accept.isPending ? "Registrando…" : "Aceptar y continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
