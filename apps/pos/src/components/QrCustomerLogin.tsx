"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc-client";
import { Button, toast } from "@rabbitty/ui";
import { QrCode, Smartphone, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface QrCustomerLoginProps {
  orderId: string;
  onCustomerIdentified: (userId: string) => void;
}

export function QrCustomerLogin({ orderId, onCustomerIdentified }: QrCustomerLoginProps) {
  const [step, setStep] = useState<"idle" | "generating" | "display" | "scanning" | "success" | "error">("idle");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const generateQr = useCallback(async () => {
    setStep("generating");
    try {
      const res = await fetch("/api/qr-login/generate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setQrToken(data.qrToken);
        setSessionId(data.sessionId);
        setStep("display");
      } else {
        setStep("error");
        toast.error("Error al generar QR");
      }
    } catch {
      setStep("error");
      toast.error("Error de conexión");
    }
  }, []);

  useEffect(() => {
    if (step !== "display" || !sessionId) return;
    setStep("scanning");

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/qr-login/poll?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.authenticated && data.user) {
          clearInterval(interval);
          setStep("success");
          onCustomerIdentified(data.user.id);
        }
        if (data.expired) {
          clearInterval(interval);
          setStep("error");
          setPollError("El código QR expiró. Genera uno nuevo.");
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, step, onCustomerIdentified]);

  const qrUrl = qrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrToken)}`
    : null;

  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-sm font-semibold text-green-700">Cliente identificado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {step === "idle" && (
        <Button onClick={generateQr} variant="secondary" className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Identificar cliente con QR
        </Button>
      )}

      {step === "generating" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generando QR...
        </div>
      )}

      {(step === "display" || step === "scanning") && qrUrl && (
        <>
          <div className="rounded-xl bg-white p-4 shadow-lg">
            <img src={qrUrl} alt="QR Login" className="mx-auto h-48 w-48" />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {step === "scanning" && <Loader2 className="h-4 w-4 animate-spin" />}
            Esperando escaneo del cliente...
          </div>
          <Button onClick={generateQr} variant="ghost" size="sm">
            Generar nuevo QR
          </Button>
        </>
      )}

      {step === "error" && (
        <div className="flex flex-col items-center gap-2">
          <XCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-600">{pollError || "Error al generar QR"}</p>
           <Button onClick={generateQr} variant="secondary" size="sm">
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
