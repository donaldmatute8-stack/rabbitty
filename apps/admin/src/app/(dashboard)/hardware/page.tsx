"use client";

import { Card, Badge, Button, toast } from "@rabbitty/ui";
import { Printer, Monitor, Layers, Cpu, Download, BookOpen, Terminal, CheckCircle } from "lucide-react";

export default function HardwarePage() {
  const handleDownload = (os: string) => {
    toast.success(`Descarga iniciada para ${os}`);
  };

  const devices = [
    {
      title: "Impresoras Térmicas (comandas/tickets)",
      description: "Soporte para protocolo estándar ESC/POS a través de USB, Ethernet o Bluetooth.",
      icon: Printer,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Ancho de papel compatible: 80mm (recomendado) y 58mm.",
        "Conexión directa vía Driver Genérico / Texto.",
        "Soporte de corte automático de papel.",
      ],
    },
    {
      title: "Cajón de Dinero (RJ11)",
      description: "Apertura automática mediante pulsos del puerto RJ11 de la impresora de tickets.",
      icon: Layers,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Conexión física al puerto RJ11 de la ticketera.",
        "Apertura automática configurable al registrar ventas en efectivo.",
        "Apertura manual por PIN de seguridad del cajero.",
      ],
    },
    {
      title: "Monitores y Pantallas KDS",
      description: "Visualización interactiva para el sistema de pantallas en cocina (Kitchen Display System).",
      icon: Monitor,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      status: "Soportado",
      badgeVariant: "success" as const,
      details: [
        "Resolución mínima recomendada: Full HD 1080p.",
        "Pantallas táctiles capacitivas recomendadas para mejor flujo.",
        "Actualización en tiempo real vía WebSockets.",
      ],
    },
    {
      title: "Básculas y Balanzas USB",
      description: "Lectura directa del peso en el POS para productos vendidos a granel (fase beta).",
      icon: Cpu,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      status: "Beta",
      badgeVariant: "warning" as const,
      details: [
        "Protocolo de transmisión serie emulado vía USB.",
        "Sincronización de peso en tiempo real en la pantalla de cobro.",
        "Compatibilidad con marcas populares (Torrey, CAS).",
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Hardware y Guías
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Configuración de impresoras térmicas, cajones de dinero y periféricos.</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device Cards */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
            Dispositivos Compatibles
          </h2>
          <div className="grid gap-4">
            {devices.map((dev) => {
              const Icon = dev.icon;
              return (
                <Card key={dev.title} className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shrink-0 ${dev.bg} ${dev.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-white text-base">{dev.title}</h3>
                        <Badge variant={dev.badgeVariant}>{dev.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{dev.description}</p>
                      <ul className="space-y-1.5 text-xs text-gray-500">
                        {dev.details.map((detail, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-pink-500/50 shrink-0" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Integration Client & Manual Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
            Controladores y Utilidades
          </h2>

          <div className="grid gap-6">
            {/* Print Client Card */}
            <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-pink-500/10 blur-2xl pointer-events-none" />
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Rabbitty Print Agent</h3>
                    <p className="text-xs text-gray-400">Servicio local para impresión silenciosa</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Esta pequeña aplicación se instala en la máquina local de caja para comunicarse directamente con las impresoras USB/Red sin abrir el cuadro de diálogo del navegador web.
                </p>
                <div className="pt-2 flex flex-wrap gap-2.5">
                  <Button variant="secondary" size="sm" onClick={() => handleDownload("macOS")}>
                    <Download className="h-4 w-4" />
                    macOS (Apple Silicon)
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleDownload("Windows")}>
                    <Download className="h-4 w-4" />
                    Windows (x64)
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quick Guide Card */}
            <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Guía de Conexión</h3>
                    <p className="text-xs text-gray-400">Puesta en marcha en 3 pasos</p>
                  </div>
                </div>
                <div className="space-y-3 pt-2 text-sm text-gray-400">
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs text-white">1</span>
                    <p>Conecta la impresora por USB o Red y enciéndela.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs text-white">2</span>
                    <p>Instala y ejecuta el <strong>Rabbitty Print Agent</strong> para enlazar tu sucursal.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs text-white">3</span>
                    <p>Ve a <a href="/settings" className="text-pink-500 underline font-semibold">Configuración</a>, selecciona tu impresora predeterminada y realiza un ticket de prueba.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
