'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { ArrowRight, Store, UserCircle2, Zap, Shield, Smartphone, QrCode, X, Clock, Salad, Truck, Receipt, Bell, Building2, DollarSign, Monitor, Gift, Award, Megaphone, Cake, BookOpen, HelpCircle, Sparkles, Compass, Headphones, Activity, Utensils, Globe, ChevronDown, Coins } from 'lucide-react';
import BunzGuide from '@/components/BunzGuide';
import OpenAppButton from '@/components/OpenAppButton';
import PricingPackagesSection, { PackagePlan, NicheData } from '@/components/PricingPackagesSection';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5213312345678';
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || 'Rabbittyme_bot';
const BUSINESS_TYPES = ['restaurante', 'cafetería', 'barbería', 'gimnasio', 'tienda'];

type TrackingWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

const fireConversion = (event: string, params: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const w = window as TrackingWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
  w.gtag?.('event', event, params);
  w.fbq?.('track', event === 'Lead' ? 'Lead' : 'SubmitApplication', params);
};

const EMPTY_FORM = {
  negocio: '', tipo: '', paquete: '', periodicidad: 'yearly',
  nombre: '', telefono: '', email: '', ubicacion: '', como_supo: '', mensaje: '',
  packageCode: '', packageName: '', nicheId: '', nicheName: '',
  billingPeriod: 'yearly', setupBunz: 0, initialVaultBunz: 0,
  lat: null as number | null, lng: null as number | null,
  utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '',
  referrer: '', website: '', _ts: 0,
};

