"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Store, Eye, LogOut, RefreshCw, UserPlus, ExternalLink, ShieldCheck } from "lucide-react";
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
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Cafetería", rewardPercentage: "12", creditLimit: "500" });
  const [startingAs, setStartingAs] = useState<string | null>(null);

  const loadTenants = async () => {
    try {
      const res = await fetch("/api/admin/impersonate");
      void res;
      // listTenants via tRPC batch endpoint (plain fetch to batch)
      const r = await fetch("/api/trpc/god.listTenants?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: null } })));
      const data = await r.json();
      const json = data?.[0]?.result?.data?.json;
      setTenants(Array.isArray(json) ? json : []);
    } catch {
      setTenants([]);
    }
  };

  useEffect(() => { void loadTenants(); }, []);

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
    </div>
  );
}
