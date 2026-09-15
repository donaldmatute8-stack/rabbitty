"use client";

import { useState } from "react";
import { Card, Badge, Button, toast } from "@rabbitty/ui";
import { 
  Printer, Bluetooth, Wifi, Usb, CheckCircle2, AlertTriangle, 
  HelpCircle, ChevronRight, FileDown, Smartphone, Laptop, Tablet,
  Sparkles, Download, Layers, ShieldCheck, ArrowRight, ExternalLink
} from "lucide-react";

type HardwareType = "bluetooth" | "usb" | "network" | "cashdrawer";
type OsType = "android_ios" | "windows" | "mac";

export function HardwareConnectionGuide() {
  const [selectedHardware, setSelectedHardware] = useState<HardwareType>("bluetooth");
  const [selectedOs, setSelectedOs] = useState<OsType>("android_ios");

  const handlePrintGuidePDF = () => {
    toast.info("Generando vista imprimible / PDF del manual de conexión...");
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* ── HERO BANNER DEL MANUAL INTERACTIVO ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900/90 via-black to-pink-950/20 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Manual de Conexión & Onboarding
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Guía Maestra de Conexión de Hardware
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              Selecciona el tipo de impresora o periférico y el sistema operativo de tu tablet o computadora para ver los pasos exactos de sincronización y calibración con Rabbitty POS.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Button
              variant="secondary"
              onClick={handlePrintGuidePDF}
              className="flex items-center gap-2 border-white/20 hover:border-white/40 bg-white/5"
            >
              <FileDown className="h-4 w-4 text-pink-400" /> Descargar Manual (PDF)
            </Button>
          </div>
        </div>
      </div>

      {/* ── SELECTOR INTERACTIVO PASO 1: TIPO DE DISPOSITIVO ── */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <span className="flex h-5 w-5 rounded-full bg-pink-500/20 text-pink-400 items-center justify-center text-[10px]">1</span>
          Elige el tipo de conexión de tu periférico:
        </label>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setSelectedHardware("bluetooth")}
            className={`flex flex-col items-start p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              selectedHardware === "bluetooth"
                ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.2)]"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Bluetooth className="h-5 w-5" />
              </div>
              {selectedHardware === "bluetooth" && (
                <Badge variant="success" className="text-[10px]">Activo</Badge>
              )}
            </div>
            <h3 className="font-bold text-white text-sm">Térmica Bluetooth</h3>
            <p className="text-xs text-gray-400 mt-1 leading-snug">Inalámbrica portátil (58mm o 80mm). Ideal para tablets y celulares.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedHardware("usb")}
            className={`flex flex-col items-start p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              selectedHardware === "usb"
                ? "bg-gradient-to-br from-pink-500/20 to-rose-500/10 border-pink-400 shadow-[0_0_25px_rgba(236,72,153,0.2)]"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="h-10 w-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Usb className="h-5 w-5" />
              </div>
              {selectedHardware === "usb" && (
                <Badge variant="success" className="text-[10px]">Activo</Badge>
              )}
            </div>
            <h3 className="font-bold text-white text-sm">Térmica USB / Cableada</h3>
            <p className="text-xs text-gray-400 mt-1 leading-snug">Conexión por cable a PC o terminal fija en mostrador.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedHardware("network")}
            className={`flex flex-col items-start p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              selectedHardware === "network"
                ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wifi className="h-5 w-5" />
              </div>
              {selectedHardware === "network" && (
                <Badge variant="success" className="text-[10px]">Activo</Badge>
              )}
            </div>
            <h3 className="font-bold text-white text-sm">Red Ethernet / Wi-Fi</h3>
            <p className="text-xs text-gray-400 mt-1 leading-snug">Impresora por IP en red local (ideal para comandera en cocina o barra).</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedHardware("cashdrawer")}
            className={`flex flex-col items-start p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              selectedHardware === "cashdrawer"
                ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Layers className="h-5 w-5" />
              </div>
              {selectedHardware === "cashdrawer" && (
                <Badge variant="success" className="text-[10px]">Activo</Badge>
              )}
            </div>
            <h3 className="font-bold text-white text-sm">Cajón de Dinero RJ11</h3>
            <p className="text-xs text-gray-400 mt-1 leading-snug">Apertura automática mediante pulso de la impresora de tickets.</p>
          </button>
        </div>
      </div>

      {/* ── SELECTOR INTERACTIVO PASO 2: DISPOSITIVO ANFITRIÓN ── */}
      {selectedHardware !== "cashdrawer" && (
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <span className="flex h-5 w-5 rounded-full bg-pink-500/20 text-pink-400 items-center justify-center text-[10px]">2</span>
            ¿Desde qué dispositivo operarás Rabbitty POS?
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedOs("android_ios")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedOs === "android_ios"
                  ? "bg-white/15 text-white border-white/40 shadow-md"
                  : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
              }`}
            >
              <Smartphone className="h-4 w-4 text-cyan-400" /> Tablet / Teléfono (Android & iPad/iOS)
            </button>
            <button
              type="button"
              onClick={() => setSelectedOs("windows")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedOs === "windows"
                  ? "bg-white/15 text-white border-white/40 shadow-md"
                  : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
              }`}
            >
              <Laptop className="h-4 w-4 text-blue-400" /> Computadora Windows (10 / 11)
            </button>
            <button
              type="button"
              onClick={() => setSelectedOs("mac")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedOs === "mac"
                  ? "bg-white/15 text-white border-white/40 shadow-md"
                  : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
              }`}
            >
              <Laptop className="h-4 w-4 text-purple-400" /> macOS (Apple Silicon / Intel)
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENIDO DINÁMICO DETALLADO: INSTRUCCIONES PASO A PASO ── */}
      <Card className="p-6 md:p-8 border border-white/10 bg-white/5 backdrop-blur-md space-y-6">
        {/* Caso A: Bluetooth */}
        {selectedHardware === "bluetooth" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  🔵
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Instrucciones de Conexión: Impresora Térmica Bluetooth
                  </h3>
                  <p className="text-xs text-gray-400">
                    Dos tipos de Bluetooth distintos: <strong className="text-cyan-300">BLE</strong> (se ve con "Conectar BT") y <strong className="text-pink-300">Classic/SPP</strong> (la mayoría: Goojprt, MUNBYN, Netum, Xprinter, POS-58, YICHIP... usa bridge USB o Wi-Fi).
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Paso 1 */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-cyan-500/20 items-center justify-center text-xs">1</span>
                  Preparación
                </div>
                <h4 className="font-bold text-white text-base">Alimentación y Rollo</h4>
                <ul className="text-xs text-gray-300 space-y-2 leading-relaxed">
                  <li>• Enciende la impresora térmica (mantén presionado el botón <code>POWER</code> 2 segundos).</li>
                  <li>• Abre la tapa y coloca la bobina de papel térmico (el extremo del papel debe desenrollarse hacia arriba).</li>
                  <li>• Asegúrate de que el LED azul/verde de encendido no parpadee en rojo (sin papel).</li>
                </ul>
              </div>

              {/* Paso 2 */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-pink-500/20 items-center justify-center text-xs">2</span>
                  Vinculación
                </div>
                <h4 className="font-bold text-white text-base">BLE o Classic: saber cuál tienes</h4>
                <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                  <p>
                    <strong className="text-cyan-300">Impresora BLE (GATT):</strong> aparece en el botón{" "}
                    <strong>"Conectar BT"</strong> del Panel de Impresoras sin emparejar nada en el sistema.
                    Funciona en Chrome/Edge (escritorio y Android).
                  </p>
                  <p>
                    <strong className="text-pink-300">Impresora Classic (SPP):</strong> la mayoría de POS-58, MTP-II, RPP02N y YICHIP.
                    Jamás aparecerá en "Conectar BT" por límite de la web. Se enlaza por Ajustes &gt; Bluetooth con PIN{" "}
                    <code>0000</code> o <code>1234</code>, pero para imprimir usa el{" "}
                    <strong>modo Rabbitty POS Printer (USB / Mac Bridge)</strong> o el diálogo del navegador.
                  </p>
                  <p className="text-[11px] text-gray-400 bg-white/5 p-2 rounded-lg border border-white/5">
                    En iPad/iOS Safari no hay Web Bluetooth: si tu impresora es BLE usa el navegador Bluefy; si es Classic, usa el bridge USB.
                  </p>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-emerald-500/20 items-center justify-center text-xs">3</span>
                  Calibración en Rabbitty
                </div>
                <h4 className="font-bold text-white text-base">Prueba de Impresión</h4>
                <ul className="text-xs text-gray-300 space-y-2 leading-relaxed">
                  <li>• En la pestaña <em>Configuración de Ticket</em>, selecciona tu <strong>tipo de conexión</strong> y ancho de papel.</li>
                  <li>• <strong>Si es BLE:</strong> presiona <strong>"Conectar BT"</strong> en el Panel de Impresoras, elige tu ticketera en el selector y pulsa <strong>Imprimir Prueba</strong>.</li>
                  <li>• <strong>Si es Classic, USB o iPad:</strong> usa el modo <strong>Rabbitty POS Printer (USB / Mac Bridge)</strong> con la impresora conectada por cable a la Mac de caja, o el diálogo de impresión del navegador.</li>
                </ul>
              </div>
            </div>

            {/* Alerta de Solución de Problemas */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">"Conectar BT" abre el selector pero no veo mi impresora</p>
                <p className="text-amber-200/80 leading-relaxed">
                  Es una impresora <strong>Bluetooth Classic (SPP)</strong>, y Web Bluetooth solo detecta <strong>BLE (GATT)</strong> — no es un fallo del sistema. Soluciones:
                  conéctala por <strong>USB a la Mac de caja</strong> y usa "Rabbitty POS Printer (USB / Mac Bridge)", o una impresora de red/Wi-Fi.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Caso B: USB */}
        {selectedHardware === "usb" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                  🔌
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Instrucciones de Conexión: Impresora Térmica USB
                  </h3>
                  <p className="text-xs text-gray-400">
                    Conexión directa por cable para máxima velocidad y fiabilidad en mostrador.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-pink-500/20 items-center justify-center text-xs">1</span>
                  Conexión Física
                </div>
                <h4 className="font-bold text-white text-base">Cable y Encendido</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Conecta el cable USB Tipo-B a la ticketera y el extremo Tipo-A a tu computadora o hub USB de la tablet. Conecta el eliminador a la corriente y enciéndela.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-cyan-500/20 items-center justify-center text-xs">2</span>
                  Driver Genérico / Texto
                </div>
                <h4 className="font-bold text-white text-base">Controlador de Sistema</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  En Windows/macOS, instala el driver del fabricante o agrega la impresora como <strong>Genérica / Solo Texto (Generic / Text Only)</strong>. Esto garantiza compatibilidad nativa con corte automático de papel.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-emerald-500/20 items-center justify-center text-xs">3</span>
                  Rabbitty Print Agent
                </div>
                <h4 className="font-bold text-white text-base">Impresión Silenciosa</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  El bridge actual (<strong>Rabbitty POS Printer</strong>) imprime directo por USB cuando Rabbitty corre en la Mac de caja con CUPS.
                  El <strong>Rabbitty Print Agent</strong> de escritorio (macOS/Windows, <em>próximamente</em>) dará impresión silenciosa sin diálogo del navegador desde cualquier dispositivo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Caso C: Red Ethernet / Wi-Fi */}
        {selectedHardware === "network" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  🌐
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Instrucciones de Conexión: Impresora de Red Ethernet / Wi-Fi
                  </h3>
                  <p className="text-xs text-gray-400">
                    Ideal para restaurantes con comandas en Cocina, Barra o áreas lejanas al POS.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-emerald-500/20 items-center justify-center text-xs">1</span>
                  Enlace al Router
                </div>
                <h4 className="font-bold text-white text-base">Cable de Red RJ45</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Conecta el cable Ethernet desde el puerto LAN de la impresora a tu switch o módem de internet del restaurante.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-cyan-500/20 items-center justify-center text-xs">2</span>
                  Ticket de Auto-Prueba (IP)
                </div>
                <h4 className="font-bold text-white text-base">Obtener Dirección IP</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Con la impresora apagada, mantén presionado el botón <strong>FEED</strong> y enciéndela. Expulsará un ticket con su IP asignada (ej. <code>192.168.1.150</code>).
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-pink-500/20 items-center justify-center text-xs">3</span>
                  Configurar en Rabbitty
                </div>
                <h4 className="font-bold text-white text-base">Requiere Print Agent (próximamente)</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  La impresión por red (<strong>RAW 9100</strong>) no se puede hacer desde el navegador (no existe raw-TCP web).
                  Llegará con el <strong>Rabbitty Print Agent</strong> local. Por ahora, para comandas de cocina usa el bridge USB/Mac o una impresora BLE.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Caso D: Cajón de Dinero */}
        {selectedHardware === "cashdrawer" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  📦
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Instrucciones de Conexión: Cajón de Dinero Automático (RJ11)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Apertura electromecánica mediante pulsos de 12V / 24V enviados por la impresora de tickets.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-amber-500/20 items-center justify-center text-xs">1</span>
                  Conexión RJ11 (DK Port)
                </div>
                <h4 className="font-bold text-white text-base">Cableado a la Ticketera</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  El cajón de dinero no se conecta a la computadora, sino a la parte posterior de la impresora térmica en el puerto identificado como <strong>DK</strong> (Drawer Kick) o con icono de cajón.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span className="flex h-6 w-6 rounded-full bg-emerald-500/20 items-center justify-center text-xs">2</span>
                  Disparo Automático al Cobrar
                </div>
                <h4 className="font-bold text-white text-base">Apertura en Cobro de Efectivo</h4>
<p className="text-xs text-gray-300 leading-relaxed">
                    Al registrar una venta en <strong>Efectivo</strong> y emitir el ticket por el <strong>bridge USB/Mac (Rabbitty POS Printer)</strong>, el pulso <code>ESC p 0 25 250</code> abre la gaveta automáticamente sin llave.
                  </p>
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER CHECKLIST ── */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>Compatibilidad certificada con estándar ESC/POS y protocolo de tickets Rabbitty.</span>
          </div>

          <Button
            variant="secondary"
            onClick={handlePrintGuidePDF}
            className="flex items-center gap-2 text-xs border-white/20 hover:border-white/40"
          >
            <FileDown className="h-4 w-4 text-pink-400" /> Imprimir esta Guía (PDF)
          </Button>
        </div>
      </Card>
    </div>
  );
}
