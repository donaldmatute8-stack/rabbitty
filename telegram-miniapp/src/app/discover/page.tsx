'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';

const CHATS = [
  { 
    id: '1', 
    name: 'RabbitBot', 
    message: '¡Hola! Soy tu asistente. ¿En qué te ayudo?', 
    time: 'Ahora', 
    unread: 2, 
    pinned: true,
    avatar: '🐰',
    color: '#E91E63',
    href: '/bot'
  },
  { 
    id: '2', 
    name: 'Café Cultura', 
    message: 'Tu reserva para hoy a las 5:00 PM está confirmada.', 
    time: '12:30', 
    unread: 0, 
    pinned: false,
    avatar: '☕',
    color: '#111111',
    href: '#'
  },
  { 
    id: '3', 
    name: 'Soporte Rabbitty', 
    message: 'Hemos resuelto tu duda sobre los bunz.', 
    time: 'Ayer', 
    unread: 0, 
    pinned: false,
    avatar: '🎧',
    color: '#2196F3',
    href: '#'
  },
  { 
    id: '4', 
    name: 'Gimnasio Power', 
    message: 'No olvides tu clase de funcional mañana.', 
    time: 'Lun', 
    unread: 0, 
    pinned: false,
    avatar: '💪',
    color: '#4CAF50',
    href: '#'
  }
];

export default function MessagesPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="page-wrap pb-28 bg-white" style={{ fontFamily: "var(--font-family-base)" }}>
      {/* Messages Header */}
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-[28px] font-[800] text-[#111] tracking-[-0.5px] m-0">Mensajes</h1>
          <button className="w-10 h-10 rounded-full bg-[#F4F4F4] border-0 flex items-center justify-center cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17A8 8 0 109 1a8 8 0 000 16zM18 18l-4.35-4.35" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto bg-white pl-4 pr-4">
        
        <div className="flex flex-col">
          {CHATS.map((chat, i) => (
            <motion.a 
              href={chat.href}
              key={chat.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ 
                borderBottom: i < CHATS.length - 1 ? "1px solid #F4F4F4" : "none",
                backgroundColor: chat.pinned ? "#FFF0F5" : "transparent",
                marginLeft: chat.pinned ? -16 : 0,
                marginRight: chat.pinned ? -16 : 0,
                paddingLeft: chat.pinned ? 16 : 0,
                paddingRight: chat.pinned ? 16 : 0,
              }}
              className="flex items-center gap-3.5 pt-4 pb-4 no-underline cursor-pointer active:opacity-70 transition-opacity"
            >
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-[28px] shrink-0 relative" style={{ backgroundColor: chat.color }}>
                {chat.avatar}
                {chat.pinned && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L8 5L12 6L9 9L10 13L6 11L2 13L3 9L0 6L4 5L6 1Z" fill="#C8A830"/></svg>
                  </div>
                )}
              </div>
              
              {/* Message Content */}
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-base font-[800] text-[#111] m-0 whitespace-nowrap overflow-hidden text-ellipsis">{chat.name}</p>
                  <p className="m-0 shrink-0 text-[12px]" style={{ fontWeight: chat.unread > 0 ? 700 : 500, color: chat.unread > 0 ? "#E91E63" : "#AAA" }}>{chat.time}</p>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm m-0 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: chat.unread > 0 ? "#111" : "#888", fontWeight: chat.unread > 0 ? 500 : 400 }}>
                    {chat.message}
                  </p>
                  {chat.unread > 0 && (
                    <div className="w-[22px] h-[22px] rounded-full bg-[#E91E63] flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-[700] text-white">{chat.unread}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.a>
          ))}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
