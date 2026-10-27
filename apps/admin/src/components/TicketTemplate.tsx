"use client";

import React from "react";
import Image from "next/image";
import { Sparkles, QrCode, Phone, Mail, MapPin, Receipt, ShieldCheck, CheckCircle2 } from "lucide-react";

export interface TicketItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface TicketData {
  restaurantName?: string;
  legalName?: string;
  rfc?: string;
  taxRegime?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  ticketFooter?: string;
  orderNumber?: string;
  tableNumber?: string;
  orderType?: string;
  cashierName?: string;
  date?: string;
  items: TicketItem[];
  subtotal?: number;
  taxRate?: number;
  tax?: number;
  discount?: number;
  tip?: number;
  total: number;
  paymentMethod?: string;
  payments?: Array<{ method: string; amount: number }>;
  cashGiven?: number;
  change?: number;
  currency?: string;
  bunzCashbackRate?: number; // Kept for legacy compatibility
  estimatedBunz?: number;
  customerName?: string;
  awardedBunz?: number;
  orderId?: string;
  claimToken?: string;
  isRefund?: boolean;
  refundAmount?: number;
  reason?: string;
}

export function TicketTemplate({
  data,
  isThermalPaper = false,
  paperWidth = "80mm",
  id = "thermal-printable-receipt",
}: {
  data: TicketData;
  isThermalPaper?: boolean;
  paperWidth?: "58mm" | "80mm";
  id?: string;
}) {
  const currency = data.currency || "MXN";
  const taxRate = data.taxRate ?? 0.16;
  
  // Si no se provee subtotal o tax explícito, calcular base estándar
  const calculatedSubtotal = data.subtotal ?? (data.total / (1 + taxRate));
  const calculatedTax = data.tax ?? (data.total - calculatedSubtotal);
  
  // Si no viene estimatedBunz explícito del backend, calcular usando bunzCashbackRate (o default 20%)
  const fallbackCashbackRate = data.bunzCashbackRate ?? 20;
  const estimatedBunz = data.estimatedBunz ?? Math.round((data.total || 0) * (fallbackCashbackRate / 100));

  const is58mm = paperWidth === "58mm";

  // Visual mode: Dark aesthetic on screen, or clean thermal paper for print
  return (
    <div
      id={id}
      className={
        isThermalPaper
          ? `${is58mm ? "w-full max-w-60" : "w-full max-w-75"} bg-white text-black p-3 font-mono text-xs leading-tight mx-auto select-text shadow-sm`
          : `${is58mm ? "w-full max-w-70" : "w-full max-w-85"} rounded-3xl border border-white/10 bg-linear-to-b from-gray-900/95 via-gray-950/90 to-black p-5 font-mono text-xs leading-relaxed text-gray-200 shadow-2xl backdrop-blur-2xl relative overflow-hidden select-none`
      }
    >
      {/* Decorative Glow inside screen mode */}
      {!isThermalPaper && (
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      )}

      {/* ── TOP HEADER / BRANDING ── */}
      <div className="text-center space-y-2 border-b border-dashed border-gray-700 pb-4">
        {/* Business Logo or Avatar - Replaces default Rabbitty icon when provided */}
        {data.logoUrl ? (
          <div className="flex flex-col items-center justify-center my-2">
            <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-white/15 bg-white/10 p-1.5 shadow-xl flex items-center justify-center">
              <img
                src={data.logoUrl}
                alt={data.restaurantName || "Logo del Negocio"}
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center my-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 font-black text-2xl border border-cyan-500/20 shadow-lg">
              🐰
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-pink-400 mt-1">
              RABBITTY OS POS
            </span>
          </div>
        )}

        {/* Commercial Name */}
        <h2 className={`font-black tracking-tight uppercase leading-snug ${isThermalPaper ? "text-base text-black" : "text-lg text-white"}`}>
          {data.restaurantName || "Mi Restaurante"}
        </h2>

        {/* Legal Details */}
        <div className={`space-y-0.5 text-[11px] ${isThermalPaper ? "text-gray-800" : "text-gray-400"}`}>
          {data.legalName && (
            <p className="font-semibold">{data.legalName}</p>
          )}
          {data.rfc && (
            <p className="tracking-wider">RFC: <span className="font-bold">{data.rfc}</span></p>
          )}
          {data.taxRegime && (
            <p className="text-[10px] leading-tight opacity-90">Régimen: {data.taxRegime}</p>
          )}
          {data.address && (
            <p className="text-[10px] leading-tight pt-1 flex items-start justify-center gap-1">
              <span>{data.address}</span>
            </p>
          )}
          {(data.phone || data.email) && (
            <div className="text-[10px] pt-0.5 space-y-0.5">
              {data.phone && <p>Tel: {data.phone}</p>}
              {data.email && <p>{data.email}</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── TICKET METADATA ── */}
      <div className={`py-3 space-y-1 text-[11px] border-b border-dashed border-gray-700 ${isThermalPaper ? "text-gray-700" : "text-gray-400"}`}>
        <div className="flex justify-between items-baseline">
          <span className="font-black text-sm text-white">Ticket: #{data.orderNumber || "0001"}</span>
          <span>{data.date || new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-pink-400 font-bold">Folio Rabbitty:</span>
          <span className="font-black tracking-wider text-gray-200">
            {data.claimToken ? data.claimToken.slice(0, 10).toUpperCase() : `RBBTY-${data.orderNumber || "0001"}`}
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Tipo: <strong className={isThermalPaper ? "text-black" : "text-white"}>{data.orderType || "Consumo en Sitio"}</strong></span>
          {data.tableNumber && <span>Mesa: <strong>{data.tableNumber}</strong></span>}
        </div>
        {data.cashierName && (
          <div className="text-[10px]">
            <span>Cajero/a: {data.cashierName}</span>
          </div>
        )}
      </div>

      {/* ── ITEMS LIST ── */}
      <div className="py-3 border-b border-dashed border-gray-700">
        <div className={`flex justify-between font-bold text-[10px] uppercase pb-1.5 border-b border-gray-800/50 mb-2 ${isThermalPaper ? "text-black border-gray-300" : "text-gray-400"}`}>
          <span className="w-8">Cant</span>
          <span className="flex-1 text-left px-1">Descripción</span>
          <span className="w-14 text-right">Importe</span>
        </div>

        <div className="space-y-1.5">
          {data.items.length > 0 ? (
            data.items.map((item, idx) => (
              <div key={item.id || idx} className="space-y-0.5">
                <div className={`flex justify-between items-baseline text-[11px] ${isThermalPaper ? "text-black" : "text-gray-200"}`}>
                  <span className="w-8 font-bold">{item.quantity}</span>
                  <span className="flex-1 text-left px-1 font-medium leading-tight">
                    {item.name}
                    {item.quantity > 1 && (
                      <span className="text-[10px] opacity-70 block">@ ${item.unitPrice.toFixed(2)}</span>
                    )}
                  </span>
                  <span className="w-14 text-right font-bold">${item.totalPrice.toFixed(2)}</span>
                </div>
                {item.notes && (
                  <p className="text-[9px] italic text-gray-500 pl-8">"{item.notes}"</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-center py-2 text-gray-500 italic text-[10px]">Sin platillos agregados</p>
          )}
        </div>
      </div>

      {/* ── FINANCIAL & TAX BREAKDOWN (IVA) ── */}
      <div className="py-3 space-y-1.5 border-b border-dashed border-gray-700 text-[11px]">
        <div className={`flex justify-between ${isThermalPaper ? "text-gray-700" : "text-gray-400"}`}>
          <span>Subtotal (Base Imponible)</span>
          <span className="font-semibold">${calculatedSubtotal.toFixed(2)}</span>
        </div>

        <div className={`flex justify-between ${isThermalPaper ? "text-black font-semibold" : "text-cyan-400"}`}>
          <span>IVA ({Math.round(taxRate * 100)}% Trasladado)</span>
          <span className="font-bold">${calculatedTax.toFixed(2)}</span>
        </div>

        {!!data.discount && data.discount > 0 && (
          <div className="flex justify-between text-pink-400">
            <span>Descuento Aplicado</span>
            <span>-${data.discount.toFixed(2)}</span>
          </div>
        )}

        {!!data.tip && data.tip > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Propina voluntaria</span>
            <span>+${data.tip.toFixed(2)}</span>
          </div>
        )}

        {/* Total Highlight */}
        <div className={`flex justify-between items-baseline pt-2 mt-1 border-t border-gray-700/60 font-black text-sm ${isThermalPaper ? "text-black border-black" : "text-white"}`}>
          <span>TOTAL ({currency})</span>
          <span className="text-base tracking-tight">${data.total.toFixed(2)}</span>
        </div>

        {/* Payment info */}
        <div className={`pt-1.5 space-y-1 text-[10px] ${isThermalPaper ? "text-gray-700" : "text-gray-400"}`}>
          {Array.isArray(data.payments) && data.payments.length > 0 ? (
            <div className="space-y-0.5">
              <span className="font-bold text-[9px] uppercase tracking-wider block">Formas de Pago:</span>
              {data.payments.map((p, pIdx) => (
                <div key={pIdx} className="flex justify-between pl-2">
                  <span>• {p.method.toUpperCase()}</span>
                  <span className="font-semibold">${Number(p.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Método de Pago:</span>
              <span className="font-bold uppercase">{data.paymentMethod || "Efectivo"}</span>
            </div>
          )}
          {data.cashGiven != null && data.cashGiven > 0 && (
            <>
              <div className="flex justify-between">
                <span>Entregado:</span>
                <span>${data.cashGiven.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Cambio:</span>
                <span>${(data.change ?? Math.max(0, data.cashGiven - data.total)).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BUNZ CASHBACK & RABBITTY LOYALTY ── */}
      <div className={`py-3 space-y-2 text-center border-b border-dashed border-gray-700 ${isThermalPaper ? "text-black" : "text-gray-300"}`}>
        {(data.paymentMethod === "QR BUNZ" || data.paymentMethod?.includes("BUNZ") || (data.awardedBunz && data.awardedBunz > 0)) ? (
          <div className="rounded-xl p-2 bg-linear-to-r from-emerald-500/10 via-emerald-400/10 to-emerald-500/10 border border-white/5 space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-500 text-[11px]">
              <CheckCircle2 className="h-3 w-3" />
              <span>¡+{data.awardedBunz ?? estimatedBunz} Bunz Acreditados!</span>
            </div>
            <p className="text-[9px] text-gray-400">
              {data.customerName ? `Depositados a ${data.customerName}` : "Depositados automáticamente a tu cuenta."}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl p-2 bg-linear-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-white/5 space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-bold text-pink-400 text-[11px]">
                <Sparkles className="h-3 w-3" />
                <span>¡Ganas +{estimatedBunz} Bunz Recompensa!</span>
              </div>
              <p className="text-[9px] text-gray-400">
                Escanea tu ticket en la mini app de Telegram o Rabbitty para recibir tu cashback.
              </p>
            </div>

            {/* Real QR Code for Validation / Bunz Claim */}
            <div className="flex flex-col items-center justify-center pt-1">
              <div className="bg-white p-2 rounded-xl shadow-md inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://rabbitty.me/scan?claimToken=${data.claimToken || data.orderNumber || "0000"}`)}`}
                  alt="QR Reclamar Recompensa"
                  className="h-16 w-16"
                />
              </div>
              <p className="text-[8px] tracking-widest text-gray-400 uppercase mt-1 font-mono">
                RBBTY-VERIF-{data.orderNumber || "0001"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── FOOTER & POWERED BY ── */}
      <div className="pt-3 text-center space-y-1 text-[10px]">
        {data.ticketFooter ? (
          <p className="italic text-gray-400 leading-snug">{data.ticketFooter}</p>
        ) : (
          <p className="italic text-gray-400">¡Gracias por su visita! Vuelva pronto.</p>
        )}
        <div className="pt-2 flex items-center justify-center gap-1.5 font-black text-[9px] tracking-wider text-gray-500 uppercase">
          <span>🐰 POWERED BY RABBITTY OS</span>
        </div>
        <p className="text-[8px] text-gray-600">rabbitty.me • Punto de Venta Inteligente</p>
      </div>
    </div>
  );
}
