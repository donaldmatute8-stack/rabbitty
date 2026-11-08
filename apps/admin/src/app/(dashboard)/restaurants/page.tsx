"use client";

import Link from "next/link";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button } from "@rabbitty/ui";
import { ExternalLink, Settings, ShieldCheck, Coins, CreditCard, UtensilsCrossed } from "lucide-react";

/**
 * Mi restaurante & POS — resumen operativo.
 *
 * La edición vive en un solo lugar: /perfil-negocio. Aquí solo mostramos el
 * estado del restaurante y accesos directos para evitar editar dos veces.
 */
export default function RestaurantsPage() {
  const { data: restaurants, isLoading, error, refetch } = trpc.admin.getRestaurants.useQuery();

  const r = restaurants?.[0] ?? null;

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-500">
            Mi restaurante & POS
          </h1>
          <p className="mt-2 text-sm font-medium text-gray-400">
            Estado operativo de tu restaurante y accesos a la configuración centralizada.
          </p>
        </div>
      </div>

      <Link
        href="/perfil-negocio"
        className="flex items-center justify-between gap-3 rounded-2xl border border-pink-500/25 bg-pink-500/10 px-5 py-4 no-underline transition-colors hover:bg-pink-500/15"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-pink-300" />
          <div>
            <p className="m-0 text-sm font-black text-white">Toda la edición vive en Mi negocio</p>
            <p className="m-0 text-[11px] text-gray-400">
              Perfil público, sucursales, POS, Bunz, equipo y documentos en un solo lugar.
            </p>
          </div>
        </div>
        <span className="whitespace-nowrap text-xs font-bold text-pink-300">Abrir →</span>
      </Link>

      {isLoading ? (
        <Card className="border border-white/5 bg-white/5 p-8 text-center text-sm text-gray-400">
          Cargando restaurante…
        </Card>
      ) : error ? (
        <Card className="border border-rose-500/20 bg-rose-500/10 p-6 text-center">
          <p className="m-0 text-sm font-semibold text-rose-200">
            No se pudo cargar tu restaurante: {error.message}
          </p>
          <Button
            variant="secondary"
            onClick={() => void refetch()}
            className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-200 text-xs font-bold"
          >
            Reintentar
          </Button>
        </Card>
      ) : !r ? (
        <Card className="border border-white/5 bg-white/5 p-8 text-center text-sm text-gray-400">
          No encontramos un restaurante asociado a esta cuenta.
        </Card>
      ) : (
        <Card className="border border-white/5 bg-white/5 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10 text-xl font-black text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
                {r.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white">{r.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <span className="rounded border border-white/5 bg-white/5 px-2 py-0.5 font-mono">{r.slug}</span>
                  <Badge variant={r.isActive ? "success" : "danger"}>{r.isActive ? "Activo" : "Inactivo"}</Badge>
                  <span className="font-semibold uppercase text-gray-300">{r.currency}</span>
                  <span className="font-semibold text-gray-300">{(Number(r.taxRate) * 100).toFixed(0)}% IVA</span>
                  <span className="font-semibold text-gray-300">{r.defaultRewardRate}% Bunz</span>
                  <span className="font-semibold text-gray-300">{r.acceptsBunz ? "Acepta Bunz" : "No acepta Bunz"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => window.open(`https://rabbitty.me/${r.slug}`, "_blank", "noopener,noreferrer")}
                variant="secondary"
                className="rounded-xl border border-white/10 bg-white/5 text-xs"
              >
                <ExternalLink className="mr-1.5 h-4 w-4" /> Ver página pública
              </Button>
              <Link
                href="/perfil-negocio?tab=sucursal"
                className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white no-underline hover:bg-white/10"
              >
                <Settings className="mr-1.5 h-4 w-4" /> Editar en Mi negocio
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/perfil-negocio?tab=pos", title: "Operación POS", desc: "Propinas, USD, Happy Hour y comandas", Icon: UtensilsCrossed },
          { href: "/perfil-negocio?tab=bunz", title: "Bunz", desc: "Aceptación, límites y catálogo", Icon: Coins },
          { href: "/settings/legal", title: "Legal & MCCE", desc: "RFC, representante y contrato", Icon: ShieldCheck },
          { href: "/settings?tab=payments", title: "Pagos & Stripe", desc: "Cobros, CLABE y conciliación", Icon: CreditCard },
        ].map(({ href, title, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 no-underline transition-colors hover:border-white/20 hover:bg-white/10"
          >
            <Icon className="h-4 w-4 text-pink-300" />
            <p className="m-0 mt-2 text-[12px] font-black text-white">{title}</p>
            <p className="m-0 mt-1 text-[10.5px] leading-snug text-gray-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
