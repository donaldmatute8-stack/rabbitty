"use client";

import React, { useState, useEffect } from "react";
import { X, Smartphone, Copy, Check, ExternalLink, Loader2, RefreshCw, Send, ShieldCheck, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface ScannerPairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScannerPairModal({ isOpen, onClose }: ScannerPairModalProps) {
  const [loading, setLoading] = useState(false);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(900); // 15 mins
  const [linked, setLinked] = useState(false);

  const fetchPairing = async () => {
    setLoading(true);
    setLinked(false);
    try {
      const res = await fetch("/api/auth/pairing/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPairingUrl(data.pairingUrl);
        setSessionId(data.sessionId || null);
        setBusinessName(data.businessName || "Rabbitty Negocio");
        setCountdown(900);
      }
    } catch (err) {
      console.error("Error generating pairing code:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPairing();
    } else {
      setPairingUrl(null);
      setSessionId(null);
      setCopied(false);
      setLinked(false);
    }
  }, [isOpen]);

  // Mientras el modal está abierto, sondea si el móvil ya completó la vinculación.
  useEffect(() => {
    if (!isOpen || !sessionId || linked) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/pairing/status?sid=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "linked") {
          setLinked(true);
        }
      } catch {
        /* red intermitente: reintenta en el siguiente tick */
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [isOpen, sessionId, linked]);

  // Al vincularse, cierra solo tras un breve instante para que se vea el éxito.
  useEffect(() => {
    if (!linked) return;
    const t = setTimeout(() => onClose(), 2600);
    return () => clearTimeout(t);
  }, [linked]);

  useEffect(() => {
    if (!isOpen || !pairingUrl) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchPairing();
          return 900;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, pairingUrl]);

  if (!isOpen) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  const copyToClipboard = () => {
    if (!pairingUrl) return;
    navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    if (!pairingUrl) return;
    const msg = `🐰 *Vincular Scanner Rabbitty para ${businessName}*\n\nAbre este enlace en tu celular para activar el escáner de cobro:\n${pairingUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-gray-900 via-gray-950 to-black p-6 shadow-2xl text-white space-y-5 overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 h-44 w-44 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Vincular Celular / Scanner</h3>
              <p className="text-[11px] text-gray-400">Convierte tu móvil en terminal de cobro y validación</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center pt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-pink-400" />
              <p className="text-xs text-gray-400 font-medium">Generando código seguro...</p>
            </div>
          ) : linked ? (
            <div className="flex flex-col items-center space-y-4 w-full py-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                <ShieldCheck className="h-10 w-10" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-white">¡Vinculado!</h3>
                <p className="text-xs text-gray-300 px-6 leading-relaxed">
                  El móvil ya es terminal de cobro de <strong className="text-pink-400">{businessName}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Cerrando…</span>
              </div>
            </div>
          ) : pairingUrl ? (
            <div className="flex flex-col items-center space-y-4 w-full">
              {/* QR Container */}
              <div className="relative p-3.5 rounded-2xl bg-white border border-white/20 shadow-[0_0_30px_rgba(236,72,153,0.25)]">
                <QRCodeSVG
                  value={pairingUrl}
                  size={190}
                  level="M"
                  includeMargin={false}
                  imageSettings={{
                    src: "/Rabbitty_vector.png",
                    x: undefined,
                    y: undefined,
                    height: 38,
                    width: 38,
                    excavate: true,
                  }}
                />
              </div>

              {/* Countdown badge */}
              <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Válido por: <span className="font-mono text-pink-400 font-bold">{timeFormatted}</span>
                <button
                  onClick={fetchPairing}
                  className="ml-2 hover:text-white transition-colors"
                  title="Regenerar código"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Instructions */}
              <p className="text-xs text-center text-gray-300 px-4 leading-relaxed">
                Apunta con la cámara de tu iPhone o Android a este código para vincularte instantáneamente a <strong className="text-white">{businessName}</strong>.
              </p>

              {/* Estado de vinculación en vivo */}
              <div className="flex items-center gap-2 text-[11px] font-bold text-pink-400/90">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Vinculando… espera</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-bold text-gray-200 transition-all cursor-pointer"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
                  <span>{copied ? "¡Copiado!" : "Copiar Enlace"}</span>
                </button>

                <button
                  onClick={shareViaWhatsApp}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 text-xs font-bold text-emerald-400 transition-all cursor-pointer"
                >
                  <Send className="h-4 w-4 text-emerald-400" />
                  <span>Enviar WhatsApp</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <p className="text-xs text-red-400">No se pudo generar el enlace de emparejamiento.</p>
              <button
                onClick={fetchPairing}
                className="py-2 px-4 rounded-xl bg-pink-500/20 text-pink-400 text-xs font-bold border border-pink-500/30 hover:bg-pink-500/30 transition-all"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="relative z-10 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-gray-400" /> Cifrado de un solo uso
          </span>
          <span>Rabbitty Omnicanal v2.4</span>
        </div>
      </div>
    </div>
  );
}
