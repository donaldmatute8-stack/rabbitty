'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { targetId } = useParams();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [targetName, setTargetName] = useState('...');
  const [targetAvatar, setTargetAvatar] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isBot = targetId === 'bot';

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    if (!currentUserId) return;
    
    // Fetch History
    const fetchHistory = async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/chat/history?targetId=${encodeURIComponent(String(targetId))}`, { headers });
        const data = await res.json();
        if (data.success) {
          setConversationId(data.conversationId);
          setMessages(data.messages || []);
          if (data.targetName) setTargetName(data.targetName);
          if (data.targetAvatar) setTargetAvatar(data.targetAvatar);
        }
      } catch (err) {
        console.error("Error cargando chat", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();

    // Polling for real-time updates (MVP)
    const interval = setInterval(async () => {
      const headers = await PlatformBridge.getAuthHeaders();
      fetch(`/api/chat/history?targetId=${encodeURIComponent(String(targetId))}`, { headers })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.messages) {
            setMessages(data.messages);
          }
        }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [user, targetId]);

  useEffect(() => {
    // Scroll to bottom
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId || !user) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    // Add optimistic message
    const optimisticMsg: Message = {
      id: Date.now().toString(),
      senderId: user.id,
      content,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetId,
          content
        })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.botResponse) {
          setMessages(prev => [...prev, data.botResponse]);
        }
      }
    } catch (err) {
      console.error("Error enviando", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)', fontFamily: 'var(--font-family-base)' }}>
      
      {/* Header Fijo */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        padding: 'calc(max(env(safe-area-inset-top), 84px) + 8px) 20px 16px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        gap: '16px'
      }}>
        <button 
          onClick={() => router.back()} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 8px 8px 0', color: 'var(--text-primary)' }}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: isBot ? 'var(--rabbitty-pink)' : 'var(--bg-pressed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 10px rgba(233, 30, 99, 0.2)',
            overflow: 'hidden'
          }}>
            {isBot ? '🐰' : (
              targetAvatar ? <img src={targetAvatar} alt={targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              {targetName}
            </h2>
            <span style={{ fontSize: '13px', color: '#4CAF50', fontWeight: 600 }}>
              {isBot ? 'Bunzy IA en línea' : 'En línea'}
            </span>
          </div>
        </div>
      </header>

      {/* Área de Mensajes */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '3px solid rgba(233,30,99,0.2)',
              borderTopColor: 'var(--rabbitty-pink)',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.id;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id || idx} 
                style={{
                  display: 'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  backgroundColor: isMe ? 'var(--rabbitty-pink)' : 'var(--bg-elevated)',
                  color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                  borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  boxShadow: 'var(--shadow-sm)',
                  border: isMe ? 'none' : '1px solid var(--border-subtle)'
                }}>
                  <p style={{ 
                    fontSize: '15px', 
                    lineHeight: '1.5', 
                    margin: 0,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.content}
                  </p>
                  <span style={{
                    display: 'block',
                    fontSize: '11px',
                    marginTop: '6px',
                    opacity: isMe ? 0.8 : 0.5,
                    textAlign: isMe ? 'right' : 'left',
                    fontWeight: 500
                  }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
        {sending && isBot && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '20px 20px 20px 4px',
              padding: '14px 18px',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border-subtle)'
            }}>
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--rabbitty-pink)' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--rabbitty-pink)', animationDelay: '0.1s' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--rabbitty-pink)', animationDelay: '0.2s' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Input de Texto */}
      <footer style={{
        padding: '14px 18px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 14px)',
        backgroundColor: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale a Bunzy o escribe un mensaje..."
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-pressed)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '100px',
              padding: '12px 18px',
              fontSize: '15px',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--rabbitty-pink)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || sending}
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: (!input.trim() || sending) ? 'var(--bg-pressed)' : 'var(--rabbitty-pink)',
              color: (!input.trim() || sending) ? 'var(--text-muted)' : '#FFFFFF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: (!input.trim() || sending) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: (!input.trim() || sending) ? 'none' : '0 4px 12px rgba(233, 30, 99, 0.35)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px) translateY(1px)' }}>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