export default function LandingPage() {
  const [showSmartContractModal, setShowSmartContractModal] = useState(false);
  const [showBunzGuide, setShowBunzGuide] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [selectedPlanInfo, setSelectedPlanInfo] = useState<{ planName: string; setupBunz: number; billing: string } | null>(null);
  const [formStep, setFormStep] = useState(0);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'ok' | 'denied'>('idle');

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const requestGeo = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setGeoStatus('ok');
      },
      () => setGeoStatus('denied'),
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleFormSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const payload = {
      ...formData,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    };

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setSubmitError('No pudimos registrar tu solicitud. Revisa tus datos e inténtalo de nuevo o escríbenos por WhatsApp.');
        setSubmitting(false);
        return;
      }
      fireConversion('Lead', { niche: formData.nicheId, package: formData.packageCode, value: formData.setupBunz });
      fireConversion('SubmitApplication', { niche: formData.nicheId, package: formData.packageCode });
      setFormSubmitted(true);
    } catch {
      setSubmitError('Error de conexión. Revisa tu internet e inténtalo de nuevo.');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormStep(0);
    setFormData({ ...EMPTY_FORM });
    setSelectedPlanInfo(null);
    setFormSubmitted(false);
    setSubmitError('');
    setGeoStatus('idle');
    setShowApplyForm(false);
  };

  const handleSelectPlan = (plan: PackagePlan, niche: NicheData, billingPeriod: 'monthly' | 'yearly') => {
    setSelectedPlanInfo({
      planName: plan.name,
      setupBunz: plan.setupBunz,
      billing: billingPeriod === 'yearly' ? 'Membresía Anual (48,000 BUNZ/año)' : 'Membresía Mensual (5,000 BUNZ/mes)',
    });
    setFormData(prev => ({
      ...prev,
      tipo: niche.name,
      paquete: `${plan.name} (${plan.setupBunz.toLocaleString()} BUNZ)`,
      periodicidad: billingPeriod,
      packageCode: plan.id,
      packageName: plan.name,
      nicheId: niche.id,
      nicheName: niche.name,
      setupBunz: plan.setupBunz,
      initialVaultBunz: plan.initialVaultBunz,
      billingPeriod,
      _ts: Date.now(),
    }));
    setFormStep(0);
    setSubmitError('');
    setShowApplyForm(true);
  };
  // Typewriter effect state
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
    const word = BUSINESS_TYPES[currentWordIndex];
    let timeout: NodeJS.Timeout;

    if (isDeleting) {
      timeout = setTimeout(() => {
        setCurrentText(prev => prev.slice(0, -1));
        if (currentText.length === 0) {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % BUSINESS_TYPES.length);
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
        <div className="absolute inset-0 bg-linear-to-b from-[#05050A] via-transparent to-[#05050A] z-20" />
        <div className="absolute inset-0 bg-linear-to-r from-[#05050A] via-transparent to-[#05050A] z-20" />
      </div>

      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 py-3.5 px-4 sm:px-8 md:px-12 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between bg-[#05050A]/85 backdrop-blur-2xl border border-white/10 rounded-full px-4 sm:px-6 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {/* Brand */}
          <a href="#" className="flex items-center gap-3 group">
            <Image 
              src="/icon_ra.png" 
              alt="Rabbitty" 
              width={34} 
              height={34} 
              className="object-contain drop-shadow-[0_0_15px_rgba(233,30,99,0.6)] group-hover:scale-105 transition-transform" 
            />
            <span className="font-black text-lg tracking-tight hidden sm:block text-white">
              RABBITTY<span className="text-gradient">.me</span>
            </span>
          </a>

          {/* Integrated Segmented Pill Navigation */}
          <nav className="hidden lg:flex items-center bg-white/4 border border-white/8 rounded-full p-1 text-xs font-semibold">
            {/* Comunidad / Rabbitters */}
            <a 
              href="#rabbitters" 
              className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/8 transition-all flex items-center gap-1.5"
            >
              <UserCircle2 size={13} className="text-white/60" />
              Rabbitters
            </a>

            {/* Dropdown Negocios / B2B */}
            <div className="relative group/biz">
              <a 
                href="#affiliates" 
                className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/8 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Store size={13} className="text-blue-400" />
                Negocios
                <ChevronDown size={11} className="text-white/40 group-hover/biz:rotate-180 transition-transform duration-200" />
              </a>

              {/* Mega Dropdown */}
              <div className="absolute top-full left-0 mt-2 w-64 p-2 bg-[#090912]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] opacity-0 translate-y-2 pointer-events-none group-hover/biz:opacity-100 group-hover/biz:translate-y-0 group-hover/biz:pointer-events-auto transition-all duration-200 z-50">
                <a 
                  href="#affiliates" 
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/6 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Store size={15} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-white text-xs font-bold">Afiliados y POS</div>
                    <div className="text-[10px] text-white/50 leading-tight">Gestión y terminales de lealtad</div>
                  </div>
                </a>
                <a 
                  href="#paquetes" 
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/6 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
                    <Zap size={15} className="text-pink-400" />
                  </div>
                  <div>
                    <div className="text-white text-xs font-bold">Planes y Hardware</div>
                    <div className="text-[10px] text-white/50 leading-tight">Membresías por nicho de negocio</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Mood & Vibe Phygital Pill */}
            <a 
              href="#phygital-experience" 
              className="px-3.5 py-1.5 rounded-full text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all flex items-center gap-1.5 font-bold shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            >
              <Sparkles size={12} className="text-amber-400 animate-spin-slow" />
              Mood & Vibe
            </a>

            {/* Paquetes */}
            <a 
              href="#paquetes" 
              className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/8 transition-all"
            >
              Paquetes
            </a>

            {/* Economía Bunz */}
            <a 
              href="#bunz" 
              className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/8 transition-all flex items-center gap-1.5"
            >
              <Coins size={12} className="text-emerald-400" />
              Economía
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <a 
              href="https://admin.rabbitty.me/login" 
              target="_blank" 
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-full transition-all"
            >
              <Building2 size={13} className="text-blue-400" />
              Portal Negocios
            </a>
            <OpenAppButton className="bg-white text-black px-4.5 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] cursor-pointer flex items-center gap-1.5">
              <span>Abrir App</span>
              <ArrowRight size={13} />
            </OpenAppButton>
          </div>
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
      <section id="rabbitters" className="relative z-10 py-32 px-6 overflow-x-clip">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="order-2 md:order-1 relative"
          >
            {/* Mockup */}
            <div className="w-[320px] h-160 mx-auto bg-black border-8 border-[#1A1A24] rounded-[50px] overflow-hidden relative shadow-[0_20px_60px_rgba(0,0,0,0.8)] before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-30 before:h-7.5 before:bg-[#1A1A24] before:rounded-b-[20px] before:z-20">
              <div className="absolute inset-0 bg-linear-to-b from-[#0D0D1A] to-black">
                {/* Fake UI */}
                <div className="h-40 bg-linear-to-b from-primary/20 to-transparent p-6 pt-12">
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
            {/* Floating elements - responsive positioning to avoid pushing mobile horizontal viewport */}
            <div className="absolute top-20 right-2 sm:-right-4 md:-right-8 glass-panel p-3.5 sm:p-4 rounded-2xl flex items-center gap-2.5 sm:gap-3 shadow-xl backdrop-blur-xl z-20 animate-[bounce_4s_infinite]">
              <span className="text-xl sm:text-2xl">🏆</span>
              <div>
                <div className="font-bold text-xs sm:text-sm">Nivel Épico</div>
                <div className="text-[11px] sm:text-xs text-white/50">Multiplicador x1.5</div>
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
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary shrink-0">
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
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
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
            </div>
          </div>
          
          <div className="relative">
            <div className="aspect-4/3 rounded-3xl glass-panel p-2 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-linear-to-tr from-blue-900/40 to-transparent z-10 pointer-events-none" />
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

      {/* PHYGITAL EXPERIENCE & MOOD INTELLIGENCE FOR AFFILIATES */}
      <section id="phygital-experience" className="relative z-10 py-32 px-6 bg-linear-to-b from-transparent via-amber-950/15 to-transparent border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black tracking-widest uppercase mb-4">
              <Sparkles size={14} /> La Nueva Dimensión Phygital
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Más allá de los puntos: <br />
              <span className="text-gradient">Inteligencia de Atmósfera & Conexión.</span>
            </h2>
            <p className="text-white/60 text-lg mt-4 max-w-3xl mx-auto leading-relaxed">
              Descubre lo que ninguna app tradicional de lealtad puede ofrecerte: conecta con el estado de ánimo voluntario de tus clientes, optimiza la atmósfera sensorial de tu local y participa en la inteligencia colectiva de tu ciudad.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1: Proof of Atmosphere */}
            <div className="group rounded-3xl border border-emerald-500/20 bg-linear-to-b from-emerald-500/10 via-white/3 to-transparent p-7 backdrop-blur-sm hover:border-emerald-500/40 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                  <Activity size={28} />
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-1">Métrica Científica</div>
                <h3 className="text-xl font-black text-white mb-3">Proof of Atmosphere (PoA)</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Comprueba de forma empírica el retorno de inversión de tu ambiente. Correlaciona recetas ambientales (iluminación, volumen, estilo de servicio) con tiempo de permanencia, ticket promedio y retorno de clientes en 7 y 30 días.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400 font-bold">
                <span>KPIs Verificados</span>
                <span>+18% Ticket Promedio</span>
              </div>
            </div>

            {/* Pillar 2: Rabbitty Vibe Passport */}
            <div className="group rounded-3xl border border-cyan-500/20 bg-linear-to-b from-cyan-500/10 via-white/3 to-transparent p-7 backdrop-blur-sm hover:border-cyan-500/40 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                  <Compass size={28} />
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-cyan-400 mb-1">Descubrimiento Urbano</div>
                <h3 className="text-xl font-black text-white mb-3">Rabbitty Vibe Passport</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Rutas de exploración inter-negocios. Los Rabbitters recorren tu ciudad completando pasaportes temáticos de bienestar (Café de especialidad en la mañana, Coworking por la tarde, Cena íntima por la noche), trayendo nuevo tráfico cruzado sin pagar ads.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-cyan-400 font-bold">
                <span>Rutas Cruzadas</span>
                <span>Zero Ad Spend</span>
              </div>
            </div>

            {/* Pillar 3: The Collective Sonic Room */}
            <div className="group rounded-3xl border border-violet-500/20 bg-linear-to-b from-violet-500/10 via-white/3 to-transparent p-7 backdrop-blur-sm hover:border-violet-500/40 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-400 mb-6 group-hover:scale-110 transition-transform">
                  <Headphones size={28} />
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-violet-400 mb-1">Curaduría Acústica</div>
                <h3 className="text-xl font-black text-white mb-3">The Collective Sonic Room</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Identidad sonora adaptativa y legal. Sintoniza tu espacio con curadurías musicales de alto impacto según la energía colectiva predominante de tu salón (Calma, Enfoque o Celebración), o permite a los clientes escuchar en sus audífonos con deeplinks universales.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-violet-400 font-bold">
                <span>Ambiente Armónico</span>
                <span>TOS Compliant</span>
              </div>
            </div>

            {/* Pillar 4: Rabbitty Vibe Graph */}
            <div className="group rounded-3xl border border-blue-500/20 bg-linear-to-b from-blue-500/10 via-white/3 to-transparent p-7 backdrop-blur-sm hover:border-blue-500/40 transition-all duration-500 flex flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                  <Store size={28} />
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-blue-400 mb-1">Inteligencia de Red</div>
                <h3 className="text-xl font-black text-white mb-3">Rabbitty Vibe Graph</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Inteligencia de red descentralizada: descubre qué atmósfera detona mayor recompra, predice flujos de concurrencia y genera sinergias comerciales y airdrops geocercados con otros comercios complementarios de tu colonia.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-blue-400 font-bold">
                <span>Grafos de Comportamiento</span>
                <span>Moat Incomparable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PHASE 11-12: POWER FEATURES */}
      <section className="relative z-10 py-32 px-6 bg-linear-to-b from-transparent via-blue-950/15 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-black tracking-widest uppercase mb-4">
              <Sparkles size={14} /> V2.0 Power Features
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Tu negocio, <span className="text-gradient">potenciado.</span>
            </h2>
            <p className="text-white/60 text-lg mt-3 max-w-2xl mx-auto">
              La suite operativa, sensorial y de inteligencia más avanzada para marcas independientes.
            </p>
          </div>

          {/* Categorized Power Feature Grid */}
          <div className="space-y-12">
            {/* Category 1: Operación & Punto de Venta */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="h-2 w-2 rounded-full bg-pink-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-pink-400 m-0">Operación & Punto de Venta (POS / KDS)</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { icon: Utensils, title: 'Rabbitty Digital Branch', desc: 'Convierte tu perfil en una sucursal digital interactiva: menú estructurado, pedidos para recoger o en mesa por QR y personalización antes de llegar.', color: 'text-pink-400' },
                  { icon: QrCode, title: 'Pagos QR en Mesa (BYOD)', desc: 'Paga, divide cuenta y agrega propina desde el celular del comensal. Sin apps pesadas ni fichas plásticas.', color: 'text-cyan-400' },
                  { icon: Store, title: 'Dashboard Multi-Sucursal', desc: 'Todas tus sucursales en un solo panel ejecutivo con KPIs consolidados y auditoría en tiempo real.', color: 'text-blue-400' },
                  { icon: Monitor, title: 'Menú Digital TV & Kiosko', desc: 'Convierte cualquier pantalla HDMI o iPad en un menú dinámico o kiosko autoservicio actualizado al segundo.', color: 'text-emerald-400' },
                  { icon: DollarSign, title: 'Precios Dinámicos IA', desc: 'Reglas automáticas de cashback y multiplicadores por hora, día y afluencia sin perder margen.', color: 'text-amber-400' },
                  { icon: Building2, title: 'Eventos & Catering', desc: 'Gestiona reservaciones corporativas con menús cotizados, depósitos y seguimiento de comandas.', color: 'text-purple-400' },
                ].map((f, i) => (
                  <div key={i} className="group rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-md hover:border-pink-500/30 hover:bg-white/5 transition-all duration-300">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                      <f.icon size={22} />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{f.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed m-0">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Category 2: Fidelización, Crecimiento & SEO LLM */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 m-0">Fidelización, Crecimiento & SEO de Nueva Generación</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { icon: Globe, title: 'Landing Pages & SEO LLM', desc: 'Subdominio propio (tunegocio.rabbitty.me), microdatos Schema.org estructurados y optimización GEO para ChatGPT y Gemini.', color: 'text-emerald-400' },
                  { icon: Award, title: 'Programa de Lealtad & Niveles', desc: 'Niveles, Bunz y gamificación inmutable. Tus clientes vuelven con incentivos reales que no sangran tu flujo.', color: 'text-purple-400' },
                  { icon: Gift, title: 'Referidos Inteligentes', desc: 'Tus comensales invitan a sus amigos en un clic por Telegram. Tracking completo y bonificaciones automáticas.', color: 'text-rose-400' },
                  { icon: Megaphone, title: 'Campañas Segmentadas (HITL)', desc: 'Detecta clientes inactivos o VIPs y activa ofertas flash geocercadas con aprobación humana de un clic.', color: 'text-orange-400' },
                  { icon: Cake, title: 'Cumpleaños Automáticos', desc: 'Incentivos de aniversario y cumpleaños automáticos para asegurar la mesa grande del festejo.', color: 'text-pink-400' },
                  { icon: BookOpen, title: 'Academy & Onboarding 1-Clic', desc: 'Centro de formación interactivo para capacitar cajeros, baristas y gerentes en minutos.', color: 'text-indigo-400' },
                ].map((f, i) => (
                  <div key={i} className="group rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-md hover:border-emerald-500/30 hover:bg-white/5 transition-all duration-300">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                      <f.icon size={22} />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{f.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed m-0">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Category 3: Atmósfera, Música & Red Comunitaria */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 m-0">Atmósfera, Identidad Sonora & Red Comunitaria</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { icon: Sparkles, title: 'Rabbitty Mood & Telemetría', desc: 'Descubre qué estado de ánimo buscan tus clientes (Calma, Enfoque, Fiesta) y sincroniza el servicio en tiempo real.', color: 'text-amber-400' },
                  { icon: Activity, title: 'Proof of Atmosphere (PoA)', desc: 'Mide empíricamente el impacto del ambiente: correlaciona intervenciones acústicas con ticket promedio y retención.', color: 'text-emerald-400' },
                  { icon: Headphones, title: 'The Collective Sonic Room', desc: 'Curadurías musicales autorizadas por franja horaria. Sintoniza tu sala con la atmósfera ideal de tu audiencia.', color: 'text-violet-400' },
                  { icon: Compass, title: 'Rabbitty Vibe Passport', desc: 'Rutas comunitarias entre comercios. Los Rabbitters descubren tu local completando pasaportes temáticos en la ciudad.', color: 'text-cyan-400' },
                  { icon: Building2, title: 'Rabbitty Vibe Graph', desc: 'Inteligencia de red descentralizada: identifica colaboraciones cruzadas de alto impacto con negocios de tu zona.', color: 'text-blue-400' },
                ].map((f, i) => (
                  <div key={i} className="group rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-md hover:border-cyan-500/30 hover:bg-white/5 transition-all duration-300">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                      <f.icon size={22} />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{f.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed m-0">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <a href="#paquetes" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-linear-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 text-white font-bold text-lg transition-all shadow-[0_0_30px_rgba(233,30,99,0.2)] cursor-pointer no-underline">
              Ver Paquetes de Iniciación <ArrowRight size={20} />
            </a>
            <div className="mt-4">
              <button onClick={() => setShowBunzGuide(true)} className="text-white/40 hover:text-white/70 text-sm transition-all cursor-pointer inline-flex items-center gap-1.5 border-none bg-transparent">
                <HelpCircle size={14} /> ¿Cómo funciona la economía Bunz?
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* DYNAMIC PRICING AND PACKAGES SECTION BY NICHE */}
      <PricingPackagesSection onSelectPlan={handleSelectPlan} />

      {/* NAV SECTION: BUNZ ECONOMY */}
      <section id="bunz" className="relative z-10 py-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-yellow-400 font-bold tracking-widest text-sm uppercase mb-3">Bunz Economy</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
            La moneda que <span className="text-gradient">une</span> tu comunidad.
          </h2>
          <p className="text-xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed">
            Cada bunz es una recompensa. Cada recompensa es un cliente feliz que vuelve. 
            Un ecosistema completo donde consumidores ganan, negocios crecen y la economía local se fortalece.
          </p>
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { value: '10%', label: 'Recompensa en Bunz por compra' },
              { value: 'x3', label: 'Multiplicador máximo por nivel' },
              { value: '$1.00', label: 'Valor fijo por Bunz (MXN)' },
            ].map((s, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-3xl font-black text-yellow-400 mb-1">{s.value}</p>
                <p className="text-sm text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <button onClick={() => setShowBunzGuide(true)} className="text-yellow-400/50 hover:text-yellow-400 text-sm transition-all cursor-pointer inline-flex items-center gap-1.5">
              <HelpCircle size={14} /> Explicación detallada de la economía Bunz
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="relative z-10 py-32 px-6 text-center">
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
          Convenience is <span className="text-gradient">King.</span>
        </h2>
        <div className="flex justify-center gap-4">
          <OpenAppButton className="px-8 py-4 rounded-full bg-white text-black font-bold text-lg transition-transform hover:scale-105 flex items-center gap-2 cursor-pointer">
            Abrir en Rabbitty
          </OpenAppButton>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/icon_ra.png" alt="Rabbitty" width={32} height={32} className="object-contain opacity-50" />
            <span className="font-bold text-white/50">© 2026 Rabbitty Corp.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-white/40">
            <Link href="/privacy" className="hover:text-white transition-colors cursor-pointer">Privacidad y Términos</Link>
            <Link href="/whitepaper" className="hover:text-white transition-colors cursor-pointer">Whitepaper</Link>
            <button onClick={() => setShowSmartContractModal(true)} className="hover:text-white transition-colors cursor-pointer">Smart Contract</button>
          </div>
        </div>
      </footer>

      {/* APPLY FORM MODAL (Typeform-style) */}
      {showApplyForm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="bg-[#0D0D1A] border border-white/10 rounded-3xl w-full max-w-lg relative overflow-hidden shadow-[0_0_60px_rgba(233,30,99,0.15)]">
            {/* Progress bar */}
            <div className="h-1 bg-white/5">
              <div className="h-full bg-linear-to-r from-pink-600 to-blue-600 transition-all duration-500" style={{ width: `${((formStep + 1) / 4) * 100}%` }} />
            </div>
            <button onClick={resetForm} className="absolute top-4 right-4 text-white/50 hover:text-white z-10">
              <X size={24} />
            </button>

            {!formSubmitted ? (
              <div className="p-8">
                {/* Selected Plan Summary Banner */}
                {selectedPlanInfo && (
                  <div className="mb-4 p-3 rounded-2xl bg-linear-to-r from-pink-500/10 via-purple-500/10 to-transparent border border-pink-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block">Paquete Seleccionado</span>
                      <span className="text-sm font-black text-white">{selectedPlanInfo.planName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-black text-white">{selectedPlanInfo.setupBunz.toLocaleString()} BUNZ</span>
                      <span className="text-[9px] text-white/50 block">{selectedPlanInfo.billing}</span>
                    </div>
                  </div>
                )}

                {/* Step indicator */}
                <div className="text-xs font-bold text-white/30 mb-2 tracking-widest uppercase">Paso {formStep + 1} de 4</div>

                {/* Honeypot anti-spam (invisible) */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                  value={formData.website} onChange={(e) => handleFormChange('website', e.target.value)}
                  className="absolute -left-2499.75 h-0 w-0 opacity-0" />

                {submitError && (
                  <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">{submitError}</div>
                )}

                {/* Step 1: Business name */}
                {formStep === 0 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-2xl font-black">¿Cómo se llama tu negocio?</h3>
                    <p className="text-white/50">Cuéntanos el nombre de tu establecimiento para empezar.</p>
                    <input
                      type="text" placeholder="Ej: Taquería El Compa"
                      value={formData.negocio} onChange={(e) => handleFormChange('negocio', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 focus:bg-white/[0.07] transition-all"
                      autoFocus onKeyDown={(e) => e.key === 'Enter' && formData.negocio && setFormStep(1)} />
                    <div className="flex justify-end">
                      <button onClick={() => formData.negocio && setFormStep(1)} disabled={!formData.negocio}
                        className="px-8 py-3 rounded-full bg-linear-to-r from-pink-600 to-blue-600 text-white font-bold disabled:opacity-30 transition-all cursor-pointer">
                        Siguiente <ArrowRight size={18} className="inline ml-1" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Contact info */}
                {formStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                    <h3 className="text-2xl font-black">Tus datos de contacto</h3>
                    <p className="text-white/50">Para que podamos comunicarnos contigo.</p>
                    <input type="text" placeholder="Tu nombre completo" value={formData.nombre} onChange={(e) => handleFormChange('nombre', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 transition-all" />
                    <input type="tel" placeholder="WhatsApp / Teléfono" value={formData.telefono} onChange={(e) => handleFormChange('telefono', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 transition-all" />
                    <input type="email" placeholder="Correo electrónico" value={formData.email} onChange={(e) => handleFormChange('email', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 transition-all" />
                    <div className="flex justify-between">
                      <button onClick={() => setFormStep(0)} className="text-white/50 hover:text-white font-bold transition-all cursor-pointer">← Atrás</button>
                      <button onClick={() => (formData.telefono || formData.email) && setFormStep(2)} disabled={!formData.telefono && !formData.email}
                        className="px-8 py-3 rounded-full bg-linear-to-r from-pink-600 to-blue-600 text-white font-bold disabled:opacity-30 transition-all cursor-pointer">
                        Siguiente <ArrowRight size={18} className="inline ml-1" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Location */}
                {formStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-2xl font-black">¿Dónde estás ubicado?</h3>
                    <p className="text-white/50">Ciudad, estado o colonia donde operas. Esto nos ayuda a ubicarte en el mapa.</p>
                    <input type="text" placeholder="Ej: Guadalajara, Jalisco" value={formData.ubicacion} onChange={(e) => handleFormChange('ubicacion', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 transition-all"
                      autoFocus onKeyDown={(e) => e.key === 'Enter' && setFormStep(3)} />
                    <button type="button" onClick={requestGeo} disabled={geoStatus === 'asking'}
                      className="w-full px-5 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 text-sm font-bold transition-all cursor-pointer disabled:opacity-50">
                      {geoStatus === 'ok'
                        ? '✅ Ubicación exacta capturada'
                        : geoStatus === 'asking'
                          ? 'Obteniendo ubicación…'
                          : geoStatus === 'denied'
                            ? '📍 Compartir mi ubicación exacta (permiso denegado)'
                            : '📍 Usar mi ubicación exacta (opcional)'}
                    </button>
                    <div className="flex justify-between">
                      <button onClick={() => setFormStep(1)} className="text-white/50 hover:text-white font-bold transition-all cursor-pointer">← Atrás</button>
                      <button onClick={() => setFormStep(3)} className="px-8 py-3 rounded-full bg-linear-to-r from-pink-600 to-blue-600 text-white font-bold transition-all cursor-pointer">
                        Siguiente <ArrowRight size={18} className="inline ml-1" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Final details */}
                {formStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                    <h3 className="text-2xl font-black">Casi listo 🎉</h3>
                    <p className="text-white/50">¿Cómo te enteraste de Rabbitty? ¿Algo más que quieras agregar?</p>
                    <input type="text" placeholder="¿Cómo nos conociste?" value={formData.como_supo} onChange={(e) => handleFormChange('como_supo', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 transition-all" />
                    <textarea placeholder="Mensaje o comentario adicional..." value={formData.mensaje} onChange={(e) => handleFormChange('mensaje', e.target.value)} rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 transition-all resize-none" />
                    <p className="text-[10px] text-white/30 leading-relaxed">Al enviar aceptas que Rabbitty te contacte por WhatsApp, teléfono o correo para dar seguimiento a tu solicitud.</p>
                    <div className="flex justify-between">
                      <button onClick={() => setFormStep(2)} className="text-white/50 hover:text-white font-bold transition-all cursor-pointer">← Atrás</button>
                      <button onClick={handleFormSubmit} disabled={!formData.negocio || submitting}
                        className="px-8 py-3 rounded-full bg-linear-to-r from-green-500 to-blue-600 text-white font-bold hover:scale-105 transition-all cursor-pointer disabled:opacity-30">
                        {submitting ? 'Enviando…' : 'Enviar Solicitud 🚀'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center space-y-6">
                <div className="text-6xl">🎉</div>
                <h3 className="text-3xl font-black">¡Solicitud Registrada!</h3>
                <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
                  Tu negocio <strong>{`"${formData.negocio}"`}</strong> y paquete <strong>{`"${formData.packageName || formData.paquete || 'Personalizado'}"`}</strong> han sido registrados en la red Rabbitty.
                </p>
                <div className="pt-2 flex flex-col gap-3">
                  <a
                    href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(
                      `solicitud_${(formData.negocio || 'negocio').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => fireConversion('Contact', { niche: formData.nicheId, package: formData.packageCode, channel: 'telegram' })}
                    className="w-full py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm transition-all shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 no-underline cursor-pointer"
                  >
                    <span>✈️</span>
                    <span>Agilizar por Telegram Bot</span>
                  </a>

                  {/* Configuración de WhatsApp preservada para activación futura cuando se adquiera número comercial */}
                  {WHATSAPP_NUMBER && WHATSAPP_NUMBER !== '5213312345678' && (
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                        `¡Hola Rabbitty! Acabo de registrar a "${formData.negocio}" desde la web para el paquete "${formData.packageName || formData.paquete || 'Personalizado'}". Me gustaría agendar mi deploy demo.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => fireConversion('Contact', { niche: formData.nicheId, package: formData.packageCode, channel: 'whatsapp' })}
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 no-underline cursor-pointer"
                    >
                      <span>💬</span>
                      <span>Agilizar por WhatsApp Directo</span>
                    </a>
                  )}

                  <button onClick={resetForm} className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white font-bold text-xs transition-all cursor-pointer border-none">
                    Cerrar
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showBunzGuide && <BunzGuide onClose={() => setShowBunzGuide(false)} />}
      {showSmartContractModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
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
