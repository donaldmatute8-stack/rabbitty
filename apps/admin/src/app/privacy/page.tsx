import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Smartphone, Printer, Camera, Mail, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidad — Rabbitty POS',
  description: 'Política de Privacidad y Tratamiento de Datos Personales de Rabbitty POS para comercios y usuarios.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-pink-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/pos" className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a Rabbitty POS
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Vigente 2026</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Política de Privacidad</h1>
            <p className="text-slate-400 text-sm">Rabbitty POS y Plataforma Rabbitty Pay</p>
          </div>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-pink-400" /> 1. Introducción y Responsable
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Rabbitty (&ldquo;nosotros&rdquo;, &ldquo;nuestro&rdquo; o &ldquo;la Plataforma&rdquo;) valora la privacidad de los comercios afiliados, cajeros y clientes finales. Esta Política de Privacidad describe cómo recopilamos, utilizamos y protegemos la información a través de nuestra aplicación nativa <strong>Rabbitty POS</strong> y nuestros servicios web asociados.
            </p>
          </section>

          <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-pink-400" /> 2. Información que Recopilamos
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                <h3 className="font-bold text-white mb-2">Datos del Comercio</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Nombre del establecimiento y sucursal.</li>
                  <li>Identificador de tenant y configuración de POS.</li>
                  <li>Catálogo de productos, categorías y precios.</li>
                  <li>Registro histórico de órdenes y cobros.</li>
                </ul>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                <h3 className="font-bold text-white mb-2">Datos de Transacción</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Monto de cobro en MXN y recompensas en Bunz.</li>
                  <li>Identificador anonimizado de cliente o ticket.</li>
                  <li>Método de pago (Efectivo, Tarjeta, Bunz).</li>
                  <li>Sello de tiempo y folio fiscal/interno.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
              <Printer className="w-5 h-5 text-pink-400" /> 3. Permisos de Hardware en la App Nativa
            </h2>
            <p className="text-slate-300 text-sm mb-4">
              Para operar como punto de venta eficiente, Rabbitty POS requiere los siguientes permisos explícitos en su dispositivo Android o iOS:
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 items-start bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
                <Printer className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Bluetooth (BLUETOOTH_CONNECT, BLUETOOTH_SCAN):</strong>
                  <span className="text-slate-400">Se utiliza exclusivamente para descubrir, emparejar y enviar datos de impresión ESC/POS a impresoras térmicas de tickets (58mm y 80mm). No se utiliza para rastreo ni geolocalización.</span>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
                <Camera className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Cámara (CAMERA):</strong>
                  <span className="text-slate-400">Permite a los cajeros escanear códigos QR de clientes para emitir recompensas en Bunz o autorizar pagos. Las imágenes capturadas por el sensor óptico no se almacenan ni se transmiten; el procesamiento del código QR ocurre en memoria local.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-pink-400" /> 4. Seguridad de los Datos
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Toda comunicación entre Rabbitty POS y nuestros servidores centrales viaja encriptada mediante protocolos TLS 1.3 con certificados SSL estrictos. Los registros contables y saldos de recompensas se gestionan con un motor transaccional inmutable con bloqueos de concurrencia y validación criptográfica de firmas.
            </p>
          </section>

          <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-pink-400" /> 5. Contacto y Ejercicio de Derechos
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Los usuarios y comercios pueden solicitar en cualquier momento la consulta, rectificación o eliminación de sus datos enviando una solicitud a nuestro equipo de privacidad:
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-mono border border-slate-700">
              <Mail className="w-4 h-4 text-pink-400" /> soporte@rabbitty.me
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 py-6 text-center text-xs">
        <p>&copy; {new Date().getFullYear()} Rabbitty. Todos los derechos reservados. Impulsado por Rabbitty POS.</p>
      </footer>
    </div>
  );
}
