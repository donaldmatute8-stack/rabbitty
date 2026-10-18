'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { QRCodeSVG } from 'qrcode.react';

interface BusinessCard {
  kind?: 'BUSINESS';
  businessId: string;
  businessName: string;
  category?: string;
  address?: string;
  rewardPercentage?: number;
  acceptsBunz?: boolean;
  logoUrl?: string | null;
  lat?: number;
  lng?: number;
}

interface BusinessOption {
  businessId: string;
  businessName: string;
  category?: string;
  address?: string;
  distanceKm?: number | null;
  openNow?: boolean | null;
  rewardPercentage?: number;
  acceptsBunz?: boolean;
  logoUrl?: string | null;
  lat?: number;
  lng?: number;
}

interface OrderDraft {
  kind?: 'ORDER';
  orderId?: string;
  businessId: string;
  businessName: string;
  items: string[];
  notes?: string;
  status?: string;
}

interface TransferRequest {
  amount: number;
  recipient: string;
  note: string;
}

interface ReceiveQrRequest {
  handle: string;
}

type MessageMetadata =
  | BusinessCard
  | { kind: 'OPTIONS'; options: BusinessOption[] }
  | OrderDraft
  | { kind: 'LOCATION'; lat: number; lng: number; label?: string }
  | { kind: 'TRANSFER_REQUEST'; transferRequest: TransferRequest }
  | { kind: 'RECEIVE_QR'; receiveQr: ReceiveQrRequest };

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  type?: string;
  metadata?: MessageMetadata | null;
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

