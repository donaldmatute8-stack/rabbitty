"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Megaphone, RefreshCw, Send, Sparkles } from "lucide-react";
import { Button, Card, Input, cn, toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";
import { BunzyUpdateCard } from "../../../../components/BunzyUpdateCard";

const CATEGORIES = [
  { id: "PRODUCT", label: "Actualización de producto" },
  { id: "TIP", label: "Tip para tu negocio" },
  { id: "NEWS", label: "Novedad de Rabbitty" },
  { id: "SYSTEM", label: "Aviso importante" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

interface PreviewData {
  audienceCount: number;
  sample: Array<{ id: string; name: string }>;
  preview: {
    category: string;
    title: string;
    body: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
  };
}

interface PublishResult {
  broadcastId: string;
  status: string;
  audienceCount: number;
  published: number;
  replayed: boolean;
  deliveries: Array<{
    recipientId: string;
    status: string;
    messageId: string | null;
    replayed: boolean;
  }>;
}

export default function BunzyConnectPage() {
  const [category, setCategory] = useState<Category>("PRODUCT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const businesses = trpc.bunzyConnect.businesses.useQuery();
  const list = trpc.bunzyConnect.list.useQuery(undefined, { refetchInterval: 15_000 });

  useEffect(() => {
    if (!businessId && businesses.data && businesses.data.length > 0) {
      setBusinessId(businesses.data[0].id);
    }
  }, [businesses.data, businessId]);

  const selectedBusiness = useMemo(
    () => businesses.data?.find((b) => b.id === businessId) ?? null,
    [businesses.data, businessId],
  );

  const previewMutation = trpc.bunzyConnect.preview.useMutation({
    onSuccess: (data) => setPreview(data as PreviewData),
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.bunzyConnect.publish.useMutation({
    onSuccess: (data) => {
      setResult(data as PublishResult);
      toast.success("Mensaje publicado");
      void list.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const payload = {
    category,
    title: title.trim(),
    body: body.trim(),
    ctaLabel: ctaLabel.trim() || null,
    ctaUrl: ctaUrl.trim() || null,
    audience: { scope: "BUSINESS" as const, businessId },
    requestKey: requestKey.trim() || null,
  };

  const canSubmit = title.trim().length >= 3 && body.trim().length >= 10 && Boolean(businessId);

  const handlePreview = () => {
    if (!canSubmit) return toast.error("Completa título, cuerpo y negocio");
    setResult(null);
    previewMutation.mutate(payload);
  };

  const handlePublish = () => {
    if (!canSubmit) return toast.error("Completa título, cuerpo y negocio");
    const ok = window.confirm(
      `¿Publicar “${title.trim()}” para ${selectedBusiness?.name ?? businessId}? Se escribirá en la DB real.`,
    );
    if (!ok) return;
    publishMutation.mutate(payload);
  };

  const terminalCommands = [
    `# Preview (solo lectura)`,
    `BUNZY_CONNECT_SECRET=$BUNZY_CONNECT_SECRET node scripts/bunzy-connect.mjs --local --business ${businessId || "<businessId>"} --dry-run`,
    ``,
    `# Publicar (pide confirmación)`,
    `BUNZY_CONNECT_SECRET=$BUNZY_CONNECT_SECRET node scripts/bunzy-connect.mjs --local --business ${businessId || "<businessId>"} --file ./tmp/update.json --publish`,
    ``,
    `# Producción`,
    `BUNZY_CONNECT_SECRET=$BUNZY_CONNECT_SECRET node scripts/bunzy-connect.mjs --prod --business ${businessId || "<businessId>"} --file ./tmp/update.json --publish`,
  ].join("\n");

  const copyCommands = async () => {
    try {
      await navigator.clipboard.writeText(terminalCommands);
      toast.success("Comandos copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/god" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white">
            <ArrowLeft size={14} /> Volver al God Hub
          </Link>
          <h1 className="m-0 mt-2 flex items-center gap-2 text-2xl font-black text-white">
            <Megaphone className="h-6 w-6 text-pink-400" /> Bunzy Connect
          </h1>
          <p className="m-0 mt-1 text-sm text-gray-400">
            Comunicación institucional dentro del chat, con identidad de Bunzy. C1: un negocio a la vez.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void list.refetch()} className="gap-2">
          <RefreshCw size={14} /> Refrescar
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Categoría</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0b0b12]">
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Negocio</span>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
              >
                <option value="" className="bg-[#0b0b12]">
                  Selecciona un negocio
                </option>
                {(businesses.data ?? []).map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#0b0b12]">
                    {b.name} {b.niche ? `· ${b.niche}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Título</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Ej. Tu menú digital, más claro" />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Cuerpo</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              rows={5}
              placeholder="Texto plano. Se respetan los saltos de línea."
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500"
            />
            <span className="text-[10px] text-gray-500">{body.length}/4000 · texto plano, sin HTML</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">CTA (texto)</span>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value.slice(0, 40))} placeholder="Conocer la mejora" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">CTA (URL)</span>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value.slice(0, 300))} placeholder="https://rabbitty.me" />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              requestKey (idempotencia editorial, opcional)
            </span>
            <Input
              value={requestKey}
              onChange={(e) => setRequestKey(e.target.value.slice(0, 120))}
              placeholder="Ej. c1-ka13-menu-digital"
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={handlePreview} disabled={!canSubmit || previewMutation.isPending} className="gap-2">
              <Sparkles size={14} /> {previewMutation.isPending ? "Previsualizando…" : "Previsualizar"}
            </Button>
            <Button onClick={handlePublish} disabled={!canSubmit || publishMutation.isPending} className="gap-2">
              <Send size={14} /> {publishMutation.isPending ? "Publicando…" : "Publicar"}
            </Button>
          </div>

          <p className="m-0 text-[11px] leading-relaxed text-gray-500">
            C1 publica a <strong className="text-gray-300">un negocio</strong>. El envío masivo sigue bloqueado por
            diseño. Cada reintento con el mismo <code>requestKey</code> no duplica.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="m-0 text-[10px] font-black uppercase tracking-wider text-gray-400">Preview</p>
            {preview ? (
              <div className="mt-3">
                <BunzyUpdateCard
                  message={{
                    id: "preview",
                    content: preview.preview.body,
                    createdAt: new Date(),
                    metadata: {
                      category: preview.preview.category,
                      title: preview.preview.title,
                      ctaLabel: preview.preview.ctaLabel,
                      ctaUrl: preview.preview.ctaUrl,
                    },
                  }}
                />
                <p className="m-0 mt-2 text-[11px] text-gray-500">
                  Audiencia: <strong className="text-gray-300">{preview.audienceCount}</strong>
                  {preview.sample.map((s) => (
                    <span key={s.id}> · {s.name}</span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="m-0 mt-3 text-xs text-gray-500">Previsualiza para ver la tarjeta exacta que recibirá el afiliado.</p>
            )}
          </Card>

          {result && (
            <Card className="border-emerald-500/30 bg-emerald-500/[0.06] p-5">
              <p className="m-0 text-sm font-black text-emerald-300">
                {result.replayed ? "Reintento idempotente" : "Publicado"} · {result.status}
              </p>
              <p className="m-0 mt-1 break-all text-[11px] text-gray-400">Broadcast: {result.broadcastId}</p>
              <p className="m-0 text-[11px] text-gray-400">
                {result.published}/{result.audienceCount} entregados
              </p>
              <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px] text-gray-300">
                {result.deliveries.map((d) => (
                  <li key={d.recipientId}>
                    · {d.recipientId} → {d.status} {d.replayed ? "(replay)" : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <button
              type="button"
              onClick={() => setShowTerminal((v) => !v)}
              className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left cursor-pointer"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Desde terminal</span>
              <span className="text-[11px] font-bold text-pink-300">{showTerminal ? "Ocultar" : "Ver comandos"}</span>
            </button>
            {showTerminal && (
              <div className="mt-3 space-y-2">
                <pre className="m-0 overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-3 text-[10.5px] leading-relaxed text-gray-300">
                  {terminalCommands}
                </pre>
                <Button variant="secondary" onClick={copyCommands} className="gap-2">
                  <Copy size={13} /> Copiar comandos
                </Button>
                <p className="m-0 text-[10.5px] leading-relaxed text-gray-500">
                  El secreto vive en tu entorno (<code>BUNZY_CONNECT_SECRET</code>); esta pantalla nunca lo muestra.
                  <code> --local</code> apunta a 3003 y <code>--prod</code> a admin.rabbitty.me.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <p className="m-0 text-sm font-black text-white">Historial</p>
          <span className="text-[11px] text-gray-500">Últimos 50</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Título</th>
                <th className="px-4 py-2.5">Categoría</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Entregados</th>
                <th className="px-4 py-2.5">Leídos</th>
                <th className="px-4 py-2.5">Fallidos</th>
                <th className="px-4 py-2.5">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((b) => (
                <tr key={b.id} className="border-t border-white/5 text-gray-300">
                  <td className="max-w-[280px] truncate px-4 py-2.5 font-bold text-white">{b.title}</td>
                  <td className="px-4 py-2.5">{b.category}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-black",
                        b.status === "PUBLISHED" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-gray-300",
                      )}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{b.published}/{b.total}</td>
                  <td className="px-4 py-2.5">{b.read}</td>
                  <td className="px-4 py-2.5">{b.failed}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString("es-MX") : "—"}
                  </td>
                </tr>
              ))}
              {(list.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Aún no hay broadcasts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
