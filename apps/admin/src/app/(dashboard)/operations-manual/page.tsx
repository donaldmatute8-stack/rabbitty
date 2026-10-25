"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Printer, 
  Banknote, 
  CreditCard, 
  HandCoins, 
  ClipboardCheck, 
  Lock, 
  LockOpen, 
  ArrowLeftRight, 
  Monitor, 
  Flame, 
  Users, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  BookOpen,
  Sparkles,
  ShieldCheck,
  QrCode,
  Download
} from "lucide-react";
import { Button, Card, Badge, cn } from "@rabbitty/ui";

export default function OperationsManualPage() {
  const [activeTab, setActiveTab] = useState<"all" | "cash" | "pos" | "kiosk" | "kds" | "faq">("all");

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div id="operations-manual-container" className="space-y-8 pb-16 print:p-0 print:space-y-6 print:text-black">
      <style jsx global>{`
        @media print {
          /* 1. Resetear el viewport global de Next.js y desarmar el scroll lock de DashboardClientWrapper */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. Ocultar todos los elementos globales del layout (sidebar, header, sandbox banner, bunzy drawer) */
          aside, header, nav, footer, [role="banner"], .no-print, [class*="SandboxBanner"], [class*="AdminSidebar"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 3. Desbloquear los contenedores padres flex y overflow para permitir múltiples páginas */
          div[class*="DashboardClientWrapper"],
          div[class*="flex-col"][class*="h-screen"],
          main[class*="overflow-y-auto"],
          div[class*="max-w-7xl"] {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
          }

          /* 4. Contenedor imprimible */
          #operations-manual-container {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0.5cm 0.5cm 1cm 0.5cm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt !important;
            line-height: 1.4 !important;
          }

          /* 5. Asegurar contraste y que no corte cajas a la mitad */
          .print-card,
          div[class*="rounded-"],
          div[class*="Card"] {
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            margin: 1.2cm 1cm 1.2cm 1cm;
            size: letter portrait;
          }
        }
      `}</style>

      {/* Header Banner - Printable Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/90 via-black to-purple-950/40 p-8 shadow-2xl backdrop-blur-xl print:border print:border-gray-300 print:p-6 print:bg-white print:text-black">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none print:hidden" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold mb-3 print:hidden">
              <Sparkles className="h-3.5 w-3.5" /> Manual Maestro de Operaciones & Caja
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white print:text-black">
              Guía Visual Rabbitty OS
            </h1>
            <p className="text-gray-400 print:text-gray-700 mt-2 text-sm max-w-2xl leading-relaxed">
              Manual integral para encargados, cajeros, baristas y gerentes. Aprende paso a paso cómo abrir caja, cobrar por tarjeta y Bunz, registrar gastos menores sin descuadres y realizar el corte definitivo (Ticket Z).
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Button 
              onClick={handlePrint}
              className="bg-white text-gray-950 hover:bg-gray-200 font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
            </Button>
            <Link href="/pos">
              <Button variant="secondary" className="px-4 py-2.5 rounded-xl font-bold border border-white/10">
                Ir al POS <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter Navigation Chips - Hidden on Print */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-white/10 overflow-x-auto print:hidden">
          {[
            { id: "all", label: "Toda la Guía", icon: BookOpen },
            { id: "cash", label: "Caja y Cortes (Z / X)", icon: Banknote },
            { id: "pos", label: "Terminal POS y Pagos", icon: CreditCard },
            { id: "kiosk", label: "Kiosko Autoservicio", icon: Monitor },
            { id: "kds", label: "Cocina & KDS", icon: Flame },
            { id: "faq", label: "Dudas y Descuadres", icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 1: EL CICLO DIARIO DE CAJA (CORTE, APERTURA Y RETIROS) */}
      {(activeTab === "all" || activeTab === "cash") && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
              1
            </div>
            <div>
              <h2 className="text-xl font-black text-white print:text-black">El Ciclo Diario de Caja y Turnos</h2>
              <p className="text-xs text-gray-400 print:text-gray-600">Desde la apertura de gaveta hasta el corte Z al final del día</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Paso 1: Apertura */}
            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-3 relative overflow-hidden print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Paso 1 · Inicio
                </span>
                <LockOpen className="h-4 w-4 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white print:text-black">Abrir Caja</h3>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                Toca <strong className="text-white print:text-black">"Caja cerrada · Abrir"</strong> en el POS. Ingresa tu <strong className="text-emerald-400">PIN de 4 dígitos</strong> y captura el <strong className="text-white print:text-black">Fondo Inicial</strong> (cambio en monedas/billetes).
              </p>
              <div className="pt-2 border-t border-white/5 print:border-gray-200 text-[11px] text-gray-500">
                ✅ Imprime ticket de apertura automático.
              </div>
            </Card>

            {/* Paso 2: Retiros y Pagos */}
            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-3 relative overflow-hidden print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Paso 2 · Operación
                </span>
                <HandCoins className="h-4 w-4 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white print:text-black">Gastos y Pagos Menores</h3>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                ¿Llegó el garrafón de agua ($220) o café ($200)? Entra a <strong className="text-white print:text-black">Caja / Turno → Retiro</strong>. Escribe el monto, concepto y tu PIN.
              </p>
              <div className="pt-2 border-t border-white/5 print:border-gray-200 text-[11px] text-amber-400/90 font-medium">
                ⚠️ Si no hay saldo suficiente en efectivo, el sistema te avisa y no te permite retirar de más.
              </div>
            </Card>

            {/* Paso 3: Cierre Parcial */}
            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-3 relative overflow-hidden print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  Paso 3 · Control
                </span>
                <ClipboardCheck className="h-4 w-4 text-cyan-400" />
              </div>
              <h3 className="text-base font-bold text-white print:text-black">Cierre Parcial (Ticket X)</h3>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                Para revisar cómo vas a mitad del turno sin cerrar la caja. Cuenta el efectivo en gaveta y captúralo. El sistema imprime el balance sin interrumpir las ventas.
              </p>
              <div className="pt-2 border-t border-white/5 print:border-gray-200 text-[11px] text-gray-500">
                🔍 Arqueo seguro para auditorías rápidas.
              </div>
            </Card>

            {/* Paso 4: Cierre Z */}
            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-3 relative overflow-hidden print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                  Paso 4 · Fin de Día
                </span>
                <Lock className="h-4 w-4 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-white print:text-black">Cierre Definitivo (Ticket Z)</h3>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                El corte final del día. Primero coteja tus vouchers de tarjeta física con la pantalla, cuenta tu efectivo final e ingresa tu PIN + PIN de manager.
              </p>
              <div className="pt-2 border-t border-white/5 print:border-gray-200 text-[11px] text-rose-400/90 font-medium">
                🖨️ Genera el Ticket Z final para contabilidad.
              </div>
            </Card>
          </div>

          {/* Tarjeta Destacada: Fórmula Matemática de Cuadre */}
          <Card className="p-6 border border-cyan-500/20 bg-linear-to-r from-cyan-950/20 via-black to-blue-950/20 rounded-2xl print:bg-white print:border-gray-300">
            <h4 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4" /> La Fórmula Matemática que el Sistema Cuadra por Ti
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 print:bg-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Fondo Inicial</span>
                <span className="text-base font-black text-white print:text-black">+$500.00</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 print:bg-gray-100">
                <span className="text-emerald-400 block text-[10px] uppercase font-bold">+ Ventas Efectivo</span>
                <span className="text-base font-black text-emerald-400">+$2,450.00</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 print:bg-gray-100">
                <span className="text-amber-400 block text-[10px] uppercase font-bold">- Gastos / Retiros</span>
                <span className="text-base font-black text-amber-400">-$420.00</span>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 print:bg-gray-200 md:col-span-2">
                <span className="text-cyan-400 block text-[10px] uppercase font-bold">= Efectivo Físico en Gaveta</span>
                <span className="text-lg font-black text-cyan-300 print:text-black">$2,530.00 MXN</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 print:text-gray-600 mt-3 leading-relaxed">
              * Las ventas cobradas con <strong className="text-white print:text-black">Tarjeta de Crédito/Débito</strong> y <strong className="text-purple-400">Bunz</strong> no se suman al efectivo de la gaveta; se desglosan en su propia sección para que las cotejes con el reporte de tu terminal bancaria física.
            </p>
          </Card>
        </div>
      )}

      {/* SECCIÓN 2: TERMINAL POS Y MÉTODOS DE PAGO */}
      {(activeTab === "all" || activeTab === "pos") && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center font-black">
              2
            </div>
            <div>
              <h2 className="text-xl font-black text-white print:text-black">Terminal POS y Métodos de Cobro</h2>
              <p className="text-xs text-gray-400 print:text-gray-600">Cobro ágil en mostrador con tickets térmicos y recompensas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-2.5 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Banknote className="h-4 w-4" /> Cobro en Efectivo
              </div>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                1. Agrega productos al carrito.<br />
                2. Toca <strong className="text-white print:text-black">Cobrar → Efectivo</strong>.<br />
                3. Ingresa con cuánto paga el cliente.<br />
                4. La pantalla calcula el cambio exacto e imprime el ticket de venta.
              </p>
            </Card>

            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-2.5 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <CreditCard className="h-4 w-4" /> Terminal Bancaria
              </div>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                1. Toca <strong className="text-white print:text-black">Cobrar → Tarjeta</strong>.<br />
                2. Pasa la tarjeta en tu terminal bancaria física (Clip, Mercado Pago, Banco).<br />
                3. Confirma el cobro en el POS para registrar la venta sin afectar el efectivo.
              </p>
            </Card>

            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-2.5 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                <QrCode className="h-4 w-4" /> Pago con QR / Bunz
              </div>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                1. El cliente muestra su <strong className="text-purple-400">Rabbitty ID</strong> en su teléfono.<br />
                2. Escanéalo con la cámara del iPad o scanner USB.<br />
                3. El cliente gana cashback instantáneo o paga con su saldo Bunz acumulado.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: KIOSKO AUTOSERVICIO Y KDS DE COCINA */}
      {(activeTab === "all" || activeTab === "kiosk" || activeTab === "kds") && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-black">
              3
            </div>
            <div>
              <h2 className="text-xl font-black text-white print:text-black">Kiosko Autoservicio y KDS de Cocina</h2>
              <p className="text-xs text-gray-400 print:text-gray-600">Automatiza pedidos y sincroniza salón con barra y cocina</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-3 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Monitor className="h-4 w-4" /> Kiosko en Stand / iPad
                </span>
                <Badge variant="secondary" className="border-purple-500/30 text-purple-300">Ruta: /kiosk</Badge>
              </div>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                El Kiosko permite a tus clientes ordenar por sí mismos. Cuenta con <strong className="text-white print:text-black">Screen WakeLock</strong> (la pantalla nunca se apaga) y genera un ticket con número de turno para pagar en caja o cobro QR.
              </p>
              <ul className="text-xs text-gray-400 space-y-1 pl-4 list-disc">
                <li>Diseñado para evitar filas en horas pico.</li>
                <li>Modificadores de platillos (sin cebolla, leche de avena, etc.).</li>
                <li>Botón de llamada a mesero integrado.</li>
              </ul>
            </Card>

            <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md space-y-3 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                  <Flame className="h-4 w-4" /> KDS de Cocina y Barra
                </span>
                <Badge variant="secondary" className="border-orange-500/30 text-orange-300">Ruta: /kitchen</Badge>
              </div>
              <p className="text-xs text-gray-400 print:text-gray-600 leading-relaxed">
                Pantalla táctil que reemplaza las comandas de papel. Cada comanda cambia de color según el tiempo de espera:
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Verde: &lt; 5 min
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  Amarillo: 5-12 min
                </div>
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                  Rojo: &gt; 12 min
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* SECCIÓN 4: RESOLUCIÓN DE DUDAS Y PREGUNTAS FRECUENTES (FAQ) */}
      {(activeTab === "all" || activeTab === "faq") && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              4
            </div>
            <div>
              <h2 className="text-xl font-black text-white print:text-black">Preguntas Frecuentes y Descuadres</h2>
              <p className="text-xs text-gray-400 print:text-gray-600">Qué hacer en los casos del día a día</p>
            </div>
          </div>

          <div className="space-y-3">
            <Card className="p-4 border border-white/5 bg-white/5 backdrop-blur-md print:border print:border-gray-300 print:bg-white">
              <h4 className="text-xs font-bold text-white print:text-black flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                ¿Qué hago si al cerrar la caja me falta o sobra dinero?
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-600 mt-2 leading-relaxed">
                No te preocupes: el sistema no bloquea el cierre. Simplemente captura la cantidad real que tienes en mano. Si hay diferencia, el sistema te pedirá una breve nota justificativa (ej. *"Se dio cambio de más por error en orden #12"*) y la autorización del PIN de manager. Todo queda transparentado en la bitácora inmutable.
              </p>
            </Card>

            <Card className="p-4 border border-white/5 bg-white/5 backdrop-blur-md print:border print:border-gray-300 print:bg-white">
              <h4 className="text-xs font-bold text-white print:text-black flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ¿Cómo registro compras rápidas como agua, hielo o café de emergencia?
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-600 mt-2 leading-relaxed">
                Usa el botón <strong className="text-white print:text-black">"Retiro"</strong> en el modal de Caja/Turno. Coloca la justificación (ej. *"Pago garrafones de agua"*). El sistema descontará esa salida del efectivo que debes entregar al final del día para que nunca te salga faltante.
              </p>
            </Card>

            <Card className="p-4 border border-white/5 bg-white/5 backdrop-blur-md print:border print:border-gray-300 print:bg-white">
              <h4 className="text-xs font-bold text-white print:text-black flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                ¿Dónde se crean o cambian los PINs de los cajeros?
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-600 mt-2 leading-relaxed">
                Desde el menú de administración en <Link href="/staff" className="text-pink-400 underline font-semibold">Personal & Roles</Link>. Cada empleado puede tener su propio PIN de 4 dígitos y rol asignado (Cajero, Mesero, Cocinero o Manager).
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Footer Callout */}
      <div className="p-6 rounded-2xl border border-white/5 bg-linear-to-r from-pink-500/10 via-purple-500/5 to-cyan-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">¿Tienes dudas en vivo en el mostrador?</h4>
            <p className="text-xs text-gray-400">Pregúntale directamente a Bunzy AI en tu chat o consulta el menú de Ayuda.</p>
          </div>
        </div>
        <Link href="/academy">
          <Button variant="secondary" className="text-xs font-bold whitespace-nowrap">
            Ver Academia Rabbitty →
          </Button>
        </Link>
      </div>
    </div>
  );
}