function previewMapTileUrl(lat: number, lng: number, dark: boolean, zoom = 16): string {  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return dark
    ? `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${zoom}/${y}/${x}`
    : `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

function cleanOrEmpty(text: string): string {
  return text.replace(/\[COMERCIO_ACTION id="[^"]+" name="[^"]+"\]/g, '').trim();
}

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
  const [orderTarget, setOrderTarget] = useState<{ businessId: string; businessName: string } | null>(null);
  const [orderItems, setOrderItems] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [bunzyOpen, setBunzyOpen] = useState(false);
  const [bunzyBusy, setBunzyBusy] = useState(false);
  const [bunzyIntent, setBunzyIntent] = useState('');
  const [bunzyNote, setBunzyNote] = useState<{ mode: 'draft' | 'summarize'; text: string } | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
    const urlPrefill = isBot ? new URLSearchParams(window.location.search).get('prefill') : null;
    let prefillApplied = false;

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

      if (urlPrefill && data.conversationId && !prefillApplied) {
        prefillApplied = true;
        setInput(urlPrefill);
      }
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

  const shareLocation = () => {
    if (!navigator.geolocation || !conversationId) return;
    PlatformBridge.hapticFeedback('light');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        sendMessage('📍 Ubicación compartida', c, 'LOCATION');
      },
      () => {},
      { timeout: 6000 },
    );
  };

  const sendMessage = async (
    raw: string,
    explicitCoords?: { lat: number; lng: number } | null,
    msgType?: string,
  ) => {
    const content = raw.trim();
    if (!content || !conversationId || !user || sending) return;

    const isLoc = msgType === 'LOCATION';

    if (!isLoc && /usar mi ubicacion|compartir ubicacion/i.test(content) && !coords && !explicitCoords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(newCoords);
          sendMessage('📍 Ubicación compartida', newCoords, 'LOCATION');
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
      type: isLoc ? 'LOCATION' : 'TEXT',
      metadata: isLoc && explicitCoords ? { kind: 'LOCATION', lat: explicitCoords.lat, lng: explicitCoords.lng } : null,
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
          type: isLoc ? 'LOCATION' : 'TEXT',
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

  const confirmTransfer = async (req: TransferRequest) => {
    if (!req.recipient) {
      sendMessage('¿A quién quieres enviar los bunz? Dame el @usuario.');
      return;
    }
    setSending(true);
    tempCounterRef.current += 1;
    const attemptId = tempCounterRef.current;
    try {
      await PlatformBridge.hapticFeedback('medium');
      const headers = await PlatformBridge.getAuthHeaders();
      const idempotencyKey = `tx_${conversationId || 'bot'}_${attemptId}`;
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: req.recipient.replace(/^@/, ''),
          amount: req.amount,
          note: req.note,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo enviar');
      await PlatformBridge.hapticFeedback('success');
      const confirmMsg: Message = {
        id: `tx-${attemptId}`,
        senderId: 'bot',
        content: `🎉 ¡Listo! Enviaste **${req.amount} bunz** a **${data.data?.recipientName || req.recipient}**${req.note ? `\n📝 "${req.note}"` : ''}`,
        createdAt: new Date().toISOString(),
        type: 'TEXT',
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err: unknown) {
      await PlatformBridge.hapticFeedback('error');
      const msg = err instanceof Error ? err.message : 'Error al enviar bunz';
      const errMsg: Message = {
        id: `tx-err-${attemptId}`,
        senderId: 'bot',
        content: `⚠️ ${msg}`,
        createdAt: new Date().toISOString(),
        type: 'TEXT',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const submitOrder = async () => {
    if (!orderTarget || !orderItems.trim() || sending) return;
    setSending(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/order', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: orderTarget.businessId, items: orderItems, notes: orderNotes }),
      });
      const data = await res.json();
      if (data.success) {
        PlatformBridge.hapticFeedback('success');
        const target = orderTarget;
        setOrderTarget(null);
        setOrderItems('');
        setOrderNotes('');
        router.push(`/chat/${target.businessId}`);
      }
    } catch (err) {
      console.error('Error enviando pedido', err);
    } finally {
      setSending(false);
    }
  };

  const runBunzy = async (mode: 'draft' | 'summarize') => {
    const cid = conversationIdRef.current || conversationId;
    if (!cid) return;
    setBunzyBusy(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/bunzy-assist', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: cid, mode, intent: bunzyIntent }),
      });
      const data = await res.json();
      if (data?.text) {
        if (mode === 'draft') {
          setInput(data.text);
          PlatformBridge.hapticFeedback('success');
        } else {
          setBunzyNote({ mode, text: data.text });
        }
      }
    } catch {
      // silencioso
    } finally {
      setBunzyBusy(false);
      setBunzyOpen(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const openOrder = (opt: { businessId: string; businessName: string }) => {
    PlatformBridge.hapticFeedback('medium');
    setOrderItems('');
    setOrderNotes('');
    setOrderTarget(opt);
  };

  const renderBusinessCard = (target: { id: string; name: string; meta: BusinessCard | null }) => (
    <div
      style={{
        marginTop: '10px',
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
      <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('medium');
            router.push(`/chat/${target.id}`);
          }}
          style={{ flex: 1, border: 'none', background: '#E91E63', color: '#FFF', fontWeight: 800, fontSize: '13px', padding: '11px', cursor: 'pointer' }}
        >
          💬 Chatear
        </button>
        {target.meta?.businessId && (
          <button
            onClick={() => openOrder({ businessId: target.id, businessName: target.name })}
            style={{ flex: 1, border: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 800, fontSize: '13px', padding: '11px', cursor: 'pointer' }}
          >
            🛒 Pedir
          </button>
        )}
      </div>
    </div>
  );

  const renderOptions = (options: BusinessOption[]) => (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {options.map((o) => {
        const metaLine = [
          o.category,
          o.distanceKm != null ? `${o.distanceKm.toFixed(1)} km` : null,
          o.openNow === false ? 'Cerrado' : o.openNow === true ? 'Abierto' : null,
          o.rewardPercentage != null ? `+${o.rewardPercentage}% bunz` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <div
            key={o.businessId}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '14px', border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)' }}
          >
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                router.push(`/chat/${o.businessId}`);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#E91E63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {o.logoUrl ? <img src={o.logoUrl} alt={o.businessName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '16px' }}>🏪</span>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '13.5px', color: 'inherit' }}>{o.businessName}</p>
                {metaLine && <p style={{ margin: 0, fontSize: '11.5px', opacity: 0.8 }}>{metaLine}</p>}
              </div>
            </button>
            {o.acceptsBunz !== false && (
              <button
                onClick={() => openOrder({ businessId: o.businessId, businessName: o.businessName })}
                style={{ flexShrink: 0, border: 'none', background: 'rgba(233,30,99,0.15)', color: '#E91E63', fontWeight: 800, fontSize: '12px', padding: '8px 12px', borderRadius: '999px', cursor: 'pointer' }}
              >
                🛒 Pedir
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderLocation = ({ lat, lng }: { lat: number; lng: number }) => (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)' }}>
      <div
        style={{
          position: 'relative',
          height: '140px',
          background: `url(${previewMapTileUrl(lat, lng, isDark)}) center/cover`,
        }}
      >
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>
          📍
        </span>
      </div>
      <button
        onClick={() => {
          PlatformBridge.hapticFeedback('light');
          router.push(`/map?lat=${lat}&lng=${lng}`);
        }}
        style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontWeight: 800, fontSize: '13px', padding: '11px', cursor: 'pointer' }}
      >
        🗺️ Ver en el mapa
      </button>
    </div>
  );

  const renderOrder = (draft: OrderDraft) => (
    <div style={{ marginTop: '10px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)' }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>🛒</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>Pedido a {draft.businessName}</p>
          {draft.status && (
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#E91E63', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {draft.status === 'SENT' ? 'Enviado' : draft.status}
            </p>
          )}
        </div>
      </div>
      <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        {(draft.items || []).map((it, i) => (
          <p key={i} style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {it}</p>
        ))}
        {draft.notes && (
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {draft.notes}</p>
        )}
      </div>
    </div>
  );

  const renderTransferRequest = (req: TransferRequest) => (
    <div style={{ marginTop: '10px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)' }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>💸</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>Enviar bunz</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            {req.amount} bunz → {req.recipient || '¿a quién?'}
          </p>
          {req.note && (
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {req.note}</p>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => confirmTransfer(req)}
          disabled={sending || !req.recipient}
          style={{
            flex: 1, border: 'none', background: req.recipient ? '#E91E63' : 'var(--bg-pressed)', color: req.recipient ? '#FFF' : 'var(--text-muted)',
            fontWeight: 800, fontSize: '13px', padding: '11px', cursor: req.recipient ? 'pointer' : 'not-allowed', opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? 'Enviando…' : '✅ Confirmar'}
        </button>
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            sendMessage('Cancelar');
          }}
          style={{ flex: 1, border: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 800, fontSize: '13px', padding: '11px', cursor: 'pointer' }}
        >
          ❌ Cancelar
        </button>
      </div>
    </div>
  );

  const renderContent = (msg: Message) => {
    const meta: MessageMetadata | null =
      msg.metadata && typeof msg.metadata === 'object' ? msg.metadata : null;

    if (meta && 'kind' in meta && meta.kind === 'LOCATION' && typeof meta.lat === 'number' && typeof meta.lng === 'number') {
      return renderLocation(meta);
    }
    if (meta && 'kind' in meta && meta.kind === 'TRANSFER_REQUEST' && meta.transferRequest) {
      return (
        <>
          {cleanOrEmpty(msg.content) && (
            <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanOrEmpty(msg.content)}</p>
          )}
          {renderTransferRequest(meta.transferRequest)}
        </>
      );
    }
    if (meta && 'kind' in meta && meta.kind === 'RECEIVE_QR' && meta.receiveQr?.handle) {
      const payload = `rabbitty://pay?to=${encodeURIComponent(meta.receiveQr.handle)}`;
      return (
        <>
          {cleanOrEmpty(msg.content) && (
            <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanOrEmpty(msg.content)}</p>
          )}
          <div style={{ marginTop: '10px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)', padding: '16px', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', padding: '12px', borderRadius: '20px', background: '#FFFFFF', marginBottom: '10px' }}>
              <QRCodeSVG value={payload} size={160} level="M" bgColor="#ffffff" fgColor="#111111" />
            </div>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Identificador: {meta.receiveQr.handle}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Escanéalo desde la pestaña de escáner de Rabbitty
            </p>
          </div>
        </>
      );
    }
    if (meta && 'kind' in meta && meta.kind === 'OPTIONS') {
      return (
        <>
          {cleanOrEmpty(msg.content) && (
            <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanOrEmpty(msg.content)}</p>
          )}
          {renderOptions(meta.options)}
        </>
      );
    }
    if (meta && 'kind' in meta && meta.kind === 'ORDER') {
      return (
        <>
          {renderOrder(meta)}
        </>
      );
    }

    const legacy = /\[COMERCIO_ACTION id="([^"]+)" name="([^"]+)"\]/.exec(msg.content);
    const cleanText = cleanOrEmpty(msg.content);
    const card = meta && 'businessId' in meta ? (meta as BusinessCard) : null;
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
        {target && renderBusinessCard(target)}
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

        {!isBot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setBunzyOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(233,30,99,0.12)',
                border: '1px solid rgba(233,30,99,0.35)',
                borderRadius: '100px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 800,
                color: '#E91E63',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              🐰 Ayuda de Bunzy
            </button>

            {bunzyNote && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                  background: 'var(--bg-pressed)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '8px 10px',
                }}
              >
                <span style={{ flex: 1, fontSize: '12px', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#E91E63' }}>Bunzy:</strong> {bunzyNote.text}
                </span>
                {bunzyNote.mode === 'draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      setInput(bunzyNote.text);
                      setBunzyNote(null);
                    }}
                    style={{ border: 'none', background: '#E91E63', color: '#fff', borderRadius: '100px', padding: '5px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Usar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBunzyNote(null)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={shareLocation}
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

      <BottomSheet
        isOpen={Boolean(orderTarget)}
        onClose={() => setOrderTarget(null)}
        title={orderTarget ? `Pedir a ${orderTarget.businessName}` : 'Nuevo pedido'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '6px' }}>
              ¿Qué quieres pedir?
            </label>
            <textarea
              value={orderItems}
              onChange={(e) => setOrderItems(e.target.value)}
              rows={4}
              placeholder={'1x Café americano\n2x Croissant'}
              style={{
                width: '100%',
                resize: 'none',
                backgroundColor: 'var(--bg-pressed)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '12px 14px',
                fontSize: '15px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Notas (opcional)
            </label>
            <input
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Sin azúcar, para llevar…"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-pressed)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '12px 14px',
                fontSize: '15px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={submitOrder}
            disabled={!orderItems.trim() || sending}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '100px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 800,
              color: '#FFF',
              backgroundColor: !orderItems.trim() || sending ? 'var(--bg-pressed)' : 'var(--rabbitty-pink)',
              cursor: !orderItems.trim() || sending ? 'not-allowed' : 'pointer',
              boxShadow: !orderItems.trim() || sending ? 'none' : '0 6px 16px rgba(233, 30, 99, 0.35)',
            }}
          >
            {sending ? 'Enviando…' : '🛒 Enviar pedido'}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={bunzyOpen} onClose={() => setBunzyOpen(false)} title="Bunzy 🐰">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Puedo ayudarte a escribir un mensaje o resumir esta conversación.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
              ¿Qué quieres decir? (opcional)
            </label>
            <input
              value={bunzyIntent}
              onChange={(e) => setBunzyIntent(e.target.value)}
              placeholder="Ej. confirmar la reserva para el sábado a las 8"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-pressed)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '12px 14px',
                fontSize: '15px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => runBunzy('draft')}
            disabled={bunzyBusy}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '100px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 800,
              color: '#FFF',
              background: bunzyBusy ? 'var(--bg-pressed)' : 'linear-gradient(135deg, #FF2E93 0%, #FF8A00 100%)',
              cursor: bunzyBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {bunzyBusy ? 'Escribiendo…' : '✍️ Escribir mensaje'}
          </button>

          <button
            type="button"
            onClick={() => runBunzy('summarize')}
            disabled={bunzyBusy}
            style={{
              width: '100%',
              border: '1px solid var(--border-subtle)',
              borderRadius: '100px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              background: 'var(--bg-pressed)',
              cursor: bunzyBusy ? 'not-allowed' : 'pointer',
            }}
          >
            📝 Resumir chat
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
