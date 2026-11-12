"use client";

/**
 * ── Facturación CFDI: conexión del PAC del tenant (ADR-021) ────────────────
 *
 * Cada negocio conecta SU cuenta de PAC y paga sus timbres. Esta pantalla solo
 * guarda (cifradas) las credenciales y prueba la conexión; Rabbitty nunca
 * timbra con un CSD propio.
 */

import { useEffect, useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Loader2, PlugZap, ShieldCheck } from "lucide-react";

const TAX_REGIMES = [
  { value: "601", label: "601 · General de Ley Personas Morales" },
  { value: "603", label: "603 · Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 · Sueldos y Salarios" },
  { value: "606", label: "606 · Arrendamiento" },
  { value: "612", label: "612 · Personas Físicas con Actividades Empresariales" },
  { value: "614", label: "614 · Ingresos por intereses" },
  { value: "616", label: "616 · Sin obligaciones fiscales" },
  { value: "620", label: "620 · Sociedades Cooperativas de Producción" },
  { value: "621", label: "621 · Incorporación Fiscal" },
  { value: "626", label: "626 · Régimen Simplificado de Confianza (RESICO)" },
];

const EMPTY = {
  provider: "facturama",
  environment: "sandbox" as "sandbox" | "production",
  rfc: "",
  name: "",
  taxRegime: "601",
  zipCode: "",
  username: "",
  password: "",
};

