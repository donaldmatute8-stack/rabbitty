"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Store, Eye, LogOut, RefreshCw, UserPlus, ExternalLink, ShieldCheck, Link2, Copy, X, Check } from "lucide-react";
import { Card, Button, Input, cn, toast } from "@rabbitty/ui";

interface Tenant {
  id: string;
  name: string;
  category: string | null;
  status: string;
  slug: string | null;
  package: string | null;
  creditLimit: number | null;
  creditUsed: number | null;
  bunzBalance: number | null;
  ownerName: string | null;
  ownerEmail: string | null;
  restaurantName: string | null;
  branchId: string | null;
  branchName: string | null;
  branchCount: number;
  canImpersonate: boolean;
}

export default function GodTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Array<{
    id: string;
    name: string;
    category: string | null;
    address: string | null;
    rewardPercentage: number | null;
    ownerName: string | null;
    status: string;
  }>>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Cafetería", rewardPercentage: "12", creditLimit: "500" });
  const [startingAs, setStartingAs] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ url: string; tenant: string; expiresAt?: string } | null>(null);

  const loadTenants = async () => {
    setLoadError(null);
    try {
      // listTenants + solicitudes pendientes via tRPC batch endpoint
      const [r, p] = await Promise.all([
        fetch("/api/trpc/god.listTenants?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: null } }))),
        fetch("/api/trpc/admin.getPendingBusinesses?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: null } }))),
      ]);
      if (!r.ok) throw new Error(`No se pudo cargar la lista de tenants (HTTP ${r.status})`);

      const data = await r.json();
      if (data?.[0]?.error) {
        throw new Error(data[0].error?.json?.message || data[0].error?.message || "No se pudo cargar la lista de tenants");
      }
      const json = data?.[0]?.result?.data?.json;
      setTenants(Array.isArray(json) ? json : []);

      const pdata = await p.json().catch(() => null);
      const pjson = pdata?.[0]?.result?.data?.json;
      const list = Array.isArray(pjson) ? pjson : [];
      // El servidor ya filtra; este guard cubre respuestas cacheadas antiguas.
      setPending(
        list.filter((b: any) => b.status === "PENDING" || b.status === "PENDING_VERIFICATION")
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo cargar el panel de tenants");
      setTenants([]);
      setPending([]);
    }
  };

  useEffect(() => { void loadTenants(); }, []);

  const approvePending = async (id: string, status: "APPROVED" | "REJECTED") => {
    setApproving(id);
    try {
      const r = await fetch("/api/trpc/admin.approveOwnedBusiness?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: { id, status } } }),
      });
      const data = await r.json();
      if (data?.[0]?.error) {
        throw new Error(data[0].error?.json?.message || data[0].error?.message || "No se pudo actualizar");
      }
      toast.success(status === "APPROVED" ? "Afiliado aprobado" : "Solicitud rechazada");
      await loadTenants();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la solicitud");
    } finally {
      setApproving(null);
    }
  };

  const createTestAffiliate = async () => {
    if (!form.name.trim()) { toast.error("Ponle nombre al negocio de prueba"); return; }
    setCreating(true);
    try {
      const mutationInput = {
        "0": {
          json: {
            name: form.name.trim(),
            category: form.category,
            rewardPercentage: Number(form.rewardPercentage) || 12,
            creditLimit: Number(form.creditLimit) || 500,
            package: "STARTER",
          },
        },
      };
      const r = await fetch("/api/trpc/god.createTestAffiliate?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutationInput),
      });
      const data = await r.json();
      const result = data?.[0]?.result?.data?.json;
      if (data?.[0]?.error) throw new Error(data[0].error.message);
      toast.success(`🏪 Afiliado prueba creado: ${result?.businessName ?? form.name} (menú + mesas listos)`);
      setForm({ name: "", category: "Cafetería", rewardPercentage: "12", creditLimit: "500" });
      await loadTenants();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear afiliado de prueba");
    } finally {
      setCreating(false);
    }
  };

  const enterAs = async (t: Tenant) => {
    if (!t.branchId) { toast.error("Este tenant no tiene sucursal activa"); return; }
    setStartingAs(t.id);
    try {
      const r = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: t.id, branchId: t.branchId }),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || "No se pudo iniciar la vista");
      toast.success(`👀 Vista Tenant activa: ${data.businessName}`);
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      setStartingAs(null);
    }
  };

  const createReonboardingLink = async (t: Tenant) => {
    setGeneratingLink(t.id);
    try {
      const r = await fetch("/api/trpc/god.createReonboardingLink?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: { affiliateId: t.id, expiresInDays: 7 } } }),
      });
      const data = await r.json();
      if (data?.[0]?.error) {
        throw new Error(data[0].error?.json?.message || data[0].error?.message || "No se pudo crear el enlace");
      }
      const result = data?.[0]?.result?.data?.json as { url?: string; expiresAt?: string } | undefined;
      if (!result?.url) throw new Error("El servidor no devolvió el enlace");
      setLinkModal({ url: result.url, tenant: t.name, expiresAt: result.expiresAt });
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Link de re-onboarding copiado");
      } catch {
        toast.success("Link de re-onboarding generado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar el enlace");
    } finally {
      setGeneratingLink(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-linear-to-br from-amber-500/20 to-pink-500/20 border border-amber-500/30">
            <Crown className="h-7 w-7 text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Tenants & Vista Prueba</h1>
            <p className="text-xs text-gray-400">
              Crea afiliados de prueba con menú y mesas listos, y entra a su vista con 1 clic (impersonación segura con 2FA)
            </p>
          </div>
          <Button variant="secondary" onClick={() => void loadTenants()} className="ml-auto rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" /> Refrescar
          </Button>
        </div>

        {loadError && (
          <div className="flex flex-col gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-xs font-semibold text-rose-200">{loadError}</p>
            <Button
              variant="secondary"
              onClick={() => void loadTenants()}
              className="rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-200 text-xs font-bold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </Button>
          </div>
        )}

        {/* Crear afiliado de prueba */}
        <Card className="p-5 border border-pink-500/20 bg-pink-500/5">
          <div className="flex items-center gap-2 pb-3">
            <UserPlus className="h-4 w-4 text-pink-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Crear Afiliado Prueba</h2>
            <span className="text-[10px] text-gray-500">genera: usuario + negocio APPROVED + sucursal + menú + 4 mesas</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input placeholder="Nombre (ej. Café Luna)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-black/50 border-white/10 text-white text-xs h-10" />
            <Input placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-black/50 border-white/10 text-white text-xs h-10" />
            <Input placeholder="% Reward" inputMode="numeric" value={form.rewardPercentage} onChange={(e) => setForm({ ...form, rewardPercentage: e.target.value.replace(/\D/g, "") })} className="bg-black/50 border-white/10 text-white text-xs h-10" />
            <Input placeholder="Crédito Bunz" inputMode="numeric" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value.replace(/\D/g, "") })} className="bg-black/50 border-white/10 text-white text-xs h-10" />
          </div>
          <Button onClick={createTestAffiliate} disabled={creating} className="mt-3 rounded-xl bg-linear-to-r from-pink-600 to-purple-600 text-white font-black text-xs px-5 py-2.5 cursor-pointer disabled:opacity-40">
            {creating ? "Creando..." : "⚡ Crear Afiliado Prueba"}
          </Button>
        </Card>

        {/* Solicitudes pendientes de aprobación */}
        <Card className="p-5 border border-amber-500/20 bg-amber-500/5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Solicitudes pendientes</h2>
              <span className="text-[10px] text-gray-500">
                {pending.length} por revisar
              </span>
            </div>
            <Button
              variant="secondary"
              onClick={() => void loadTenants()}
              className="rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refrescar
            </Button>
          </div>

          {pending.length === 0 ? (
            <p className="text-xs text-gray-500 m-0">No hay solicitudes pendientes.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-black text-white">{b.name}</p>
                    <p className="m-0 text-[11px] text-gray-500">
                      {b.category || "Sin categoría"} · {b.address || "Sin dirección"} · {b.ownerName || "Sin dueño"}
                    </p>
                    <p className="m-0 mt-1 text-[10px] font-bold text-amber-300">
                      Recompensa {b.rewardPercentage ?? "—"}% · Estado {b.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      disabled={approving === b.id}
                      onClick={() => void approvePending(b.id, "REJECTED")}
                      className="rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs font-bold"
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Rechazar
                    </Button>
                    <Button
                      disabled={approving === b.id}
                      onClick={() => void approvePending(b.id, "APPROVED")}
                      className="rounded-xl bg-emerald-500 text-black text-xs font-black"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Lista de tenants */}
        <div className="space-y-3">
          {(tenants ?? []).map((t) => (
            <Card key={t.id} className="p-4 border border-white/10 bg-white/5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Store className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="font-black text-white text-sm truncate">{t.name}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                    t.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  )}>
                    {t.status}
                  </span>
                  {t.slug?.startsWith("test-") && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">Prueba</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {t.category ?? "—"} · {t.ownerName ?? "sin owner"} · {t.restaurantName ?? "sin restaurante"} · {t.branchName ?? "sin sucursal"} ({t.branchCount})
                  {" · "}paquete {t.package ?? "—"} · crédito {t.creditUsed ?? 0}/{t.creditLimit ?? 0} Bunz
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void createReonboardingLink(t)}
                  disabled={generatingLink !== null}
                  className="rounded-xl px-4 py-2.5 text-xs font-black cursor-pointer border border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 transition-all disabled:opacity-50"
                >
                  {generatingLink === t.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Re-onboarding
                </Button>
                <Button
                  onClick={() => enterAs(t)}
                  disabled={!t.canImpersonate || startingAs !== null}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-xs font-black cursor-pointer border transition-all",
                    t.canImpersonate
                      ? "bg-linear-to-r from-sky-600 to-indigo-600 text-white border-sky-500/40 hover:scale-[1.02] disabled:opacity-50"
                      : "bg-white/5 text-gray-600 border-white/10 cursor-not-allowed"
                  )}
                >
                  {startingAs === t.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {t.canImpersonate ? "Entrar como…" : "Sin sucursal"}
                </Button>
              </div>
            </Card>
          ))}
          {tenants !== null && tenants.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-8">Sin tenants aún. Crea el primero arriba.</p>
          )}
          {tenants === null && (
            <p className="text-xs text-gray-500 text-center py-8">Cargando tenants…</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Cada entrada/salida queda en audit log (IMPERSONATION_START/END) · cookie firmada 8h · requiere tu 2FA
        </div>
      </motion.div>

      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-violet-500/30 bg-[#130725] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
                  Link de un solo uso
                </p>
                <h3 className="m-0 mt-1 text-lg font-black text-white">
                  Re-onboarding de {linkModal.tenant}
                </h3>
                <p className="m-0 mt-1 text-[11px] text-white/50">
                  Compártelo con el afiliado. Se invalida al guardar o al vencer.
                </p>
              </div>
              <button
                onClick={() => setLinkModal(null)}
                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              readOnly
              value={linkModal.url}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 font-mono text-[11px] text-white"
            />
            {linkModal.expiresAt && (
              <p className="m-0 mt-2 text-[10px] text-white/40">
                Vence: {new Date(linkModal.expiresAt).toLocaleString("es-MX")}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkModal.url);
                    toast.success("Link copiado");
                  } catch {
                    toast.error("No se pudo copiar; selecciona el texto");
                  }
                }}
                className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white"
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copiar link
              </Button>
              <Button
                onClick={() => setLinkModal(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-white/70"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
