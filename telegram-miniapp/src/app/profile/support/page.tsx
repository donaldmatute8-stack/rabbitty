'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { Send, MessageCircleQuestion, HelpCircle, AlertCircle } from 'lucide-react';

const FAQS = [
  {
    q: "¿Cómo gano Bunz?",
    a: "Ve a la página principal y presiona 'Escanear'. Si estás en un negocio afiliado y escaneas tu ticket de consumo, ganarás Bunz automáticamente según su porcentaje de recompensa."
  },
  {
    q: "¿Qué son los Bunz pendientes?",
    a: "Cuando invitas a un amigo, recibes 50 Bunz en estado 'Pendiente'. Para poder gastarlos, necesitas subir de nivel realizando consumos en negocios locales."
  },
  {
    q: "¿Cómo gasto mis Bunz?",
    a: "En la pestaña 'Stock' de la pantalla principal verás certificados y ofertas. Si tienes suficientes Bunz, dale a 'Adquirir' y se guardarán en tu Inventario."
  },
  {
    q: "¿Cómo funciona la reserva?",
    a: "Si ves un negocio en el mapa y quieres ir a gastar tus Bunz ahí, puedes 'Reservar Visita'. Esto apartará parte de su límite diario para asegurar que te los acepten cuando llegues."
  }
];

export default function SupportPage() {
  const handleSupportClick = () => {
    // Open Telegram chat with the admin/bot
    // @ts-ignore
    if (window.Telegram?.WebApp?.openTelegramLink) {
      // @ts-ignore
      window.Telegram.WebApp.openTelegramLink('https://t.me/RabbittySupportBot');
    } else {
      window.open('https://t.me/RabbittySupportBot', '_blank');
    }
  };

  return (
    <ProfileSubpageLayout title="Ayuda y Soporte">
      <div className="flex flex-col gap-6 mt-4">
        
        {/* Support Button */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white text-center shadow-lg relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] opacity-10">
            <MessageCircleQuestion className="w-40 h-40" />
          </div>
          <h2 className="text-xl font-black mb-2 relative z-10">¿Necesitas ayuda humana?</h2>
          <p className="text-blue-100 text-sm mb-6 relative z-10">
            Estamos disponibles 24/7. Escríbenos directamente por Telegram y un agente (¡o yo!) te responderá al instante.
          </p>
          <button 
            onClick={handleSupportClick}
            className="w-full bg-white text-blue-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform relative z-10"
          >
            <Send className="w-5 h-5" />
            Contactar por Telegram
          </button>
        </div>

        {/* FAQs */}
        <div>
          <div className="flex items-center gap-2 mb-4 px-1">
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-900">Preguntas Frecuentes</h3>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {FAQS.map((faq, i) => (
              <div key={i} className={`p-5 ${i !== FAQS.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <h4 className="font-bold text-gray-900 text-sm mb-2">{faq.q}</h4>
                <p className="text-gray-500 text-[13px] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 bg-pink-50 p-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
          <p className="text-xs text-pink-700 leading-relaxed">
            Las transacciones de la plataforma son finales. Si tuviste un problema con un negocio al escanear, incluye el nombre del local en tu mensaje de soporte.
          </p>
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
