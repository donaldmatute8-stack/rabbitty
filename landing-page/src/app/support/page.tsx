'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Mail,
  HelpCircle,
  Sparkles,
  Send,
  ShieldCheck,
  Building2,
  Coins,
  QrCode,
  Lock,
  SendHorizontal,
  X,
  CreditCard,
  Gift,
  Smartphone,
  ChevronDown,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bunzy' | 'user';
  text: string;
  time: string;
}

const EXTENDED_FAQS = [
  {
    category: 'Recompensas & Bunz',
    q: '¿Cómo funcionan los Bunz y dónde los uso?',
    a: 'Los Bunz son recompensas automáticas que recibes cada vez que consumes en cafeterías y restaurantes afiliados a Rabbitty. Cada Bunz equivale a saldo utilizable para pagar cuentas futuras, invitar rondas a tus amigos o acceder a promociones exclusivas.',
    icon: Coins,
  },
  {
    category: 'Pagos en Caja',
    q: '¿Cómo muestro mi código en caja?',
    a: 'En la app Rabbitty, presiona tu Rabbitty Code (botón "Ver QR" en la tarjeta de inicio) y enséñaselo al cajero o barista para que lo escanee con la cámara de Rabbitty POS.',
    icon: QrCode,
  },
  {
    category: 'Seguridad & Privacidad',
    q: '¿Qué pasa si quiero eliminar mi cuenta?',
    a: 'Puedes solicitar la baja permanente desde Perfil > Configuración > Eliminar cuenta. Por normativas legales, los Bunz no canjeados se ceden a la tesorería del protocolo y los datos personales se expurgan, emitiendo un comprobante contable en el nodo IPFS de Pandoras Finance.',
    icon: Lock,
  },
  {
    category: 'Comercios',
    q: '¿Cómo afilio mi restaurante o cafetería?',
    a: 'Puedes registrar tu negocio desde el portal de afiliados en https://rabbitty.me/affiliates o contactar al equipo en Telegram @rabbittyhub para recibir la terminal Rabbitty POS en iPad y tu kit de carteles impresos.',
    icon: Building2,
  },
  {
    category: 'Transferencias',
    q: '¿Puedo transferir Bunz a otros usuarios?',
    a: '¡Sí! Dentro de la sección Billetera > Transferir, puedes enviar Bunz al instante a cualquier Rabbitter usando su @usuario o escaneando su código personal con confirmación por Face ID o PIN.',
    icon: CreditCard,
  },
  {
    category: 'Vigencia',
    q: '¿Los Bunz tienen fecha de expiración?',
    a: 'Tus Bunz acumulados en una cuenta activa de Rabbitty nunca caducan. Si recibiste Bunz a tu número telefónico antes de tener cuenta, dispones de 90 días para registrarte y reclamarlos en tu billetera.',
    icon: Gift,
  },
  {
    category: 'App Móvil',
    q: '¿Dónde descargo la app oficial?',
    a: 'Rabbitty está disponible para iPhone en TestFlight / App Store en https://rabbitty.me/download, y también puedes acceder instantáneamente sin instalación desde la Web App en https://app.rabbitty.me.',
    icon: Smartphone,
  },
  {
    category: 'Atención Humana',
    q: '¿Cómo hablo con un agente de soporte?',
    a: 'Nuestro equipo de asistencia en vivo te atiende por Telegram en @rabbittyhub de lunes a domingo de 8:00 AM a 10:00 PM (Hora CDMX). También puedes escribirnos a support@rabbitty.me.',
    icon: SendHorizontal,
  },
];

