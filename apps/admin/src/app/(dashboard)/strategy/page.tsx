"use client";

import { useState } from "react";
import { Card, Button, Input, toast } from "@rabbitty/ui";
import { Brain, TrendingUp, Search, MessageSquare, AlertCircle } from "lucide-react";
import { trpc } from "../../../lib/trpc-client";

export default function StrategyPage() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{ role: "hermes" | "user", content: string }[]>([]);

  // We fetch hourly sales data to use as context for Hermes
  const { data: hourlySales } = trpc.analytics.getHourlySales.useQuery({ days: 7 });
  const askHermes = trpc.ai.askHermes.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "hermes", content: data.response }]);
    },
    onError: (err) => {
      toast.error(err.message);
      setMessages((prev) => [...prev, { role: "hermes", content: "Error: No me pude conectar a la red neuronal (Ollama). Por favor, verifica el servidor." }]);
    }
  });

  const handleSend = () => {
    if (!prompt.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    askHermes.mutate({ 
      prompt,
      context: { hourlySales }
    });
    setPrompt("");
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 flex items-center gap-3">
              <Brain className="h-10 w-10 text-cyan-400" />
              Centro de Comando Hermes
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">IA Estratégica para optimización de ventas y operaciones</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-gray-950 border-white/10 p-6 rounded-[2rem]">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              Horas Muertas (Últimos 7 días)
            </h3>
            {hourlySales ? (
              <div className="space-y-3">
                {hourlySales
                  .filter((h) => h.sales > 0 || h.orderCount > 0)
                  .sort((a, b) => a.sales - b.sales)
                  .slice(0, 3)
                  .map((hour) => (
                    <div key={hour.hour} className="flex items-center justify-between bg-gray-900 p-3 rounded-xl border border-white/5">
                      <div className="font-bold text-gray-300">
                        {hour.hour.toString().padStart(2, "0")}:00
                      </div>
                      <div className="text-sm text-red-400 font-medium">
                        ${hour.sales.toFixed(2)} ({hour.orderCount} órdenes)
                      </div>
                    </div>
                  ))
                }
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Cargando datos...</p>
            )}
            <div className="mt-6 rounded-xl bg-cyan-500/10 p-4 border border-cyan-500/20">
              <p className="text-xs text-cyan-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Hermes utiliza estos datos para sugerir promociones (Happy Hour) enfocadas en levantar las horas con menos ventas.
              </p>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col h-[600px]">
          <Card className="flex-1 flex flex-col bg-gray-950 border-white/10 rounded-[2rem] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
                  <Brain className="h-16 w-16 text-cyan-500" />
                  <h3 className="text-2xl font-black text-gray-500">¿Qué estrategia diseñaremos hoy?</h3>
                  <p className="text-sm font-medium text-gray-600 max-w-md">
                    "Hermes, ¿qué promoción sugieres para levantar las ventas los martes a las 4 PM?"
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 ${m.role === "user" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-300 border border-white/10"}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
              {askHermes.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-white/10 rounded-2xl p-4">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]" />
                      <div className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-900 border-t border-white/5">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  placeholder="Pregúntale a Hermes..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={askHermes.isPending || !prompt.trim()}
                  className="bg-cyan-500 text-black px-6 font-black rounded-xl hover:bg-cyan-400 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
