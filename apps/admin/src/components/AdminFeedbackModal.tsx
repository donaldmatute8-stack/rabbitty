"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { trpc } from "../lib/trpc-client";
import { toast, Button } from "@rabbitty/ui";
import { Bug, MessageSquarePlus, X, Send, CheckCircle2 } from "lucide-react";

interface AdminFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "BUG" | "FEEDBACK";
}

export function AdminFeedbackModal({
  isOpen,
  onClose,
  initialType = "BUG",
}: AdminFeedbackModalProps) {
  const [mounted, setMounted] = useState(false);
  const [type, setType] = useState<"BUG" | "FEEDBACK">(initialType);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sendMutation = trpc.admin.sendFeedback.useMutation({
    onSuccess: () => {
      setSent(true);
      toast.success(
        type === "BUG" ? "Reporte de error enviado al equipo" : "¡Gracias por tu sugerencia!"
      );
      setTimeout(() => {
        setSent(false);
        setTitle("");
        setMessage("");
        onClose();
      }, 1500);
    },
    onError: (err) => {
      toast.error(err.message || "Error al enviar reporte");
    },
  });

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.warning("Por favor describe el detalle de tu reporte");
      return;
    }

    sendMutation.mutate({
      type,
      title: title.trim() || undefined,
      message: message.trim(),
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gray-950 p-6 shadow-2xl overflow-hidden">
        {/* Background glow */}
        <div
          className={`absolute -top-20 -right-20 h-44 w-44 rounded-full blur-3xl pointer-events-none ${
            type === "BUG" ? "bg-red-500/10" : "bg-pink-500/10"
          }`}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Type Selector Tabs */}
        <div className="flex items-center gap-2 mb-4 p-1 rounded-2xl bg-white/5 border border-white/10 w-fit">
          <button
            type="button"
            onClick={() => setType("BUG")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === "BUG"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Bug className="h-3.5 w-3.5" />
            <span>Report a bug</span>
          </button>
          <button
            type="button"
            onClick={() => setType("FEEDBACK")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === "FEEDBACK"
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>Leave Feedback</span>
          </button>
        </div>

        <h3 className="text-lg font-black text-white mb-1">
          {type === "BUG" ? "Reportar un problema técnico" : "Sugerir una mejora o función"}
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          {type === "BUG"
            ? "Indícanos qué pantalla o botón presentó el error. Nuestro equipo de soporte lo revisará de inmediato."
            : "Comparte tus ideas para hacer tu terminal o panel más rápido y cómodo para tu negocio."}
        </p>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">¡Mensaje entregado!</h4>
            <p className="text-xs text-gray-400">Gracias por tu reporte. Te mantendremos informado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Título breve
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "BUG"
                    ? "Ej. El ticket Bluetooth tardó en salir"
                    : "Ej. Atajo de teclado para cambiar de mesa"
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Descripción detallada <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === "BUG"
                    ? "Describe paso a paso qué ocurrió..."
                    : "Explícanos tu idea y cómo te ayudaría..."
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                disabled={sendMutation.isPending}
                className={`flex items-center gap-2 rounded-xl text-xs font-black shadow-lg cursor-pointer ${
                  type === "BUG"
                    ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20"
                    : "bg-pink-500 hover:bg-pink-400 text-white shadow-pink-500/20"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sendMutation.isPending ? "Enviando…" : "Enviar"}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
