"use client";

import Link from "next/link";
import { trpc } from "../../../lib/trpc-client";
import {
  Megaphone,
  Sparkles,
  UserRound,
  Gift,
  Cake,
  QrCode,
  Printer,
  Compass,
  Ticket,
  Film,
  ArrowUpRight,
  Zap,
  TrendingUp,
} from "lucide-react";

const STUDIO_MODULES = [
  {
    title: "Campañas & Promociones",
    description: "Crea campañas segmentadas, promociones Bunz'in y mensajes directos para atraer visitas.",
    href: "/marketing/campaigns",
    icon: Megaphone,
    badge: "Core",
    accent: "from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-400",
  },
  {
    title: "Rabbitty Mood & Telemetría",
    description: "Pulso ambiental en vivo, activaciones por horario y conexión con el mapa de experiencia.",
    href: "/marketing/mood",
    icon: Sparkles,
    badge: "IA Live",
    accent: "from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400",
  },
  {
    title: "Atmósfera & Conexión (PoA)",
    description: "Retorno ambiental (Proof of Atmosphere), pasaporte urbano colaborativo y curaduría acústica.",
    href: "/marketing/atmosphere",
    icon: Compass,
    badge: "V2.0",
    accent: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
  },
  {
    title: "Audiencias & Rabbitters",
    description: "Explora y segmenta tu comunidad: VIPs, recurrentes, nuevos visitantes y clientes en riesgo.",
    href: "/marketing/audiences",
    icon: UserRound,
    badge: "CRM",
    accent: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400",
  },
  {
    title: "Automatización de Cumpleaños",
    description: "Recompensas y felicitaciones automáticas para celebrar a tus Rabbitters y llenar mesas.",
    href: "/marketing/automations/birthdays",
    icon: Cake,
    badge: "Auto",
    accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
  },
  {
    title: "Red de Referidos & Hops",
    description: "Convierte a tus mejores clientes en embajadores y mide las visitas traídas por invitación.",
    href: "/marketing/referrals",
    icon: Gift,
    badge: "Viral",
    accent: "from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/30 text-fuchsia-400",
  },
  {
    title: "Códigos QR & Presencia Digital",
    description: "Genera QRs de mesa, bienvenida y adquisición conectados con la experiencia de tu sucursal.",
    href: "/marketing/qr",
    icon: QrCode,
    badge: "Phygital",
    accent: "from-sky-500/20 to-indigo-500/10 border-sky-500/30 text-sky-400",
  },
  {
    title: "Print Center · Kit de Impresos",
    description: "Descarga acrílicos, stickers y tent cards listos para imprenta con tu marca y bono activo.",
    href: "https://www.rabbitty.me/impresos",
    external: true,
    icon: Printer,
    badge: "PDF",
    accent: "from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-400",
  },
];

export default function MarketingStudioOverviewPage() {
  const { data: campaigns } = trpc.campaigns.list.useQuery(undefined, { retry: false });
  const { data: affiliateCampaigns } = trpc.campaigns.affiliateList.useQuery(undefined, { retry: false });
  const { data: audience } = trpc.crm.getMyAudienceCounts.useQuery(undefined, { retry: false });
  const { data: businesses } = trpc.memberships.myBusinesses.useQuery(undefined, { retry: false });
  const primaryBusinessId = businesses?.[0]?.id ?? "";
  const { data: membershipPlans } = trpc.memberships.listPlansAdmin.useQuery(
    { businessId: primaryBusinessId },
    { enabled: Boolean(primaryBusinessId), retry: false }
  );

  const totalCampaigns = (campaigns?.length ?? 0) + (affiliateCampaigns?.length ?? 0);
  const totalCustomers = audience?.total ?? 0;
  const vipCustomers = audience?.vip ?? 0;
  const publishedPlans = membershipPlans?.filter((p) => Boolean(p.plan.currentVersionId)).length ?? 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-pink-950/40 via-purple-950/25 to-black/90 p-8 shadow-2xl">
        <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" /> Rabbitty Marketing Studio
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Crecimiento, Comunidad & Comunicación
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Planea, publica y mide tus estrategias para atraer nuevos Rabbitters, activar visitas recurrentes y promocionar tus membresías sin mezclarlo con la operación de caja.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/marketing/campaigns"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black uppercase tracking-wider transition-all no-underline shadow-lg shadow-pink-500/20"
            >
              <Megaphone className="h-4 w-4" /> Crear Campaña
            </Link>
            <Link
              href="/marketing/mood"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-all no-underline"
            >
              <Sparkles className="h-4 w-4 text-purple-400" /> Abrir Mood Studio
            </Link>
          </div>
        </div>

        {/* Live Metrics Strip */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Campañas Totales</span>
            <p className="text-2xl font-black text-white mt-0.5">{totalCampaigns}</p>
          </div>
          <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Audiencia Rabbitters</span>
            <p className="text-2xl font-black text-cyan-400 mt-0.5">{totalCustomers}</p>
          </div>
          <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Segmento VIP</span>
            <p className="text-2xl font-black text-amber-400 mt-0.5">{vipCustomers}</p>
          </div>
          <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Membresías Publicadas</span>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{publishedPlans}</p>
          </div>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-pink-400" /> Herramientas de Marketing Studio
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STUDIO_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.title}
                href={mod.href}
                target={mod.external ? "_blank" : undefined}
                rel={mod.external ? "noopener noreferrer" : undefined}
                className="group relative rounded-2xl border border-white/10 bg-white/3 hover:bg-white/6 p-5 transition-all flex flex-col justify-between no-underline"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl bg-linear-to-br border flex items-center justify-center ${mod.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1">
                      {mod.badge}
                      <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-pink-300 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Próximo módulo reservado: Rabbitty Moments */}
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/2 p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                  <Film className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300">
                  Próximamente
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white/90">
                  Rabbitty Moments & Reels
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Publicación de historias, reels cortos y momentos en vivo verificados dentro del feed de la comunidad.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Puente con Operaciones: Promoción de Membresías y Lealtad */}
      <div className="rounded-2xl border border-white/10 bg-linear-to-r from-zinc-900/90 to-black/90 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
            <Ticket className="h-5 w-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              ¿Quieres impulsar tus Membresías o tu Cashback Bunz?
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Los planes, precios y derechos se configuran en <strong className="text-gray-200">Operación → Membresías</strong>, y desde aquí puedes lanzar una campaña para venderlos a tus clientes recurrentes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/memberships"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 no-underline transition-all"
          >
            Configurar Planes
          </Link>
          <Link
            href="/marketing/campaigns"
            className="px-3.5 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-xs font-bold text-pink-300 no-underline transition-all"
          >
            Promocionar Ahora →
          </Link>
        </div>
      </div>
    </div>
  );
}
