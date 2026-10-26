"use client";

import { useState } from "react";
import { Card, Button, toast } from "@rabbitty/ui";
import { Receipt, Sparkles, CheckCircle2, Store, MessageSquareQuote } from "lucide-react";

export function PaymentClient({ order }: { order: any }) {
  const [notified, setNotified] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <Store className="h-5 w-5 text-pink-400" />
          <h2 className="font-bold text-white text-base">Pago en Establecimiento</h2>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed mb-4">
          Este negocio cobra directamente en su caja o con terminal bancaria física. Muestra esta pantalla o tu número de orden al mesero / cajero para liquidar tu cuenta.
        </p>

        <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-3.5 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pink-400" />
            <span className="text-xs font-bold text-white">Recompensa estimada:</span>
          </div>
          <span className="text-xs font-black text-pink-400">
            +{Math.floor(order.total * 0.20)} Bunz
          </span>
        </div>

        {notified ? (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Avisaste al personal. En breve se acercarán a tu mesa.</span>
          </div>
        ) : (
          <Button
            onClick={() => {
              setNotified(true);
              toast.success("Solicitud de cuenta enviada al equipo del restaurante");
            }}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 border border-white/10"
          >
            <MessageSquareQuote className="h-4 w-4 mr-2 text-pink-400" />
            Solicitar terminal o cuenta física a la mesa
          </Button>
        )}
      </Card>

      <div className="text-center text-[11px] text-gray-500">
        Rabbitty ID: #{order.id.slice(-6).toUpperCase()} · Creado el {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
