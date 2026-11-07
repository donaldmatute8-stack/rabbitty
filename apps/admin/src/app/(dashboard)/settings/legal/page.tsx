"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, Button, toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

/**
 * Documentación legal del afiliado.
 *
 * Permite completar los datos que el afiliado puede aportar después de entrar
 * al admin. La aceptación del acuerdo y la autenticación local se completan en
 * la app móvil (QR). No activa capacidad por sí solo.
 */
export default function LegalSettingsPage() {
  const { data, isLoading, refetch } = trpc.admin.getLegalProfile.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const update = trpc.admin.updateLegalProfile.useMutation();

  const [form, setForm] = useState({
    legalName: "",
    rfc: "",
    representative: "",
    representativePosition: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (!data) return;
    const p = data.legalProfile ?? {};
    setForm({
      legalName: p.legalName ?? "",
      rfc: p.rfc ?? "",
      representative: p.representative ?? "",
      representativePosition: p.representativePosition ?? "",
      address: p.address ?? data.address ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
    });
  }, [data]);

  const save = () => {
    if (!form.legalName.trim() || !form.rfc.trim() || !form.representative.trim()) {
      toast.error("Completa razón social, RFC y representante legal.");
      return;
    }
    update.mutate(form, {
      onSuccess: () => {
        toast.success("Datos legales guardados.");
        void refetch();
      },
      onError: (e) => toast.error(e.message || "No se pudieron guardar los datos."),
    });
  };

  const contract = data?.contractSignature;
  const mobileUrl = "https://t.me/Rabbittyme_bot/app";

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
          <FileText className="h-5 w-5 text-violet-300" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Documentación legal</h1>
          <p className="text-xs text-gray-400">
            Datos del afiliado y aceptación del acuerdo MCCE. No activa capacidad automáticamente.
          </p>
        </div>
      </div>

      <Card className="p-5 bg-white/5 border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white">Datos del negocio</h2>
          {isLoading && <span className="text-[11px] text-gray-500">Cargando…</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-[11px] text-gray-400">
            Razón social / nombre legal *
            <input
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="Ej. Café Cultura SA de CV"
            />
          </label>
          <label className="text-[11px] text-gray-400">
            RFC *
            <input
              value={form.rfc}
              onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="XAXX010101000"
            />
          </label>
          <label className="text-[11px] text-gray-400">
            Representante legal *
            <input
              value={form.representative}
              onChange={(e) => setForm({ ...form, representative: e.target.value })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="Nombre completo"
            />
          </label>
          <label className="text-[11px] text-gray-400">
            Cargo
            <input
              value={form.representativePosition}
              onChange={(e) => setForm({ ...form, representativePosition: e.target.value })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="Titular / Administrador"
            />
          </label>
          <label className="text-[11px] text-gray-400 md:col-span-2">
            Domicilio
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>
          <label className="text-[11px] text-gray-400">
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>
          <label className="text-[11px] text-gray-400">
            Correo
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-gray-500">
            Los datos se guardan en el expediente digital del negocio. No sustituyen documentos oficiales.
          </p>
          <Button variant="primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar datos"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 bg-white/5 border-white/10 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Acuerdo MCCE
        </h2>
        {contract ? (
          <div className="space-y-1 text-xs text-gray-300">
            <p className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Aceptación registrada
            </p>
            <p>
              Versión: <span className="font-mono">{contract.contractVersion ?? "—"}</span> · Estado:{" "}
              {contract.contractStatus ?? "—"}
            </p>
            <p>Firmante: {contract.signedBy ?? "—"}</p>
            <p>Método: {contract.signatureMethod ?? "—"}</p>
            <p className="font-mono text-[10px] text-gray-500">
              Hash: {String(contract.contractHash ?? "").slice(0, 24)}…
            </p>
            {contract.contractStatus === "draft" && (
              <p className="text-[11px] text-amber-300">
                Es una aceptación de borrador; no es contrato definitivo ni activa capacidad.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Aún no hay aceptación registrada. Completa el alta en la app móvil.
          </p>
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 pt-2">
          <div className="bg-white p-2 rounded-xl">
            <QRCodeSVG value={mobileUrl} size={104} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-violet-300" /> Completar en mobile
            </p>
            <p className="text-[11px] text-gray-400">
              Escanea el código desde tu teléfono para abrir la app y completar la aceptación con
              autenticación local (Face ID / Touch ID). Si tu equipo no tiene biometría, la firma por
              nombre + checkbox sigue disponible.
            </p>
            <Link href={mobileUrl} target="_blank" className="text-[11px] text-violet-300 underline">
              Abrir enlace en este dispositivo
            </Link>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-amber-500/5 border-amber-500/25">
        <p className="text-[11px] text-amber-200/90">
          Aviso: esta pantalla no sustituye el dictamen legal, el aviso de privacidad ni la validación
          de facultades. La capacidad real sigue bloqueada hasta completar los gates.
        </p>
      </Card>
    </div>
  );
}
