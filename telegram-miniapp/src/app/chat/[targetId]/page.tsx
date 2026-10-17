'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';

interface BusinessCard {
  businessId: string;
  businessName: string;
  category?: string;
  address?: string;
  rewardPercentage?: number;
  acceptsBunz?: boolean;
  logoUrl?: string | null;
}

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  type?: string;
  metadata?: BusinessCard | null;
  readAt?: string | null;
};

interface HistoryResponse {
  success?: boolean;
  conversationId?: string;
  myParticipantId?: string;
  isBusinessInbox?: boolean;
  targetName?: string;
  targetAvatar?: string | null;
  businessOpen?: boolean | null;
  otherTypingAt?: string | null;
  messages?: Message[];
}

interface SendResponse {
  success?: boolean;
  message?: Message;
  botResponse?: Message;
  autoReply?: Message | null;
  suggestions?: string[];
}

const BUSINESS_TEMPLATES = ['¿A qué hora abren?', '📍 Ubicación exacta', 'Ver menú', '¿Tienen lugar?'];
const TYPING_WINDOW_MS = 5000;

function CheckTicks({ read }: { read: boolean }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M1 6L4 9L10 2" stroke={read ? '#4FC3F7' : 'rgba(255,255,255,0.75)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {read && <path d="M6 6L9 9L15 2" stroke="#4FC3F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { targetId } = useParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [isBusinessInbox, setIsBusinessInbox] = useState(false);
  const [businessOpen, setBusinessOpen] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [targetName, setTargetName] = useState('...');
  const [targetAvatar, setTargetAvatar] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const otherTypingAtRef = useRef<string | null>(null);
  const typingCooldownRef = useRef(0);
  const tempCounterRef = useRef(0);

  const isBot = targetId === 'bot';

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    if (!currentUserId) return;

    const urlConversationId = new URLSearchParams(window.location.search).get('c');

    const buildUrl = () => {
      const id = conversationIdRef.current || urlConversationId;
      return id
        ? `/api/chat/history?conversationId=${encodeURIComponent(id)}`
        : `/api/chat/history?targetId=${encodeURIComponent(String(targetId))}`;
    };

    const apply = (data: HistoryResponse) => {
      if (!data.success) return;
      if (data.conversationId) {
        conversationIdRef.current = data.conversationId;
        setConversationId(data.conversationId);
      }
      if (data.myParticipantId) setMyParticipantId(data.myParticipantId);
      if (typeof data.isBusinessInbox === 'boolean') setIsBusinessInbox(data.isBusinessInbox);
      if (data.targetName) setTargetName(data.targetName);
      if (data.targetAvatar !== undefined) setTargetAvatar(data.targetAvatar);
      if (data.businessOpen !== undefined) setBusinessOpen(data.businessOpen);
      otherTypingAtRef.current = data.otherTypingAt ?? null;
      setMessages(data.messages || []);
    };

    const fetchHistory = async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(buildUrl(), { headers });
        apply(await res.json());
      } catch (err) {
        console.error('Error cargando chat', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    const interval = setInterval(async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(buildUrl(), { headers });
        apply(await res.json());
      } catch {
        /* ignore */
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user, targetId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const at = otherTypingAtRef.current;
      setShowTyping(Boolean(at) && Date.now() - Date.parse(at as string) < TYPING_WINDOW_MS);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, showTyping]);

  const signalTyping = () => {
    if (isBot) return;
    const id = conversationIdRef.current;
    if (!id) return;
    const now = Date.now();
    if (now - typingCooldownRef.current < 2500) return;
    typingCooldownRef.current = now;
    PlatformBridge.getAuthHeaders()
      .then((headers) =>
        fetch('/api/chat/typing', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: id }),
        }),
      )
      .catch(() => {});
  };

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 6000 },
    );
  };

  const sendMessage = async (raw: string, explicitCoords?: { lat: number; lng: number } | null) => {
    const content = raw.trim();
    if (!content || !conversationId || !user || sending) return;

    if (/usar mi ubicacion|compartir ubicacion/i.test(content) && !coords && !explicitCoords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(newCoords);
          sendMessage('Usar mi ubicación', newCoords);
        },
        () => {
          // Si no dio permiso o falló, enviar de todos modos
          sendMessage('Ver todos los comercios');
        },
        { timeout: 6000 }
      );
      return;
    }

    setInput('');
    setSuggestions([]);
    setSending(true);

    tempCounterRef.current += 1;
    const tempId = `temp-${tempCounterRef.current}`;
    const optimistic: Message = {
      id: tempId,
      senderId: myParticipantId || user.id,
      content,
      createdAt: new Date().toISOString(),
      type: 'TEXT',
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetId,
          content,
          lat: explicitCoords?.lat ?? coords?.lat ?? null,
          lng: explicitCoords?.lng ?? coords?.lng ?? null,
        }),
      });
      const data: SendResponse = await res.json();
      if (data.success) {
        setMessages((prev) => {
          const replaced = prev.map((m) => (m.id === tempId && data.message ? data.message : m));
          const extra: Message[] = [];
          if (data.botResponse) extra.push(data.botResponse);
          if (data.autoReply) extra.push(data.autoReply);
          return [...replaced, ...extra];
        });
        if (data.suggestions?.length) setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error enviando', err);
    } finally {
      setSending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const renderContent = (msg: Message) => {
    const card: BusinessCard | null =
      msg.metadata && typeof msg.metadata === 'object' && 'businessId' in msg.metadata ? msg.metadata : null;
    const legacy = /\[COMERCIO_ACTION id="([^"]+)" name="([^"]+)"\]/.exec(msg.content);
    const cleanText = msg.content.replace(/\[COMERCIO_ACTION id="[^"]+" name="[^"]+"\]/g, '').trim();

    const target = card
      ? { id: card.businessId, name: card.businessName, meta: card }
      : legacy
        ? { id: legacy[1], name: legacy[2], meta: null }
        : null;

    return (
      <>
        {cleanText && (
          <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanText}</p>
        )}

        {target && (
          <div
            style={{
              marginTop: cleanText ? '10px' : 0,
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-pressed)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#E91E63',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {target.meta?.logoUrl ? (
                  <img src={target.meta.logoUrl} alt={target.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '18px' }}>🏪</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>{target.name}</p>
                {target.meta && (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {[target.meta.category, target.meta.address].filter(Boolean).join(' · ')}
                  </p>
                )}
                {target.meta?.rewardPercentage != null && (
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#E91E63' }}>
                    🎁 +{target.meta.rewardPercentage}% en bunz
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                router.push(`/chat/${target.id}`);
              }}
              style={{
                width: '100%',
                border: 'none',
                background: '#E91E63',
                color: '#FFF',
                fontWeight: 800,
                fontSize: '13px',
                padding: '11px',
                cursor: 'pointer',
              }}
            >
              💬 Chatear con {target.name}
            </button>
          </div>
        )}
      </>
    );
  };

  const headerStatus = isBot ? 'Bunzy IA en línea' : businessOpen === false ? 'Fuera de horario' : 'En línea';
  const headerColor = isBot || businessOpen !== false ? '#4CAF50' : '#9E9E9E';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)', fontFamily: 'var(--font-family-base)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          padding: 'calc(max(env(safe-area-inset-top), 84px) + 8px) 20px 16px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '16px',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 8px 8px 0', color: 'var(--text-primary)' }}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: isBot ? 'var(--rabbitty-pink)' : 'var(--bg-pressed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 10px rgba(233, 30, 99, 0.2)',
              overflow: 'hidden',
            }}
          >
            {isBot ? (
              '🐰'
            ) : targetAvatar ? (
              <img src={targetAvatar} alt={targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              '💬'
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              {targetName}
            </h2>
            <span style={{ fontSize: '13px', color: headerColor, fontWeight: 600 }}>
              {showTyping && !isBot ? 'escribiendo…' : headerStatus}
            </span>
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '3px solid rgba(233,30,99,0.2)',
                borderTopColor: 'var(--rabbitty-pink)',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === myParticipantId;
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id || idx}
                style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%' }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    backgroundColor: isMe ? 'var(--rabbitty-pink)' : 'var(--bg-elevated)',
                    color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                    borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    boxShadow: 'var(--shadow-sm)',
                    border: isMe ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  {msg.type === 'AUTO_REPLY' && (
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      Respuesta automática
                    </span>
                  )}
                  {renderContent(msg)}
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      marginTop: '6px',
                      opacity: isMe ? 0.85 : 0.5,
                      textAlign: isMe ? 'right' : 'left',
                      fontWeight: 500,
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && !isBot && (
                      <span style={{ marginLeft: '4px' }}>
                        <CheckTicks read={Boolean(msg.readAt)} />
                      </span>
                    )}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}

        {(sending && isBot) || showTyping ? (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '20px 20px 20px 4px',
                padding: '14px 18px',
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--rabbitty-pink)' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--rabbitty-pink)', animationDelay: '0.1s' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--rabbitty-pink)', animationDelay: '0.2s' }} />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </main>

      <footer
        style={{
          padding: '14px 18px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 14px)',
          backgroundColor: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {(suggestions.length > 0 || isBusinessInbox) && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px' }}>
            {(isBusinessInbox ? BUSINESS_TEMPLATES : suggestions).map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  if (isBusinessInbox) setInput(chip);
                  else sendMessage(chip);
                }}
                style={{
                  flexShrink: 0,
                  background: 'var(--bg-pressed)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '100px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isBot && (
            <button
              type="button"
              onClick={requestLocation}
              title="Compartir ubicación"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: 'none',
                background: coords ? 'rgba(233,30,99,0.15)' : 'var(--bg-pressed)',
                color: coords ? '#E91E63' : 'var(--text-muted)',
                fontSize: '18px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              📍
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              signalTyping();
            }}
            placeholder={isBot ? 'Pregúntale a Bunzy...' : isBusinessInbox ? 'Responde a tu cliente...' : 'Escribe un mensaje...'}
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
            onFocus={(e) => (e.target.style.borderColor = 'var(--rabbitty-pink)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: !input.trim() || sending ? 'var(--bg-pressed)' : 'var(--rabbitty-pink)',
              color: !input.trim() || sending ? 'var(--text-muted)' : '#FFFFFF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: !input.trim() || sending ? 'none' : '0 4px 12px rgba(233, 30, 99, 0.35)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px) translateY(1px)' }}>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