export default function BillingSettingsPage() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const providers = trpc.cfdi.providers.useQuery();
  const connection = trpc.cfdi.getConnection.useQuery({ environment: form.environment });

  const configured = connection.data?.connections ?? [];
  const active = connection.data?.active ?? null;

  // Datos del emisor ya guardados (nunca las credenciales).
  useEffect(() => {
    if (!active) return;
    setForm((f) => ({
      ...f,
      provider: active.provider,
      environment: active.environment,
      rfc: active.issuerRfc,
      name: active.issuerName,
      taxRegime: active.issuerTaxRegime,
      zipCode: active.issuerZipCode,
      username: "",
      password: "",
    }));
  }, [active]);

  const credentials = () => {
    if (!form.username.trim() || !form.password) return undefined;
    return { username: form.username.trim(), password: form.password };
  };

  const testConnection = trpc.cfdi.testConnection.useMutation({
    onSuccess: (data) => {
      setResult(data);
      data.ok ? toast.success(data.message) : toast.error(data.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveConnection = trpc.cfdi.saveConnection.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.cfdi.getConnection.invalidate();
      data.ok ? toast.success("PAC conectado") : toast.error("Guardado, pero la prueba falló");
      setForm((f) => ({ ...f, username: "", password: "" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit =
    form.rfc.trim().length >= 12 &&
    form.name.trim().length > 0 &&
    form.zipCode.trim().length === 5 &&
    form.username.trim().length > 0 &&
    form.password.length > 0;

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">Impuestos</p>
          <h1 className="m-0 mt-1 text-2xl font-black">Facturación CFDI</h1>
          <p className="m-0 mt-1 max-w-xl text-sm text-gray-500">
            Conecta tu cuenta de PAC (Facturama, Finkok…) para timbrar. Tú pagas tus
            timbres directamente con tu proveedor; Rabbitty no cobra por timbre.
          </p>
        </div>
        <Badge variant={active?.isActive ? "success" : "warning"}>
          {active?.isActive ? `Conectado · ${active.environment}` : "Sin PAC conectado"}
        </Badge>
      </div>

      {!active && (
        <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="m-0 flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            La facturación está apagada
          </p>
          <p className="m-0 mt-1 text-xs text-amber-700 dark:text-amber-200/80">
            Mientras no conectes un PAC, las solicitudes de factura se rechazan con un mensaje
            claro. No se genera ningún comprobante simulado.
          </p>
        </Card>
      )}

      {active && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-wider text-gray-500">Conexión activa</p>
              <p className="m-0 mt-1 font-mono text-sm">
                {active.issuerRfc} · {active.issuerName}
              </p>
              <p className="m-0 mt-0.5 text-xs text-gray-500">
                {active.provider} · {active.environment} · régimen {active.issuerTaxRegime} · CP {active.issuerZipCode}
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-xs text-gray-500">
                {active.lastTestedAt ? new Date(active.lastTestedAt).toLocaleString("es-MX") : "Sin probar"}
              </p>
              <Badge variant={active.lastTestStatus === "OK" ? "success" : "danger"}>
                {active.lastTestStatus === "OK" ? "Última prueba OK" : "Última prueba falló"}
              </Badge>
              {active.lastTestMessage && (
                <p className="m-0 mt-1 max-w-xs text-[11px] text-gray-500">{active.lastTestMessage}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-pink-500" />
          <h2 className="m-0 text-sm font-black uppercase tracking-wider">
            {active ? "Actualizar conexión" : "Conectar un PAC"}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-500">Proveedor</span>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              {(providers.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-500">Ambiente</span>
            <select
              value={form.environment}
              onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value as "sandbox" | "production" }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="sandbox">Pruebas (sandbox)</option>
              <option value="production">Producción</option>
            </select>
          </label>

          <Input label="RFC del emisor" value={form.rfc} onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))} placeholder="EKU9003173C9" maxLength={13} />
          <Input label="Razón social" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ESCUELA KEMPER URGATE" />

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-500">Régimen fiscal</span>
            <select
              value={form.taxRegime}
              onChange={(e) => setForm((f) => ({ ...f, taxRegime: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              {TAX_REGIMES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <Input label="Código postal (lugar de expedición)" value={form.zipCode} onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value.replace(/\D/g, "") }))} placeholder="42501" maxLength={5} />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="m-0 flex items-center gap-2 text-xs font-bold text-gray-400">
            <KeyRound className="h-3.5 w-3.5" />
            Credenciales de tu cuenta {form.provider === "facturama" ? "de Facturama" : "del PAC"}
          </p>
          <p className="m-0 mt-1 text-[11px] text-gray-500">
            Usuario y contraseña del API (no los de la web). Se guardan cifrados y no se vuelven a mostrar.
            {active && " Déjalos vacíos para conservar los actuales y solo probar."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Usuario API" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder={active ? "•••••• (guardado)" : "usuario"} autoComplete="off" />
            <Input label="Contraseña API" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={active ? "•••••• (guardada)" : "contraseña"} autoComplete="new-password" />
          </div>
        </div>

        {result && (
          <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
            <span>{result.message}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => testConnection.mutate({ provider: form.provider as "facturama", environment: form.environment, credentials: credentials() })}
            disabled={testConnection.isPending}
          >
            {testConnection.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlugZap className="mr-1.5 h-4 w-4" />}
            Probar conexión
          </Button>
          <Button
            onClick={() => saveConnection.mutate({ provider: form.provider as "facturama", environment: form.environment, issuer: { rfc: form.rfc.trim(), name: form.name.trim(), taxRegime: form.taxRegime, zipCode: form.zipCode.trim() }, credentials: credentials()! })}
            disabled={!canSubmit || saveConnection.isPending}
          >
            {saveConnection.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
            Guardar y probar
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="m-0 text-sm font-black uppercase tracking-wider">Qué necesitas</h2>
        <ol className="m-0 mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-500">
          <li>Una cuenta en tu PAC con el módulo de API activo (Facturama: $1,650 MXN/año + folios).</li>
          <li>Tu CSD vigente cargado en el PAC (certificado, llave y contraseña).</li>
          <li>Usuario y contraseña de API de esa cuenta.</li>
        </ol>
        <p className="m-0 mt-3 flex items-center gap-1 text-xs text-gray-500">
          <ExternalLink className="h-3.5 w-3.5" />
          <a href="https://facturama.mx/docs" target="_blank" rel="noreferrer" className="underline">
            Documentación de Facturama
          </a>
        </p>
      </Card>

      {configured.length > 1 && (
        <Card className="p-4">
          <h2 className="m-0 text-sm font-black uppercase tracking-wider">Conexiones registradas</h2>
          <ul className="m-0 mt-2 space-y-1 text-sm">
            {configured.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-1.5 last:border-0">
                <span className="font-mono text-xs">{c.provider} · {c.environment}</span>
                <span className="text-xs text-gray-500">{c.issuerRfc}</span>
                <Badge variant={c.lastTestStatus === "OK" ? "success" : "danger"}>
                  {c.lastTestStatus === "OK" ? "OK" : "Falló"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
