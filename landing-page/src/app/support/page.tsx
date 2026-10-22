'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  MessageCircle,
  Mail,
  HelpCircle,
  Sparkles,
  Send,
  ShieldCheck,
  Building2,
  Coins,
  QrCode,
  Lock,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bunzy' | 'user';
  text: string;
  time: string;
}

const FAQS = [
  {
    q: '¿Cómo funcionan los Bunz y dónde los uso?',
    a: 'Los Bunz son recompensas automáticas que recibes cada vez que consumes en cafeterías y restaurantes afiliados a Rabbitty. 1 Bunz equivale a valor utilizable en tus próximas cuentas.',
    icon: Coins,
  },
  {
    q: '¿Cómo muestro mi código en caja?',
    a: 'En la app, abre tu Rabbitty Code (botón "Ver QR" en la tarjeta de inicio) y enséñaselo al cajero o barista para que lo escanee con Rabbitty POS.',
    icon: QrCode,
  },
  {
    q: '¿Qué pasa si quiero eliminar mi cuenta?',
    a: 'Puedes solicitar la baja permanente desde Perfil > Eliminar Cuenta. Conforme a las reglas de lealtad, los Bunz no canjeados se ceden a la tesorería del protocolo y los datos personales se eliminan inmediatamente.',
    icon: Lock,
  },
  {
    q: '¿Cómo afilio mi restaurante o cafetería?',
    a: 'Puedes registrar tu negocio desde la app o escribirnos a afiliados@rabbitty.me para recibir la terminal Rabbitty POS en iPad y tu kit de carteles impresos.',
    icon: Building2,
  },
];

export default function SupportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bunzy',
      text: '¡Hola! 🐰 Soy Bunzy, el asistente de soporte de Rabbitty. ¿Tienes alguna duda sobre tus Bunz, pagos QR o cómo afiliar tu negocio?',
      time: 'Ahora',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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
        text: data.reply || 'Entendido. Si requieres más ayuda contáctanos por WhatsApp.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, bunzyMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bunzy',
          text: 'Tuve un pequeño problema de conexión, pero puedes escribirnos directamente a support@rabbitty.me.',
          time: 'Ahora',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070F] text-white selection:bg-[#E91E63] selection:text-white">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-[#E91E63]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-[#9C27B0]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="z-10 border-b border-white/10 backdrop-blur-xl bg-black/40 sticky top-0">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-semibold"
          >
            <ArrowLeft size={18} />
            <span>Volver al inicio</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Image src="/icon_ra.png" alt="Rabbitty" width={28} height={28} className="object-contain" />
            <span className="font-black tracking-tight text-white">Rabbitty Support</span>
            <span className="text-[11px] font-black uppercase tracking-wider bg-[#E91E63]/20 text-[#E91E63] px-2.5 py-0.5 rounded-full border border-[#E91E63]/30">
              Bunzy AI 24/7
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Hero Banner */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E91E63]/10 border border-[#E91E63]/30 text-xs font-bold text-[#E91E63] mb-4">
            <Sparkles size={14} />
            Centro de Ayuda & Asistencia Inteligente
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
            ¿En qué podemos ayudarte hoy?
          </h1>
          <p className="text-white/60 text-sm md:text-base leading-relaxed">
            Resuelve dudas sobre tus puntos Bunz, pagos en restaurantes, seguridad de tu billetera o habla directamente con Bunzy nuestro agente inteligente.
          </p>
        </div>

        {/* Grid: Bunzy Chatbot + Contact Channels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Bunzy Interactive Widget (7 cols) */}
          <div className="lg:col-span-7 bg-[#101018] border border-white/10 rounded-3xl p-6 flex flex-col h-130 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-[#E91E63] to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-[#E91E63]/20">
                  🐰
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>Bunzy Asistente</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </h3>
                  <p className="text-[11px] text-white/50">Soporte instantáneo oficial Rabbitty</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-white/60">
                IA Activa
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin">
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
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed ${
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
            <div className="flex gap-2 py-2 overflow-x-auto text-[11px] no-scrollbar">
              <button
                type="button"
                onClick={() => handleSend('¿Qué son los Bunz?')}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors"
              >
                🪙 ¿Qué son los Bunz?
              </button>
              <button
                type="button"
                onClick={() => handleSend('¿Cómo elimino mi cuenta?')}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors"
              >
                🔒 Eliminar cuenta
              </button>
              <button
                type="button"
                onClick={() => handleSend('¿Cómo afilio mi restaurante?')}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors"
              >
                🏢 Afiliar negocio
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="pt-2 flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregúntale a Bunzy sobre soporte o tu cuenta..."
                className="flex-1 bg-white/5 border border-white/15 focus:border-[#E91E63] rounded-2xl px-4 py-2.5 text-xs md:text-sm text-white placeholder-white/30 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-[#E91E63] hover:bg-[#d81558] disabled:opacity-40 rounded-2xl text-white font-bold text-xs flex items-center justify-center transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </div>

          {/* Contact Direct Channels (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="p-6 rounded-3xl bg-[#101018] border border-white/10">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
                <MessageCircle size={22} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">WhatsApp de Atención Inmediata</h3>
              <p className="text-xs text-white/60 leading-relaxed mb-4">
                Para resolver temas de tickets en caja, aclaraciones de saldo o registro de comercio con un agente humano.
              </p>
              <a
                href="https://wa.me/529581000000?text=Hola%20equipo%20Rabbitty,%20necesito%20asistencia%20con%20mi%20cuenta"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs hover:bg-emerald-400 transition-colors"
              >
                <span>Chatear por WhatsApp</span>
              </a>
            </div>

            <div className="p-6 rounded-3xl bg-[#101018] border border-white/10">
              <div className="w-10 h-10 rounded-2xl bg-[#E91E63]/15 text-[#E91E63] flex items-center justify-center mb-4">
                <Mail size={22} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Correo Electrónico de Soporte</h3>
              <p className="text-xs text-white/60 leading-relaxed mb-3">
                Para consultas de privacidad, auditoría de transacciones o solicitudes institucionales:
              </p>
              <a
                href="mailto:support@rabbitty.me"
                className="text-sm font-mono font-bold text-[#E91E63] hover:underline"
              >
                support@rabbitty.me
              </a>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <ShieldCheck size={20} className="text-[#E91E63] shrink-0" />
              <p className="text-[11px] text-white/70 leading-normal m-0">
                Horario de atención humana: <strong>Lunes a Domingo de 8:00 AM a 10:00 PM</strong> (Hora CDMX).
              </p>
            </div>
          </div>
        </div>

        {/* FAQs Accordion / Cards */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle size={20} className="text-[#E91E63]" />
            <h2 className="text-xl font-black text-white m-0">Preguntas Frecuentes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAQS.map((faq) => {
              const Icon = faq.icon;
              return (
                <div
                  key={faq.q}
                  className="p-5 rounded-2xl bg-[#101018] border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[#E91E63]">
                      <Icon size={16} />
                    </div>
                    <h4 className="font-bold text-sm text-white">{faq.q}</h4>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed m-0 pl-9.5">{faq.a}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
