"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Crown, Store, Scale, Activity, Rocket, Gamepad2, Award, 
  LayoutDashboard, Settings, ArrowRight, ShieldCheck, RefreshCw, 
  CheckCircle2, AlertTriangle, Users, Coins, Sparkles
} from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";

interface HubSummary {
  totalBusinesses: number;
  activeBusinesses: number;
  totalRabbitters: number;
  circulatingBunz: number;
  monthlyTxns: number;
  ledgerBalanced: boolean;
}

export default function GodHubPage() {
  const [summary, setSummary] = useState<HubSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const [ecoRes, reconRes] = await Promise.all([
        fetch("/api/trpc/god.getEcosystemMetrics?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: null } }))).then(r => r.json()),
        fetch("/api/trpc/god.getLedgerReconciliation?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: null } }))).then(r => r.json()).catch(() => null),
      ]);

      const eco = ecoRes?.[0]?.result?.data?.json;
      const recon = reconRes?.[0]?.result?.data?.json;

      if (eco) {
        setSummary({
          totalBusinesses: eco.businesses?.total ?? 0,
          activeBusinesses: eco.businesses?.active ?? 0,
          totalRabbitters: eco.rabbitters?.total ?? 0,
          circulatingBunz: eco.rabbitters?.circulatingSupply ?? 0,
          monthlyTxns: eco.monthlyTxns ?? 0,
          ledgerBalanced: recon?.status === "HEALTHY",
        });
      }
    } catch {
      // Fallback gracioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics();
  }, []);

  const modules = [
    {
      title: "Tenants & Vista Prueba",
      description: "Crea afiliados de prueba con menú, sucursal y mesas listos, e impersona su panel con 1 clic sin credenciales.",
      href: "/god/tenants",
      icon: Store,
      badge: "Operación & QA",
      color: "from-sky-500/20 to-blue-600/20",
      border: "border-sky-500/30",
      iconColor: "text-sky-400",
    },
    {
      title: "Economía & Ledger",
      description: "Auditoría en tiempo real. Compara balances en caché contra asientos inmutables del Ledger y detecta discrepancias.",
      href: "/god/economia",
      icon: Scale,
      badge: "Auditoría Financiera",
      color: "from-emerald-500/20 to-teal-600/20",
      border: "border-emerald-500/30",
      iconColor: "text-emerald-400",
    },
    {
      title: "Métricas Investor & Ecosistema",
      description: "Volumen transaccional de la red, oferta monetaria de Bunz, límites de crédito de tenants y actividad de usuarios.",
      href: "/god/ecosistema",
      icon: Activity,
      badge: "Growth & Red",
      color: "from-pink-500/20 to-rose-600/20",
      border: "border-pink-500/30",
      iconColor: "text-pink-400",
    },
    {
      title: "Estado de Escalado",
      description: "Monitoreo de cuellos de botella de infraestructura, conexiones activas de Postgres, límites y salud técnica.",
      href: "/god/escalado",
      icon: Rocket,
      badge: "Infraestructura",
      color: "from-amber-500/20 to-orange-600/20",
      border: "border-amber-500/30",
      iconColor: "text-amber-400",
    },
    {
      title: "Gamificación Global",
      description: "Gobierno de Trucos del ecosistema (misiones), niveles de Rabbitters y multiplicadores de Bunz en toda la red.",
      href: "/god/gamificacion",
      icon: Gamepad2,
      badge: "Engagement",
      color: "from-purple-500/20 to-violet-600/20",
      border: "border-purple-500/30",
      iconColor: "text-purple-400",
    },
    {
      title: "Split & Deuda Bunz",
      description: "Control de cashback global, emisión de recompensas y balance de pasivos por Bunz no redimidos.",
      href: "/loyalty",
      icon: Award,
      badge: "Tesorería",
      color: "from-fuchsia-500/20 to-pink-600/20",
      border: "border-fuchsia-500/30",
      iconColor: "text-fuchsia-400",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header God Mode */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10"
      >
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-linear-to-tr from-amber-500/20 via-pink-500/20 to-purple-500/20 border border-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Centro de Mando God</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Modo Dios Activo
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Supervisión de plataforma, balance económico del Ledger, gobierno de tenants e infraestructura en vivo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs font-bold transition-all"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-pink-400" />
            <span>Resumen Operativo</span>
          </Link>
          <Button
            onClick={() => void fetchMetrics()}
            disabled={loading}
            variant="secondary"
            className="rounded-xl px-3 py-2 text-xs font-bold bg-white/5 border-white/10 text-gray-300 hover:text-white"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </motion.div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white/5 border-white/10 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Afiliados Totales</p>
            <p className="text-xl font-black text-white">
              {summary ? `${summary.activeBusinesses} / ${summary.totalBusinesses}` : "—"}
            </p>
            <p className="text-[10px] text-sky-400 font-medium">Activos en la red</p>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Rabbitters</p>
            <p className="text-xl font-black text-white">
              {summary ? summary.totalRabbitters.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-pink-400 font-medium">Usuarios registrados</p>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Circulante Bunz</p>
            <p className="text-xl font-black text-white">
              {summary ? `${summary.circulatingBunz.toLocaleString()} ⬡` : "—"}
            </p>
            <p className="text-[10px] text-purple-400 font-medium">En wallets de usuarios</p>
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Ledger Contable</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {summary?.ledgerBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-black text-emerald-400">Cuadrado 100%</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-black text-amber-400">Verificando...</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-500">Sin discrepancias</p>
          </div>
        </Card>
      </div>

      {/* Grid de Módulos God */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <span>Pilares de Gestión de Plataforma</span>
          </h2>
          <span className="text-xs text-gray-500">6 áreas de control exclusivo</span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group block relative"
              >
                <Card className={cn(
                  "h-full p-5 bg-white/5 border border-white/10 hover:border-pink-500/40 transition-all duration-300 flex flex-col justify-between group-hover:-translate-y-1 group-hover:shadow-[0_10px_30px_rgba(236,72,153,0.15)] relative overflow-hidden"
                )}>
                  {/* Subtle Background Accent */}
                  <div className={cn("absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none bg-linear-to-br", m.color)} />

                  <div className="space-y-3 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className={cn("p-2.5 rounded-xl border bg-black/40", m.border, m.iconColor)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-white/5 text-gray-400 border border-white/10 group-hover:border-white/20 transition-colors">
                        {m.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white group-hover:text-pink-300 transition-colors flex items-center gap-1.5">
                        {m.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-3">
                        {m.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-gray-400 group-hover:text-pink-400 transition-colors relative z-10">
                    <span>Acceder al panel</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>
            Sesión protegida por <strong className="text-white">God Mode Guard</strong> (Allowlist estricta + 2FA TOTP/Passkey + Audit Log inmutable).
          </span>
        </div>
        <Link
          href="/settings"
          className="text-xs text-pink-400 hover:text-pink-300 font-bold shrink-0 flex items-center gap-1"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Seguridad</span>
        </Link>
      </div>
    </div>
  );
}
