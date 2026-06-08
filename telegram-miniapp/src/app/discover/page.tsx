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
        <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0 }}>Mensajes</h1>
          <button style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#F4F4F4", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17A8 8 0 109 1a8 8 0 000 16zM18 18l-4.35-4.35" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto" style={{ backgroundColor: '#FFFFFF', paddingLeft: 16, paddingRight: 16 }}>
        
        <div style={{ display: "flex", flexDirection: "column" }}>
          {CHATS.map((chat, i) => (
            <motion.a 
              href={chat.href}
              key={chat.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 14, 
                paddingTop: 16, 
                paddingBottom: 16, 
                borderBottom: i < CHATS.length - 1 ? "1px solid #F4F4F4" : "none",
                textDecoration: "none",
                cursor: "pointer",
                backgroundColor: chat.pinned ? "#FFF0F5" : "transparent",
                marginLeft: chat.pinned ? -16 : 0,
                marginRight: chat.pinned ? -16 : 0,
                paddingLeft: chat.pinned ? 16 : 0,
                paddingRight: chat.pinned ? 16 : 0,
              }}
              className="active:opacity-70 transition-opacity"
            >
              {/* Avatar */}
              <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: chat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, position: "relative" }}>
                {chat.avatar}
                {chat.pinned && (
                  <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, backgroundColor: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L8 5L12 6L9 9L10 13L6 11L2 13L3 9L0 6L4 5L6 1Z" fill="#C8A830"/></svg>
                  </div>
                )}
              </div>
              
              {/* Message Content */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chat.name}</p>
                  <p style={{ fontSize: 12, fontWeight: chat.unread > 0 ? 700 : 500, color: chat.unread > 0 ? "#E91E63" : "#AAA", margin: 0, flexShrink: 0 }}>{chat.time}</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: 14, color: chat.unread > 0 ? "#111" : "#888", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: chat.unread > 0 ? 500 : 400 }}>
                    {chat.message}
                  </p>
                  {chat.unread > 0 && (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#E91E63", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{chat.unread}</span>
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
