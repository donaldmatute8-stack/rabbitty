'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Printer, Sparkles, Smartphone, ArrowRight, CheckCircle2, ShieldCheck, Coffee } from 'lucide-react';
import { SimpleQRCode } from '@/components/SimpleQRCode';

export default function ImpresosPage() {
  // Configuración editable en vivo para el lanzamiento con 626 Café
  const [businessName, setBusinessName] = useState('626 Café');
  const [welcomeBunz, setWelcomeBunz] = useState('25');
  const [appUrl, setAppUrl] = useState('https://rabbitty.me/download?ref=626cafe');
  const [activeTab, setActiveTab] = useState<'all' | 'poster' | 'table' | 'cashier' | 'guide'>('all');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 selection:bg-pink-500 selection:text-white">
      {/* BARRA SUPERIOR DE CONTROL (No imprimible) */}
      <header className="print:hidden sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_conejo.png" alt="Rabbitty" className="w-8 h-8 object-contain transition-transform group-hover:scale-110" />
              <span className="font-black text-xl tracking-tight text-white">RABBITTY</span>
            </Link>
            <span className="text-zinc-600 font-mono text-xs">/</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Kit Impresos Piloto Oficial
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs font-medium">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setActiveTab('poster')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'poster' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A3 Cartel
              </button>
              <button 
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'table' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A5 Mesas
              </button>
              <button 
                onClick={() => setActiveTab('cashier')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'cashier' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A6 Caja
              </button>
              <button 
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'guide' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Hoja Afiliado
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-pink-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Exportar PDF
            </button>
          </div>
        </div>
      </header>

      {/* PANEL DE PERSONALIZACIÓN RÁPIDA (No imprimible) */}
      <section className="print:hidden border-b border-zinc-900 bg-zinc-950/70 py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-pink-500" />
                  Materiales de Activación en Punto de Venta (100% Identidad Rabbitty)
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Diseñado con estética suiza, alto contraste blanco/negro y acentos rosa Rabbitty para máxima atracción visual sin subordinar la marca a terceros.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-md border border-zinc-700/50">
                  Fecha piloto: 20 Octubre 2026
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Nombre del Afiliado / Local
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Bono de Bienvenida (Bunz / $ MXN)
                </label>
                <input
                  type="text"
                  value={welcomeBunz}
                  onChange={(e) => setWelcomeBunz(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  URL Destino del QR (TestFlight / App Store)
                </label>
                <input
                  type="text"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  placeholder="https://testflight.apple.com/join/..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-pink-400 font-mono focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ÁREA DE CONTENIDO IMPRESO / RENDERIZADO */}
      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-16 print:p-0 print:space-y-0 print:m-0">

        {/* PIEZA 1: CARTEL PRINCIPAL A3 */}
        {(activeTab === 'all' || activeTab === 'poster') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 1 · Cartel Principal para Entrada / Cristalera (Formato A3)</span>
              <span>Medidas: 297mm × 420mm</span>
            </div>

            {/* Canvas Cartel A3 (Fondo blanco / negro minimalista Rabbitty) */}
            <div className="w-95 sm:w-120 md:w-150 min-h-212.5 bg-black text-white border border-zinc-800 rounded-3xl p-10 md:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden print:w-full print:min-h-screen print:rounded-none print:border-none print:p-14">
              
              {/* Marca de agua sutil de Rabbitty */}
              <div className="absolute -right-20 -bottom-20 w-96 h-96 opacity-10 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_conejo.png" alt="" className="w-full h-full object-contain filter invert" />
              </div>

              {/* Cabecera Cartel */}
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-12 h-12 object-contain" />
                    <div>
                      <h2 className="font-black text-2xl tracking-tighter text-white">RABBITTY</h2>
                      <p className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">The Real-World Loyalty Network</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black uppercase tracking-wider bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                      Punto Oficial
                    </span>
                  </div>
                </div>

                {/* Titular Impactante */}
                <div className="mt-10 space-y-4">
                  <span className="inline-block text-xs font-mono font-bold tracking-widest text-pink-500 uppercase px-3 py-1 bg-pink-500/10 rounded-md border border-pink-500/20">
                    Lanzamiento Exclusivo en {businessName}
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] text-white">
                    TU CAFÉ HOY. <br />
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">
                      TUS BENEFICIOS SIEMPRE.
                    </span>
                  </h1>
                  <p className="text-sm md:text-base text-zinc-400 font-normal leading-relaxed max-w-md pt-2">
                    Escanea el código, activa tu app de Rabbitty y recibe de inmediato tu bienvenida para disfrutar aquí.
                  </p>
                </div>
              </div>

              {/* Centro: Oferta + QR Gigante */}
              <div className="my-8 bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">Beneficio Inmediato</span>
                  <div className="flex items-baseline justify-center md:justify-start gap-1">
                    <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">${welcomeBunz}</span>
                    <span className="text-xl md:text-2xl font-black text-pink-500 tracking-tight">BUNZ</span>
                  </div>
                  <p className="text-xs text-zinc-300 font-medium">
                    Equivalentes a <strong className="text-white">${welcomeBunz} MXN</strong> en tu cuenta listos para usar en tus consumos.
                  </p>
                  <div className="pt-2 flex items-center justify-center md:justify-start gap-2 text-[11px] text-zinc-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" /> Sin trámites engorrosos
                  </div>
                </div>

                {/* QR Container */}
                <div className="flex flex-col items-center">
                  <SimpleQRCode value={appUrl} size={190} />
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 font-bold tracking-wider">ESCANEA CON TU CÁMARA</span>
                </div>
              </div>

              {/* Pie Cartel A3 */}
              <div className="pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-pink-500" />
                  <span>Disponible para iOS & Android · Rabbitty Network</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">
                  Promoción válida en {businessName}. Sujeta a cupo y términos en app.
                </p>
              </div>

            </div>
          </section>
        )}

        {/* PIEZA 2: DISPLAYS DE MESA (A5) */}
        {(activeTab === 'all' || activeTab === 'table') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 2 · Habladores de Mesa / Carpas Acrílicas (Formato A5 / A6)</span>
              <span>Medidas: 148mm × 210mm (Carpas de doble cara o individuales)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4 w-full max-w-4xl">
              
              {/* Cara Frontal Mesa */}
              <div className="bg-white text-black rounded-3xl p-8 border border-zinc-200 shadow-xl flex flex-col justify-between min-h-115 relative overflow-hidden print:border-black">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                    <span className="font-black tracking-tight text-black text-lg">RABBITTY</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-white px-2.5 py-1 rounded-full">
                    {businessName}
                  </span>
                </div>

                <div className="my-6 text-center">
                  <span className="text-[10px] font-mono font-black text-pink-600 uppercase tracking-widest">
                    Mientras esperas tu café
                  </span>
                  <h3 className="text-2xl md:text-3xl font-black tracking-tight text-black mt-1 leading-tight">
                    ¿YA TIENES TU BONO <br />
                    DE <span className="text-pink-600">${welcomeBunz} BUNZ</span>?
                  </h3>
                  <p className="text-xs text-zinc-600 mt-2 font-medium">
                    1. Escanea el código con tu celular.<br />
                    2. Instala y regístrate en 30 segundos.<br />
                    3. Descubre tu saldo disponible al instante.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <SimpleQRCode value={appUrl} size={150} color="#000000" bgColor="#FFFFFF" />
                  <span className="text-[10px] font-mono font-bold text-zinc-500 mt-2">
                    CÁMARA DEL CELULAR · IOS & ANDROID
                  </span>
                </div>

                <div className="pt-4 border-t border-zinc-200 text-center text-[9px] text-zinc-500 font-mono">
                  1 BUNZ = $1 MXN · Válido en consumos en {businessName}
                </div>
              </div>

              {/* Cara Posterior Mesa (Explicativa / Gamificada) */}
              <div className="bg-black text-white rounded-3xl p-8 border border-zinc-800 shadow-xl flex flex-col justify-between min-h-115 relative overflow-hidden print:border-black">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                    <span className="font-black tracking-tight text-white text-lg">RABBITTY</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2.5 py-1 rounded-full">
                    ¿Cómo funciona?
                  </span>
                </div>

                <div className="my-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-pink-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Acumula en cada visita</h4>
                      <p className="text-[11px] text-zinc-400">Pagas tu café habitual y recibes Bunz digitales directo en tu wallet.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Sin tarjetas de plástico</h4>
                      <p className="text-[11px] text-zinc-400">Todo vive en tu app de Rabbitty, siempre accesible y seguro.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Canjea en tus compras</h4>
                      <p className="text-[11px] text-zinc-400">Úsalos como saldo real en este café y comercios de la red local.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center pt-2">
                  <SimpleQRCode value={appUrl} size={110} />
                  <span className="text-[9px] font-mono text-zinc-400 mt-2 font-bold">
                    ESCANEAME PARA REGISTRARTE
                  </span>
                </div>

                <div className="pt-3 border-t border-zinc-800 text-center text-[9px] text-zinc-500 font-mono">
                  Pregunta a nuestro barista por la promo de hoy.
                </div>
              </div>

            </div>
          </section>
        )}

        {/* PIEZA 3: SEÑAL DE CAJA (A6) */}
        {(activeTab === 'all' || activeTab === 'cashier') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 3 · Señal de Mostrador / Caja Registradora (Formato A6)</span>
              <span>Medidas: 105mm × 148mm (Junto al lector de tarjetas / POS)</span>
            </div>

            <div className="w-full max-w-sm bg-linear-to-b from-zinc-950 to-black text-white border-2 border-pink-500 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center justify-between min-h-95">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                <span className="font-black text-base tracking-tight">RABBITTY POINT</span>
              </div>

              <div className="my-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded">
                  Al pagar tu café
                </span>
                <h3 className="text-xl font-black tracking-tight mt-1">
                  ¿YA TIENES TU CUENTA?
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Escanea antes de pagar y recibe tus <strong className="text-white">${welcomeBunz} Bunz</strong> de bienvenida.
                </p>
              </div>

              <SimpleQRCode value={appUrl} size={140} />

              <div className="w-full pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>{businessName}</span>
                <span className="text-pink-400 font-bold">1 Bunz = $1 MXN</span>
              </div>
            </div>
          </section>
        )}

        {/* PIEZA 4: HOJA COMERCIAL Y GUION PARA EL NEGOCIO (A4) */}
        {(activeTab === 'all' || activeTab === 'guide') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 4 · Hoja de Operación & Argumentario para el Dueño / Baristas (Formato A4)</span>
              <span>Medidas: 210mm × 297mm (Documento interno del negocio)</span>
            </div>

            <div className="w-full max-w-3xl bg-white text-zinc-900 rounded-3xl p-10 md:p-12 border border-zinc-200 shadow-xl print:p-8 print:border-none">
              
              {/* Header Hoja */}
              <div className="flex items-center justify-between pb-6 border-b border-zinc-200">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo_conejo.png" alt="Rabbitty" className="w-10 h-10 object-contain" />
                  <div>
                    <h2 className="text-xl font-black text-black tracking-tight">RABBITTY FOR BUSINESS</h2>
                    <p className="text-xs text-zinc-500 font-mono">Guía de Lanzamiento Piloto · {businessName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full border border-pink-200">
                    Octubre 2026
                  </span>
                </div>
              </div>

              {/* Guion para el Personal */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-pink-600 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4" /> Guion Rápido para el Barista / Cajero
                </h3>
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-3 text-sm">
                  <p className="text-zinc-800 font-medium">
                    <strong className="text-black">Al cobrar o entregar el café:</strong> <br />
                    <em>“¿Ya tienes Rabbitty? Estamos estrenándolo hoy en el café. Puedes escanear este código en el mostrador para registrarte y llevarte ${welcomeBunz} de saldo de bienvenida”.</em>
                  </p>
                  <p className="text-zinc-800 font-medium">
                    <strong className="text-black">Si el cliente pregunta cómo funciona:</strong> <br />
                    <em>“Es una app de fidelidad digital. Cada visita acumulas Bunz que puedes canjear directamente aquí como dinero en tus próximos cafés”.</em>
                  </p>
                </div>
              </div>

              {/* Parámetros Acordados del Piloto */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Parámetros del Piloto Controlado
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Bono Bienvenida</span>
                    <span className="text-xl font-black text-black">${welcomeBunz} Bunz</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">(= ${welcomeBunz} MXN)</span>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Tipo de Promoción</span>
                    <span className="text-base font-black text-black">Registro Inicial</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">1 vez por cliente verificado</span>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Integridad Financiera</span>
                    <span className="text-base font-black text-emerald-700">Ledger Inmutable</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">Control de emisión atómica</span>
                  </div>
                </div>
              </div>

              {/* Qué Métricas Recibirá el Dueño */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 mb-3">
                  Métricas de Retorno que Rabbitty Entregará a {businessName}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Total de escaneos únicos captados en mesa y caja.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Clientes nuevos registrados y activados en el local.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Bunz emitidos vs Bunz efectivamente canjeados.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Tasa de retorno de clientes durante las siguientes semanas.</span>
                  </li>
                </ul>
              </div>

              {/* Firma y Contacto */}
              <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
                <span>Rabbitty Network · Soporte en Vivo: contacto@rabbitty.me</span>
                <span className="font-mono text-[11px]">Identidad de Marca Oficial Rabbitty © 2026</span>
              </div>

            </div>
          </section>
        )}

      </main>

      {/* ESTILOS DE IMPRESIÓN DEDICADOS */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