export default function SupportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bunzy',
      text: '¡Hola! 🐰 Soy Bunzy, tu asistente inteligente de soporte en Rabbitty. ¿En qué te puedo orientar hoy? Puedes preguntarme sobre tus Bunz, pagos con QR, comercios afiliados o cómo eliminar tu cuenta.',
      time: 'Ahora',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/support/bunzy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();

      const bunzyMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bunzy',
        text: data.reply || 'Entendido. Si requieres atención personalizada, escríbenos a @rabbittyhub en Telegram.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, bunzyMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bunzy',
          text: 'Tuve un pequeño problema de conexión, pero puedes contactarnos directamente en Telegram @rabbittyhub o a support@rabbitty.me.',
          time: 'Ahora',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Componente del Chat de Bunzy reutilizable
  const renderBunzyChatContent = () => (
    <div className="flex flex-col h-full">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs md:text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bunzy' && (
              <div className="w-7 h-7 rounded-full bg-[#E91E63]/20 border border-[#E91E63]/40 flex items-center justify-center text-xs shrink-0">
                🐰
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed whitespace-pre-line ${
                m.sender === 'user'
                  ? 'bg-[#E91E63] text-white font-medium'
                  : 'bg-white/5 border border-white/10 text-white/90'
              }`}
            >
              {m.text}
              <span className="block text-[10px] text-white/40 mt-1 text-right">{m.time}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 items-center text-xs text-white/50 bg-white/5 w-fit px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-[#E91E63] rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-[#E91E63] rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-[#E91E63] rounded-full animate-bounce [animation-delay:0.4s]" />
            <span>Bunzy está escribiendo...</span>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="flex gap-1.5 py-2.5 overflow-x-auto text-[11px] no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => handleSend('¿Qué son los Bunz?')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
        >
          🪙 ¿Qué son los Bunz?
        </button>
        <button
          type="button"
          onClick={() => handleSend('¿Cómo elimino mi cuenta?')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
        >
          🔒 Eliminar cuenta
        </button>
        <button
          type="button"
          onClick={() => handleSend('¿Cómo afilio mi restaurante?')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
        >
          🏢 Afiliar negocio
        </button>
        <button
          type="button"
          onClick={() => handleSend('¿Cómo contacto a un agente humano?')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
        >
          💬 Soporte humano
        </button>
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-1 flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu consulta para Bunzy..."
          className="flex-1 bg-white/5 border border-white/15 focus:border-[#E91E63] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-white/30 outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-[#E91E63] hover:bg-[#d81558] disabled:opacity-40 rounded-2xl text-white font-bold text-xs flex items-center justify-center transition-colors"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07070F] text-white selection:bg-[#E91E63] selection:text-white">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#E91E63]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-[#9C27B0]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="z-30 border-b border-white/10 backdrop-blur-xl bg-black/40 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-semibold"
          >
            <ArrowLeft size={18} />
            <span>Volver al inicio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Image src="/icon_ra.png" alt="Rabbitty" width={28} height={28} className="object-contain" />
            <span className="font-black tracking-tight text-white hidden sm:inline">Rabbitty Support</span>
            <span className="text-[11px] font-black uppercase tracking-wider bg-[#E91E63]/20 text-[#E91E63] px-2.5 py-0.5 rounded-full border border-[#E91E63]/30">
              Bunzy AI Activo
            </span>
          </div>
        </div>
      </header>

      {/* Main Two-Column Layout (Centro Contenido + Sidebar Fijo en Desktop) */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Columna Principal: Hero, Contact Channels & Extended FAQs (7 cols en Desktop) */}
          <div className="lg:col-span-7 space-y-10">
            {/* Hero */}
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E91E63]/10 border border-[#E91E63]/30 text-xs font-bold text-[#E91E63] mb-4">
                <Sparkles size={14} />
                Centro de Ayuda & Asistencia Oficial
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
                ¿En qué podemos ayudarte hoy?
              </h1>
              <p className="text-white/60 text-sm md:text-base leading-relaxed">
                Resuelve dudas sobre tus puntos Bunz, pagos en restaurantes afiliados, seguridad o chatea directamente con Bunzy en tiempo real.
              </p>
            </div>

            {/* Canales Directos de Atención Humana */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Telegram Support (@rabbittyhub) */}
              <div className="p-6 rounded-3xl bg-[#101018] border border-[#229ED9]/30 hover:border-[#229ED9]/60 transition-colors flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-[#229ED9]/15 text-[#229ED9] flex items-center justify-center mb-4">
                    <SendHorizontal size={22} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Telegram de Soporte</h3>
                  <p className="text-xs text-white/60 leading-relaxed mb-4">
                    Canal oficial para aclaraciones de tickets, asistencia en caja o contacto con un agente humano.
                  </p>
                </div>
                <a
                  href="https://t.me/rabbittyhub"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#229ED9] text-white font-extrabold text-xs hover:bg-[#1f8ec4] transition-colors shadow-lg shadow-[#229ED9]/20"
                >
                  <span>Chatear en @rabbittyhub</span>
                </a>
              </div>

              {/* Email Support */}
              <div className="p-6 rounded-3xl bg-[#101018] border border-white/10 hover:border-white/20 transition-colors flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-[#E91E63]/15 text-[#E91E63] flex items-center justify-center mb-4">
                    <Mail size={22} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Correo Electrónico</h3>
                  <p className="text-xs text-white/60 leading-relaxed mb-4">
                    Para solicitudes de privacidad, auditorías de transacciones o consultas institucionales.
                  </p>
                </div>
                <a
                  href="mailto:support@rabbitty.me"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm font-mono font-bold text-[#E91E63] hover:bg-white/10 transition-colors"
                >
                  support@rabbitty.me
                </a>
              </div>
            </div>

            {/* Aviso de Horarios de Atención */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <ShieldCheck size={20} className="text-[#E91E63] shrink-0" />
              <p className="text-xs text-white/70 leading-normal m-0">
                Horario de soporte humano en Telegram: <strong>Lunes a Domingo de 8:00 AM a 10:00 PM</strong> (Hora CDMX). Bunzy AI responde 24/7.
              </p>
            </div>

            {/* Preguntas Frecuentes Extendidas (Acordeón Interactivo) */}
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-6">
                <HelpCircle size={22} className="text-[#E91E63]" />
                <h2 className="text-xl md:text-2xl font-black text-white m-0">Base de Conocimiento & Preguntas Frecuentes</h2>
              </div>

              <div className="space-y-3">
                {EXTENDED_FAQS.map((faq, idx) => {
                  const Icon = faq.icon;
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={faq.q}
                      className="rounded-2xl bg-[#101018] border border-white/10 hover:border-white/20 transition-all overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full p-4.5 flex items-center justify-between gap-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#E91E63]/10 border border-[#E91E63]/20 flex items-center justify-center text-[#E91E63] shrink-0">
                            <Icon size={16} />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#E91E63] tracking-wider block">
                              {faq.category}
                            </span>
                            <span className="font-bold text-sm text-white block">{faq.q}</span>
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`text-white/40 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-[#E91E63]' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-xs md:text-sm text-white/70 leading-relaxed border-t border-white/5">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Bunzy Sidebar Fijo en Desktop (5 cols) */}
          <div className="hidden lg:block lg:col-span-5 sticky top-28">
            <div className="bg-[#101018] border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col h-170">
              {/* Header de Bunzy */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-[#E91E63] to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-[#E91E63]/20">
                    🐰
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <span>Bunzy Asistente</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-[11px] text-white/50">Soporte Inteligente 24/7</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                  Online
                </span>
              </div>

              {/* Chat View */}
              {renderBunzyChatContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Bunzy Bubble */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setMobileChatOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-linear-to-r from-[#E91E63] to-purple-600 text-white font-extrabold text-xs shadow-2xl shadow-[#E91E63]/40 border border-white/20 active:scale-95 transition-all"
        >
          <span className="text-lg">🐰</span>
          <span>Chatear con Bunzy</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      {/* Mobile Sliding Bottom Sheet Panel */}
      {mobileChatOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div
            className="bg-[#101018] border-t border-white/15 rounded-t-3xl p-5 flex flex-col h-[82vh] shadow-2xl animate-in slide-in-from-bottom duration-300"
          >
            {/* Header Mobile */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-[#E91E63] to-purple-600 flex items-center justify-center text-lg">
                  🐰
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Bunzy Asistente</h3>
                  <p className="text-[10px] text-white/50">Soporte instantáneo oficial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Content */}
            {renderBunzyChatContent()}
          </div>
        </div>
      )}
    </div>
  );
}


