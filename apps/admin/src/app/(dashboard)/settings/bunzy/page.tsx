"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Megaphone, Save } from "lucide-react";
import { Button, Card, toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

export default function BunzyPreferencesPage() {
  const prefs = trpc.customerChat.bunzyPreferences.useQuery();
  const update = trpc.customerChat.updateBunzyPreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      void prefs.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [product, setProduct] = useState(true);
  const [tips, setTips] = useState(true);
  const [news, setNews] = useState(true);

  useEffect(() => {
    if (!prefs.data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProduct(prefs.data.product);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTips(prefs.data.tips);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNews(prefs.data.news);
  }, [prefs.data]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6 md:p-8">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white">
        <ArrowLeft size={14} /> Volver a ajustes
      </Link>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-pink-500/25 bg-pink-500/10 text-pink-400">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-black text-white">Bunzy Connect</h1>
            <p className="m-0 mt-1 text-sm leading-relaxed text-gray-400">
              Elige qué actualizaciones quieres recibir en el chat de tu negocio. Los avisos de servicio
              siempre llegan.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {[
            {
              id: "product",
              title: "Actualizaciones de producto",
              desc: "Nuevas funciones y mejoras de Rabbitty.",
              value: product,
              set: setProduct,
            },
            {
              id: "tips",
              title: "Tips para tu negocio",
              desc: "Consejos prácticos (máximo 1 por semana).",
              value: tips,
              set: setTips,
            },
            {
              id: "news",
              title: "Novedades de Rabbitty",
              desc: "Campañas, eventos y oportunidades (1–2 al mes).",
              value: news,
              set: setNews,
            },
          ].map((row) => (
            <label
              key={row.id}
              className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div>
                <p className="m-0 text-sm font-black text-white">{row.title}</p>
                <p className="m-0 mt-0.5 text-xs text-gray-400">{row.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={row.value}
                onClick={() => row.set((v) => !v)}
                className={`relative mt-1 h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  row.value ? "border-pink-500/50 bg-pink-500/80" : "border-white/15 bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all ${
                    row.value ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          ))}

          <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p className="m-0 text-[11px] leading-relaxed text-gray-400">
              <strong className="text-gray-200">Avisos de servicio:</strong> mantenimiento, seguridad y
              cambios operativos siempre se envían, sin importar estas preferencias.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => update.mutate({ product, tips, news })}
            disabled={update.isPending || prefs.isLoading}
            className="gap-2"
          >
            <Save size={14} /> {update.isPending ? "Guardando…" : "Guardar preferencias"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
