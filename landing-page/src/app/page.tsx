'use client';

import { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowRight, Store, UserCircle2, Zap, Shield, Smartphone, QrCode, X, Clock, Salad, Truck, Receipt, Bell } from 'lucide-react';

export default function LandingPage() {
  const [showSmartContractModal, setShowSmartContractModal] = useState(false);
  const [showWhitepaperModal, setShowWhitepaperModal] = useState(false);

  // Typewriter effect state
  const businessTypes = ['restaurante', 'cafetería', 'barbería', 'gimnasio', 'tienda'];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Spotlight effect state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.pageX,
        y: e.pageY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const word = businessTypes[currentWordIndex];
    let timeout: NodeJS.Timeout;

    if (isDeleting) {
      timeout = setTimeout(() => {
        setCurrentText(prev => prev.slice(0, -1));
        if (currentText.length === 0) {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % businessTypes.length);
        }
      }, 50);
    } else {
      if (currentText.length === word.length) {
        timeout = setTimeout(() => setIsDeleting(true), 2000);
      } else {
        timeout = setTimeout(() => {
          setCurrentText(word.slice(0, currentText.length + 1));
        }, 100);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWordIndex]);

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const stagger: Variants = {
    visible: { transition: { staggerChildren: 0.2 } }
  };

  return (
    <main className="min-h-screen bg-[#05050A] text-white overflow-hidden selection:bg-primary/30">
      
      {/* BACKGROUND ELEMENTS (HERO ONLY) */}
      <div 
        className="absolute top-0 left-0 w-full h-[120vh] z-0 pointer-events-none bg-[#05050A]"
        style={{
          maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
        }}
      >
        {/* The generated cafe image as base layer */}
        <div 
          className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat opacity-20"
        />
        
        {/* Static ambient glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/5 blur-[150px]" />
        
        {/* Interactive Flashlight / Spotlight effect */}
        <div 
          className="absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.15), transparent 40%)`
          }}
        />
        
        {/* Noise overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-20" />
        
        {/* Dark vignette to blend edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#05050A] via-transparent to-[#05050A] z-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05050A] via-transparent to-[#05050A] z-20" />
      </div>

      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 bg-[#05050A]/80 backdrop-blur-xl border-b border-white/10 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/icon_ra.png" alt="Rabbitty" className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(233,30,99,0.5)]" />
          <span className="font-black text-xl tracking-tight hidden sm:block">RABBITTY<span className="text-gradient">.me</span></span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/70">
          <a href="#rabbitters" className="hover:text-white transition-colors">Rabbitters</a>
          <a href="#affiliates" className="hover:text-white transition-colors">Negocios</a>
          <a href="#bunz" className="hover:text-white transition-colors">Economía</a>
        </nav>
        <div className="flex items-center gap-4">
          <a href={process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.rabbitty.me"} target="_blank" className="hidden md:block text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
            Portal de Negocios
          </a>
          <a href="https://t.me/Rabbittyme_bot/app" target="_blank" className="bg-white text-black px-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform">
            Abrir App
          </a>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-20">
        <motion.div 
          initial="hidden" animate="visible" variants={stagger}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div variants={fadeInUp} className="inline-block mb-6 px-4 py-1.5 rounded-full glass-panel border-white/10 text-xs font-bold tracking-widest text-primary uppercase">
            V2.0 Is Here • El Sistema Operativo Definitivo
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
            Entra a la <br className="hidden md:block"/>
            <span className="text-gradient">Madriguera.</span>
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="text-lg md:text-2xl text-white/60 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
            Gana mientras gastas. Administra tu negocio gratis. <br className="hidden md:block" />
            Una sola app. Dos universos conectados por bunz.
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#rabbitters" className="w-full sm:w-auto px-8 py-4 rounded-full bg-primary hover:bg-pink-600 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-[0_0_30px_rgba(233,30,99,0.3)]">
              <UserCircle2 size={20} />
              Soy Rabbitter
            </a>
            <a href="#affiliates" className="w-full sm:w-auto px-8 py-4 rounded-full glass-panel hover:bg-white/10 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all hover:scale-105">
              <Store size={20} />
              Soy Negocio
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* CONSUMERS (Rabbitters) */}
      <section id="rabbitters" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="order-2 md:order-1 relative"
          >
            {/* Mockup */}
            <div className="w-[320px] h-[640px] mx-auto bg-black border-[8px] border-[#1A1A24] rounded-[50px] overflow-hidden relative shadow-[0_20px_60px_rgba(0,0,0,0.8)] before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-[120px] before:h-[30px] before:bg-[#1A1A24] before:rounded-b-[20px] before:z-20">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0D0D1A] to-black">
                {/* Fake UI */}
                <div className="h-40 bg-gradient-to-b from-primary/20 to-transparent p-6 pt-12">
                  <div className="text-3xl font-black mb-2">1,250 bunz</div>
                  <div className="text-white/50 text-sm">Balance Disponible</div>
                </div>
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5" />
                      <div className="flex-1">
                        <div className="h-3 w-20 bg-white/20 rounded mb-2" />
                        <div className="h-2 w-32 bg-white/10 rounded" />
                      </div>
                      <div className="text-primary font-bold text-sm">+50</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Floating elements */}
            <div className="absolute top-20 -right-10 glass-panel p-4 rounded-2xl flex items-center gap-3 animate-[bounce_4s_infinite]">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="font-bold text-sm">Nivel Épico</div>
                <div className="text-xs text-white/50">Multiplicador x1.5</div>
              </div>
            </div>
          </motion.div>
          
          <div className="order-1 md:order-2 space-y-8">
            <div className="text-primary font-bold tracking-widest text-sm uppercase">Para Rabbitters</div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Vive experiencias, <br/> colecciona recompensas.
            </h2>
            <p className="text-xl text-white/60">
              Descubre los mejores lugares de la ciudad. Escanea tu código, acumula bunz y úsalos como dinero real en cualquier negocio afiliado.
            </p>
            <div className="space-y-6">
              {[
                { icon: Smartphone, title: 'Todo en un solo lugar', desc: 'Social feed, mapa interactivo, billetera y programa de referidos integrados.' },
                { icon: Zap, title: 'Give to Get', desc: 'Gana hasta un 100% de recompensas al consumir y referir amigos.' },
                { icon: Shield, title: 'Identidad Dinámica', desc: 'Sube de nivel, desbloquea logros y evoluciona tu perfil.' }
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary flex-shrink-0">
                    <f.icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BUSINESS (Affiliates) */}
      <section id="affiliates" className="relative z-10 py-32 px-6 bg-white/5 border-y border-white/5">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="text-blue-400 font-bold tracking-widest text-sm uppercase">Para Negocios (V2)</div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Tu <span className="text-gradient">{currentText}</span><span className="animate-pulse">|</span>, <br/> ahora en el futuro.
            </h2>
            <p className="text-xl text-white/60">
              No pagues por software administrativo nunca más. Migra a nuestro sistema integrado nativamente a la economía Rabbitty.
            </p>
            <div className="space-y-6">
              {[
                { icon: Store, title: 'Software POS Gratuito', desc: 'Punto de venta, inventario predictivo con IA y administración de mesas de última generación.' },
                { icon: QrCode, title: 'BYOD: Pedidos Inteligentes', desc: 'Tus clientes escanean el QR, ordenan y pagan nativamente desde Telegram con Stars o Cripto, sin descargar apps.' },
                { icon: Zap, title: 'Migración Mágica (IA)', desc: '¿Tienes menú en UberEats? Pega el link y Rabbitty clona todo tu menú y precios en 5 minutos.' },
                { icon: Salad, title: 'Recetas y Costeo', desc: 'Calcula el costo real de cada platillo vinculando ingredientes del inventario. Margen de ganancia en tiempo real.' },
                { icon: Bell, title: 'Lista de Espera Inteligente', desc: 'Notifica a tus clientes vía Telegram cuando su mesa esté lista. Tiempo estimado de espera automático.' },
                { icon: Truck, title: 'Proveedores y Compras', desc: 'Crea órdenes de compra y al recibirlas el inventario se actualiza solo con los nuevos costos.' },
                { icon: Receipt, title: 'Gastos y Rentabilidad (P&L)', desc: 'Estado de resultados completo: ingresos, gastos por categoría, utilidad neta y margen en tiempo real.' },
                { icon: Clock, title: 'Control de Turnos', desc: 'Reloj checador digital. Registra entrada/salida del personal y visualiza turnos activos al instante.' },
                { icon: Shield, title: 'Modo Offline Indestructible', desc: 'Si se cae tu internet, nuestro POS encola ventas y sincroniza en segundo plano al regresar la red.' }
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <f.icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://t.me/rabbittyhub/10" target="_blank" className="inline-block px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg text-center transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                Reservar Deploy Demo
              </a>
              <a href={process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.rabbitty.me"} target="_blank" className="inline-block px-8 py-4 rounded-full border border-blue-500/30 hover:bg-blue-500/10 text-blue-400 font-bold text-lg text-center transition-all">
                Ingresar al Portal
              </a>
            </div>
          </div>
          
          <div className="relative">
            <div className="aspect-[4/3] rounded-3xl glass-panel p-2 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent z-10 pointer-events-none" />
              {/* Fake Dashboard */}
              <div className="w-full h-full bg-[#111] rounded-2xl overflow-hidden flex flex-col">
                <div className="h-12 border-b border-white/10 flex items-center px-4 gap-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-xs text-white/50 font-mono">rabbitty-pos.local</div>
                </div>
                <div className="flex-1 p-6 grid grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-4">
                    <div className="h-32 rounded-xl bg-white/5 p-4 flex flex-col justify-between border border-white/5">
                      <div className="text-white/50 text-sm">Ventas de Hoy</div>
                      <div className="text-3xl font-black">$4,250.00</div>
                    </div>
                    <div className="h-48 rounded-xl bg-white/5 border border-white/5" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-20 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <span className="text-blue-400 font-bold">Cobrar Mesa 4</span>
                    </div>
                    <div className="h-20 rounded-xl bg-primary/20 border border-primary/30 flex flex-col items-center justify-center p-2 text-center">
                      <span className="text-primary font-bold text-sm">Enviar bunz</span>
                      <span className="text-primary/70 text-xs">+50 bunz al cliente</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="relative z-10 py-32 px-6 text-center">
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
          Convenience is <span className="text-gradient">King.</span>
        </h2>
        <div className="flex justify-center gap-4">
          <a href="https://t.me/Rabbittyme_bot/app" target="_blank" className="px-8 py-4 rounded-full bg-white text-black font-bold text-lg transition-transform hover:scale-105 flex items-center gap-2">
            Abrir en Telegram <ArrowRight size={20} />
          </a>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/icon_ra.png" alt="Rabbitty" className="w-8 h-8 object-contain opacity-50" />
            <span className="font-bold text-white/50">© 2026 Rabbitty Corp.</span>
          </div>
          <div className="flex gap-6 text-sm font-semibold text-white/40">
            <a href="/whitepaper" className="hover:text-white transition-colors cursor-pointer">Whitepaper</a>
            <button onClick={() => setShowSmartContractModal(true)} className="hover:text-white transition-colors cursor-pointer">Smart Contract</button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {showSmartContractModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-md w-full relative">
            <button onClick={() => setShowSmartContractModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Shield className="text-blue-500" />
              Seguridad On-Chain
            </h3>
            <p className="text-white/70 leading-relaxed mb-6">
              El ecosistema de Rabbitty está asegurado en la blockchain de <strong>TON (The Open Network)</strong>. 
              Los smart contracts que rigen la emisión y quema de bunz son auditados y públicos, garantizando total transparencia y seguridad.
            </p>
            <button onClick={() => setShowSmartContractModal(false)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
