"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { toast } from "@rabbitty/ui";
import { LifeBuoy, Send, Loader2 } from "lucide-react";

/**
 * ── Soporte (God) ──────────────────────────────────────────────────────────
 *
 * Bandeja mínima del equipo: todos los hilos 1:1 de los negocios, un hilo por
 * afiliado. Responde como 'support' y el afiliado lo ve en su app.
 *
 * Sin SLA/asignación/estados a propósito: eso llega cuando haya volumen.
 */
export default function GodSupportPage() {
  const utils = trpc.useUtils();
  const { data: threads, isLoading } = trpc.supportInbox.list.useQuery(undefined, {
    refetchInterval: 8000,
    retry: false,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "PENDING" | "RESOLVED">("ALL");

  const visibleThreads = useMemo(() => {
    const rows = threads ?? [];
    if (statusFilter === "ALL") return rows;
    return rows.filter((t) => t.supportStatus === statusFilter);
  }, [threads, statusFilter]);

  const active = useMemo(
    () => (threads ?? []).find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );

  const { data: thread, isLoading: threadLoading, refetch } = trpc.supportInbox.getMessages.useQuery(
    { conversationId: activeId ?? "" },
    { enabled: Boolean(activeId), refetchInterval: activeId ? 5000 : false, retry: false },
  );

  const setStatus = trpc.supportInbox.setStatus.useMutation({
    onSuccess: () => {
      utils.supportInbox.list.invalidate();
      void refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const markRead = trpc.supportInbox.markRead.useMutation({
    onSuccess: () => utils.supportInbox.list.invalidate(),
  });

  useEffect(() => {
    if (!activeId || !thread?.messages?.length) return;
    const unseen = thread.messages.filter((m) => m.senderId !== "support" && !m.readAt).length;
    if (unseen > 0) markRead.mutate({ conversationId: activeId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, thread?.messages]);

  const send = trpc.supportInbox.send.useMutation({
    onSuccess: () => {
      setReply("");
      void refetch();
      utils.supportInbox.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!activeId || !reply.trim() || send.isPending) return;
    send.mutate({ conversationId: activeId, content: reply.trim() });
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-3 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
            <LifeBuoy className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="m-0 text-lg font-black text-white">Soporte</h1>
            <p className="m-0 text-[11px] text-gray-400">
              Hilos 1:1 de los afiliados · respondes como Soporte Rabbitty
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
          {threads?.length ?? 0} hilo(s)
        </span>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_1fr]">
        {/* Lista */}
        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {(["ALL", "OPEN", "PENDING", "RESOLVED"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                  statusFilter === f ? "bg-cyan-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {f === "ALL" ? "Todos" : f === "OPEN" ? "Abiertos" : f === "PENDING" ? "Pendientes" : "Resueltos"}
              </button>
            ))}
          </div>
          <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <p className="m-0 text-[9px] font-black uppercase tracking-wider text-gray-400">
              Guías para responder
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <a href="/academy" className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-gray-200 no-underline hover:bg-white/10">Panel</a>
              <a href="/operations-manual" className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-gray-200 no-underline hover:bg-white/10">Caja/POS</a>
              <a href="/settings" className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-gray-200 no-underline hover:bg-white/10">Ajustes</a>
            </div>
          </div>

          {isLoading && (
            <p className="p-4 text-center text-xs text-gray-400">Cargando hilos…</p>
          )}
          {!isLoading && (threads?.length ?? 0) === 0 && (
            <div className="p-4 text-center">
              <p className="m-0 text-xs text-gray-400">Aún no hay solicitudes de soporte.</p>
              <p className="m-0 mt-1 text-[11px] text-gray-500">
                Cuando un afiliado escriba desde su app o su admin, aparece aquí.
              </p>
            </div>
          )}
          {visibleThreads.map((t) => {
            const selected = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={`mb-1 w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-black text-white">
                    {t.businessName ?? "Afiliado"}
                  </span>
                  {t.unread > 0 && (
                    <span className="rounded-full bg-cyan-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                      {t.unread}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-0.5 truncate text-[11px] text-gray-400">
                  {t.lastMessage || "Sin mensajes"}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${
                    t.supportStatus === "RESOLVED"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : t.supportStatus === "PENDING"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-cyan-500/15 text-cyan-300"
                  }`}>
                    {t.supportStatus === "RESOLVED" ? "Resuelto" : t.supportStatus === "PENDING" ? "Esperando afiliado" : "Abierto"}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${
                    t.sla.state === "BREACHED"
                      ? "bg-red-500/15 text-red-300"
                      : t.sla.state === "RESOLVED"
                      ? "bg-white/5 text-gray-400"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}>
                    {t.sla.state === "BREACHED" ? "SLA vencido" : t.sla.state === "RESOLVED" ? "Cerrado" : "En tiempo"}
                  </span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Hilo */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
          {!activeId && (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="m-0 text-xs text-gray-400">Elige un hilo para responder.</p>
            </div>
          )}

          {activeId && (
            <>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="m-0 text-sm font-black text-white">
                    {active?.businessName ?? thread?.businessName ?? "Afiliado"}
                  </p>
                  <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    Soporte Rabbitty
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {markRead.isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeId) return;
                      setStatus.mutate({
                        conversationId: activeId,
                        status: active?.supportStatus === "RESOLVED" ? "OPEN" : "RESOLVED",
                      });
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                      active?.supportStatus === "RESOLVED"
                        ? "bg-white/5 text-gray-300 hover:bg-white/10"
                        : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    }`}
                  >
                    {active?.supportStatus === "RESOLVED" ? "Reabrir" : "Resolver"}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {threadLoading && (
                  <p className="text-center text-xs text-gray-400">Cargando mensajes…</p>
                )}
                {(thread?.messages ?? []).map((m) => {
                  const mine = m.senderId === "support";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                          mine
                            ? "bg-cyan-600 text-white"
                            : "border border-white/10 bg-white/[0.06] text-gray-100"
                        }`}
                      >
                        <p className="m-0 whitespace-pre-wrap break-words text-xs">{m.content}</p>
                        <span className={`mt-1 block text-[9px] ${mine ? "text-cyan-100/80" : "text-gray-500"}`}>
                          {m.createdAt
                            ? new Date(m.createdAt).toLocaleString("es-MX", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 pt-2">
                {[
                  { label: "Pedir captura", text: "¿Me compartes una captura y el mensaje exacto de error, por favor?" },
                  { label: "Pedir contexto", text: "Para ubicarlo: ¿en qué pantalla pasó, en qué sucursal y a qué hora?" },
                  { label: "Resuelto", text: "Listo, quedó resuelto. Si vuelve a pasar, respóndeme por aquí mismo y lo reabrimos." },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setReply(q.text)}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold text-gray-300 hover:bg-white/10"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 p-3">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="Responder como Soporte Rabbitty…"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={send.isPending || !reply.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-black text-white transition-colors hover:bg-cyan-400 disabled:opacity-50"
                >
                  {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
