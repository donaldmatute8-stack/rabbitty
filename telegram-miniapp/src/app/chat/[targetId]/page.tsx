'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/contexts/ToastContext';
import { Bell, BellOff, Search, Ban, MoreHorizontal, Store, Bot, ExternalLink } from 'lucide-react';

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
  | { kind: 'RECEIVE_QR'; receiveQr: ReceiveQrRequest }
  | { kind: 'REPLY'; replyTo: { id: string; text: string; sender?: 'user' | 'assistant' | 'bot' } }
  | { kind: 'VOICE'; voiceUrl?: string; voiceDataUrl?: string; durationMs?: number }
  | { kind: 'FORWARDED'; forwardedFrom?: { id: string; name: string } }
  | { kind: 'TEXT'; reactions?: Record<string, string> }
  | Record<string, unknown>;

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  type?: string;
  metadata?: MessageMetadata | null;
  readAt?: string | null;
};

interface ForwardConversation {
  id: string;
  targetId: string;
  targetName: string;
  targetAvatar: string | null;
  isBot?: boolean;
}

interface HistoryResponse {
  success?: boolean;
  conversationId?: string;
  myParticipantId?: string;
  isBusinessInbox?: boolean;
  targetName?: string;
  targetAvatar?: string | null;
  targetRole?: 'BOT' | 'AFFILIATE' | 'RABBITTER';
  targetUsername?: string | null;
  targetBio?: string | null;
  targetCategory?: string | null;
  targetBusinessId?: string | null;
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
  const [targetRole, setTargetRole] = useState<'BOT' | 'AFFILIATE' | 'RABBITTER'>('RABBITTER');
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [targetBio, setTargetBio] = useState<string | null>(null);
  const [targetCategory, setTargetCategory] = useState<string | null>(null);
  const [targetBusinessId, setTargetBusinessId] = useState<string | null>(null);
  const [targetMuted, setTargetMuted] = useState(false);
  const [targetBlocked, setTargetBlocked] = useState(false);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordIntervalRef = useRef<number | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; sender?: 'user' | 'assistant' | 'bot' } | null>(null);
  const { showToast } = useToast();
  const [contextMsg, setContextMsg] = useState<string | null>(null);
  const voiceBlobCacheRef = useRef<Record<string, string>>({});
  const [voiceSrcMap, setVoiceSrcMap] = useState<Record<string, string>>({});
  const [targetInfoOpen, setTargetInfoOpen] = useState(false);
  const [msgReactions, setMsgReactions] = useState<Record<string, string>>({});
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwardTexts, setForwardTexts] = useState<string[] | null>(null);
  const [forwardList, setForwardList] = useState<ForwardConversation[] | null>(null);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [swipingMsgId, setSwipingMsgId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number; bottom: number; right: number; isMe: boolean } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const cache = voiceBlobCacheRef.current;
    return () => {
      Object.values(cache).forEach((u) => {
        try { URL.revokeObjectURL(u); } catch { /* noop */ }
      });
      Object.keys(cache).forEach((k) => delete cache[k]);
    };
  }, []);

  useEffect(() => {
    const created: Record<string, string> = {};
    for (const msg of messages) {
      const meta = msg.metadata && typeof msg.metadata === 'object' ? (msg.metadata as Record<string, unknown>) : null;
      if (!meta || meta.kind !== 'VOICE') continue;
      if (typeof meta.voiceUrl === 'string' && meta.voiceUrl) continue;
      const data = typeof meta.voiceDataUrl === 'string' && meta.voiceDataUrl ? meta.voiceDataUrl : null;
      if (!data) continue;
      const key = msg.id || `${data.length}:${data.slice(-48)}`;
      if (voiceBlobCacheRef.current[key]) continue;
      try {
        const comma = data.indexOf(',');
        const header = comma >= 0 ? data.slice(0, comma) : '';
        const mimeMatch = /^data:([^;,]+)/.exec(header);
        const mime = (mimeMatch && mimeMatch[1]) || 'audio/webm';
        const body = comma >= 0 ? data.slice(comma + 1) : data;
        const isB64 = header.includes(';base64');
        const bin = isB64 ? atob(body) : decodeURIComponent(body);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        voiceBlobCacheRef.current[key] = blobUrl;
        created[key] = blobUrl;
      } catch { /* fallback: se queda sin audio */ }
    }
    if (Object.keys(created).length > 0) {
      queueMicrotask(() => setVoiceSrcMap((prev) => ({ ...prev, ...created })));
    }
  }, [messages]);
  const recordStartRef = useRef(0);
  const recordingCancelledRef = useRef(false);

  const isBot = targetId === 'bot';

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = localStorage.getItem(`rabbitty_pinned_${conversationId || targetId}`);
        setPinnedId(v || null);
      } catch {
        // silencioso
      }
    });
    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [conversationId, targetId]);

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
      if (data.targetRole) setTargetRole(data.targetRole);
      if (data.targetUsername !== undefined) setTargetUsername(data.targetUsername);
      if (data.targetBio !== undefined) setTargetBio(data.targetBio);
      if (data.targetCategory !== undefined) setTargetCategory(data.targetCategory);
      if (data.targetBusinessId !== undefined) setTargetBusinessId(data.targetBusinessId);
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
  }, [user, targetId, isBot]);

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
    let metaOut: MessageMetadata | null = isLoc && explicitCoords ? { kind: 'LOCATION', lat: explicitCoords.lat, lng: explicitCoords.lng } as MessageMetadata : null;
    if (replyTo && !isLoc) {
      metaOut = { kind: 'REPLY', replyTo } as MessageMetadata;
    }
    const optimisticType = metaOut && 'kind' in metaOut && typeof (metaOut as { kind?: unknown }).kind === 'string'
      ? (metaOut as { kind: string }).kind
      : (isLoc ? 'LOCATION' : 'TEXT');
    const optimistic: Message = {
      id: tempId,
      senderId: myParticipantId || user.id,
      content,
      createdAt: new Date().toISOString(),
      type: optimisticType,
      metadata: metaOut,
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
          metadata: metaOut ?? null,
        }),
      });
      const data: SendResponse = await res.json();
      if (data.success) {
        if (replyTo) setReplyTo(null);
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

  const speakText = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-MX';
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
      PlatformBridge.hapticFeedback('light');
    } catch {
      // silencioso
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      PlatformBridge.hapticFeedback('success');
    } catch {
      // silencioso
    }
  };

  const removeMessages = (ids: string[]) => {
    setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
    PlatformBridge.hapticFeedback('medium');
  };

  const openForward = (texts: string[]) => {
    const clean = texts.filter(Boolean);
    if (!clean.length) return;
    setForwardTexts(clean);
    setForwardList(null);
    setForwardLoading(true);
    PlatformBridge.hapticFeedback('medium');
    PlatformBridge.getAuthHeaders()
      .then((headers) => fetch('/api/chat', { headers }).then((r) => r.json()))
      .then((data) => setForwardList((data && data.conversations) || []))
      .catch(() => setForwardList([]))
      .finally(() => setForwardLoading(false));
  };

  const sendForward = async (conv: ForwardConversation) => {
    if (!forwardTexts?.length) return;
    const content = forwardTexts.map((t) => `↪ ${t}`).join('\n');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id, content }),
      });
      const data = await res.json();
      if (data?.success) {
        PlatformBridge.hapticFeedback('success');
        setForwardTexts(null);
      } else {
        PlatformBridge.hapticFeedback('error');
      }
    } catch {
      PlatformBridge.hapticFeedback('error');
    }
  };

  const reportMessage = (msg: Message) => {
    try {
      navigator.clipboard?.writeText(msg.content);
    } catch {
      // silencioso
    }
    setContextMsg(null);
    router.push('/chat/bot?prefill=' + encodeURIComponent(`Reportar mensaje: ${msg.content.slice(0, 160)}`));
  };

  const pickRecorderMime = (): string => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    const candidates = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/mpeg', 'audio/webm;codecs=opus', 'audio/webm'];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch { /* siguiente */ }
    }
    return '';
  };

  const startRecording = async () => {
    if (recording || sending) return;
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        PlatformBridge.hapticFeedback('error');
        showToast('El micrófono no está disponible en este contexto', 'error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      let mr: MediaRecorder;
      try {
        mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : undefined);
      } catch {
        mr = new MediaRecorder(stream);
      }
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const cancelled = recordingCancelledRef.current;
          const durationMs = Math.max(500, performance.now() - (recordStartRef.current || performance.now() - 1000));
          mediaRecorderRef.current = null;
          setRecording(false);
          if (cancelled || !audioChunksRef.current.length) return;
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || mime || 'audio/webm' });
          audioChunksRef.current = [];
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => reject(new Error('read-failed'));
            fr.readAsDataURL(blob);
          });
          if (!dataUrl || dataUrl.length > 600_000) {
            PlatformBridge.hapticFeedback('error');
            showToast('Nota de voz demasiado larga', 'error');
            return;
          }
          sendVoiceNote(dataUrl, durationMs);
        } catch {
          mediaRecorderRef.current = null;
          setRecording(false);
          PlatformBridge.hapticFeedback('error');
        } finally {
          stream.getTracks().forEach((t) => {
            try { t.stop(); } catch { /* noop */ }
          });
        }
      };
      mr.onstart = () => {
        recordStartRef.current = performance.now();
      };
      recordStartRef.current = 0;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordDuration(0);
      setRecording(true);
      PlatformBridge.hapticFeedback('medium');
      recordIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((performance.now() - recordStartRef.current) / 1000);
        setRecordDuration(elapsed);
        if (elapsed >= 60) stopRecording(false);
      }, 1000);
    } catch {
      PlatformBridge.hapticFeedback('error');
      showToast('No se pudo acceder al micrófono', 'error');
    }
  };

  const stopRecording = (cancel: boolean) => {
    recordingCancelledRef.current = cancel;
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    } else {
      mediaRecorderRef.current = null;
      setRecording(false);
    }
    PlatformBridge.hapticFeedback('light');
  };

  const sendVoiceNote = (voiceDataUrl: string, durationMs: number) => {
    if (!conversationId || sending) return;
    tempCounterRef.current += 1;
    const tempId = `temp-${tempCounterRef.current}`;
    const meta = { kind: 'VOICE', voiceDataUrl, durationMs } as unknown as MessageMetadata;
    const optimistic: Message = {
      id: tempId,
      senderId: myParticipantId || user?.id || '',
      content: '🎤 Nota de voz',
      createdAt: new Date().toISOString(),
      type: 'VOICE',
      metadata: meta,
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    PlatformBridge.getAuthHeaders()
      .then((headers) =>
        fetch('/api/chat/send', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, targetId, content: '🎤 Nota de voz', type: 'VOICE', metadata: meta }),
        }),
      )
      .then((r) => {
        if (!r.ok) throw new Error(`http-${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data?.success && data.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? (data.message as Message) : m)));
        } else {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, content: '🎤 Nota de voz (no enviada)' } : m)));
        }
      })
      .catch(() => {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, content: '🎤 Nota de voz (no enviada)' } : m)));
      })
      .finally(() => setSending(false));
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds([]);
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
            /* eslint-disable-next-line @next/next/no-img-element */
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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

    if (meta && typeof meta === 'object' && 'kind' in meta) {
      const m = meta as Record<string, unknown>;
      if (m.kind === 'VOICE') {
        const src =
          (typeof m.voiceUrl === 'string' && m.voiceUrl) ||
          (msg.id && voiceSrcMap[msg.id]) ||
          null;
        const dur = typeof m.durationMs === 'number' ? m.durationMs : 0;
        if (!src) {
          return <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>🎤 Nota de voz</span>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>🎤 Nota de voz{dur ? ` · ${Math.max(1, Math.round(dur / 1000))}s` : ''}</span>
            <audio
              controls
              preload="metadata"
              src={src}
              style={{ width: 220, maxWidth: '100%', height: 36 }}
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
              }}
            />
          </div>
        );
      }
    }
    if (meta && typeof meta === 'object' && 'kind' in meta) {
      const typedMeta = meta as Record<string, unknown>;
      if (typedMeta.kind === 'LOCATION' && typeof typedMeta.lat === 'number' && typeof typedMeta.lng === 'number') {
        return renderLocation(typedMeta as { lat: number; lng: number; label?: string });
      }
      if (typedMeta.kind === 'TRANSFER_REQUEST' && typedMeta.transferRequest && typeof typedMeta.transferRequest === 'object') {
        return (
          <>
            {cleanOrEmpty(msg.content) && (
              <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanOrEmpty(msg.content)}</p>
            )}
            {renderTransferRequest(typedMeta.transferRequest as TransferRequest)}
          </>
        );
      }
      if (typedMeta.kind === 'RECEIVE_QR' && typedMeta.receiveQr && typeof typedMeta.receiveQr === 'object') {
        const rq = typedMeta.receiveQr as ReceiveQrRequest;
        if (rq.handle) {
          const handle = rq.handle;
          const payload = `rabbitty://pay?to=${encodeURIComponent(handle)}`;
          return (
            <>
              {cleanOrEmpty(msg.content) && (
                <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanOrEmpty(msg.content)}</p>
              )}
              <div style={{ marginTop: '10px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)', padding: '16px', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', padding: '12px', borderRadius: '20px', background: '#FFFFFF', marginBottom: '10px' }}>
                  <QRCodeSVG
                    value={payload}
                    size={160}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#111111"
                    imageSettings={{ src: '/logo_conejo.png', height: 36, width: 36, excavate: true }}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Identificador: {handle}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Escanéalo desde la pestaña de escáner de Rabbitty
                </p>
              </div>
            </>
          );
        }
      }
      if (typedMeta.kind === 'OPTIONS' && Array.isArray(typedMeta.options)) {
        return (
          <>
            {cleanOrEmpty(msg.content) && (
              <p style={{ fontSize: '15px', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>{cleanOrEmpty(msg.content)}</p>
            )}
            {renderOptions(typedMeta.options as BusinessOption[])}
          </>
        );
      }
      if (typedMeta.kind === 'ORDER') {
        return (
          <>
            {renderOrder(meta as OrderDraft)}
          </>
        );
      }
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
          justifyContent: 'space-between',
          padding: 'calc(var(--safe-top, 0px) + 8px) 16px 8px',
          background: 'transparent',
          gap: 8,
        }}
      >
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (typeof window !== 'undefined' && window.history.length > 2) {
              router.back();
            } else {
              router.push('/chat');
            }
          }}
          aria-label="Volver"
          style={{
            position: 'relative',
            zIndex: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--text-primary)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            flexShrink: 0,
          }}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
          <button
            onClick={() => { PlatformBridge.hapticFeedback('light'); setTargetInfoOpen(true); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 999,
              padding: '6px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)', cursor: 'pointer', maxWidth: '58vw',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {targetName}
            </span>
            <span style={{ fontSize: 11, color: headerColor, fontWeight: 700, lineHeight: 1 }}>
              {showTyping && !isBot ? 'escribiendo…' : headerStatus}
            </span>
          </button>
        </div>
        <button
          onClick={() => { PlatformBridge.hapticFeedback('light'); setTargetInfoOpen(true); }}
          aria-label={`Perfil de ${targetName}`}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', zIndex: 2 }}
        >
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: isBot ? 'var(--rabbitty-pink)' : 'var(--bg-pressed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.12)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isBot ? '🐰' : targetAvatar ? <img src={targetAvatar} alt={targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'}
          </div>
        </button>
        {selectMode && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 'calc(var(--safe-top, 0px) + 8px) 16px 8px',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={exitSelect}
              aria-label="Cancelar selección"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              <span style={{ fontSize: 15, fontWeight: 900 }}>{selectedIds.length}</span>
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => copyText(messages.filter((m) => selectedIds.includes(m.id)).map((m) => m.content).join('\n'))}
              disabled={!selectedIds.length}
              aria-label="Copiar"
              style={{ background: 'transparent', border: 'none', cursor: selectedIds.length ? 'pointer' : 'not-allowed', padding: 0, fontSize: 17, opacity: selectedIds.length ? 1 : 0.4 }}
            >
              📋
            </button>
            <button
              type="button"
              onClick={() => openForward(messages.filter((m) => selectedIds.includes(m.id)).map((m) => m.content))}
              disabled={!selectedIds.length}
              aria-label="Reenviar"
              style={{ background: 'transparent', border: 'none', cursor: selectedIds.length ? 'pointer' : 'not-allowed', padding: 0, fontSize: 17, opacity: selectedIds.length ? 1 : 0.4 }}
            >
              ↪️
            </button>
            <button
              type="button"
              onClick={() => { removeMessages(selectedIds); exitSelect(); }}
              disabled={!selectedIds.length}
              aria-label="Eliminar"
              style={{ background: 'transparent', border: 'none', cursor: selectedIds.length ? 'pointer' : 'not-allowed', padding: 0, fontSize: 17, opacity: selectedIds.length ? 1 : 0.4 }}
            >
              🗑️
            </button>
          </div>
        )}
      </header>

      <BottomSheet isOpen={targetInfoOpen} onClose={() => setTargetInfoOpen(false)} title="Detalles del Perfil">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '4px 0 20px' }}>
          {/* Avatar with subtle glow */}
          <div style={{ 
            width: 84, 
            height: 84, 
            borderRadius: '50%', 
            background: isBot ? 'var(--rabbitty-pink)' : 'var(--bg-elevated)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 36, 
            overflow: 'hidden', 
            border: '2px solid var(--border-subtle)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isBot ? '🐰' : targetAvatar ? <img src={targetAvatar} alt={targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'}
          </div>

          {/* Name & Subtitle / Role Badge */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {targetName}
            </h3>
            <span style={{ 
              fontSize: 11, 
              fontWeight: 800, 
              padding: '2px 8px', 
              borderRadius: 99, 
              background: targetRole === 'BOT' ? 'rgba(233,30,99,0.15)' : targetRole === 'AFFILIATE' ? 'rgba(255,138,0,0.15)' : 'var(--bg-elevated)',
              color: targetRole === 'BOT' ? '#E91E63' : targetRole === 'AFFILIATE' ? '#FF8A00' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)'
            }}>
              {targetRole === 'BOT' ? '🤖 bot' : targetRole === 'AFFILIATE' ? '🏪 Afiliado Oficial' : '🐰 Rabbitter'}
            </span>
          </div>

          {/* Action Row: Mute, Search, Block, More (Telegram screenshot 4) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%', marginTop: 6 }}>
            {/* Mute */}
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setTargetMuted(m => !m);
                showToast(targetMuted ? 'Notificaciones activadas' : 'Chat silenciado', 'info');
              }}
              className="active:scale-95 transition-transform"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 6px',
                borderRadius: 16,
                background: targetMuted ? 'rgba(233,30,99,0.15)' : 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: targetMuted ? '#E91E63' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {targetMuted ? <BellOff size={20} /> : <Bell size={20} />}
              <span style={{ fontSize: 11, fontWeight: 700 }}>{targetMuted ? 'unmute' : 'mute'}</span>
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setTargetInfoOpen(false);
                showToast('Buscar en este chat', 'info');
              }}
              className="active:scale-95 transition-transform"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 6px',
                borderRadius: 16,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <Search size={20} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>search</span>
            </button>

            {/* Block */}
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('warning');
                setTargetBlocked(b => !b);
                showToast(targetBlocked ? 'Usuario desbloqueado' : 'Usuario bloqueado', targetBlocked ? 'success' : 'error');
              }}
              className="active:scale-95 transition-transform"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 6px',
                borderRadius: 16,
                background: targetBlocked ? 'rgba(244,67,54,0.15)' : 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: targetBlocked ? '#F44336' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <Ban size={20} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>{targetBlocked ? 'unblock' : 'block'}</span>
            </button>

            {/* More */}
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                if (navigator.share) {
                  navigator.share({ title: targetName, text: `Chat con ${targetName} en Rabbitty`, url: window.location.href }).catch(() => {});
                } else {
                  showToast('Enlace copiado al portapapeles', 'success');
                }
              }}
              className="active:scale-95 transition-transform"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 6px',
                borderRadius: 16,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <MoreHorizontal size={20} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>more</span>
            </button>
          </div>

          {/* Details Card (Username, About, Category) */}
          <div style={{
            width: '100%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Username */}
            <div>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                username
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0088CC' }}>
                @{targetUsername || (isBot ? 'bunzy_bot' : targetName.toLowerCase().replace(/\s+/g, '_'))}
              </span>
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)' }} />

            {/* About / Bio */}
            <div>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                about
              </span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {targetBio || 'Miembro de la comunidad Rabbitty. Participa, comparte y acumula Bunz en comercios afiliados.'}
              </p>
            </div>

            {targetCategory && (
              <>
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <div>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    categoría
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {targetCategory}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Role-Specific Action Button (Bot settings, Ir al Negocio, etc.) */}
          {targetRole === 'BOT' ? (
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setTargetInfoOpen(false);
                setBunzyOpen(true);
              }}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(233,30,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={18} color="#E91E63" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800 }}>Bot Settings & Herramientas</span>
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>›</span>
            </button>
          ) : targetRole === 'AFFILIATE' && targetBusinessId ? (
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setTargetInfoOpen(false);
                router.push(`/p/${targetBusinessId}`);
              }}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,138,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={18} color="#FF8A00" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800 }}>Ver Perfil y Menú del Negocio</span>
              </div>
              <ExternalLink size={16} color="var(--text-muted)" />
            </button>
          ) : null}
        </div>
      </BottomSheet>

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
        {pinnedId && messages.some((m) => m.id === pinnedId) && (() => {
          const pm = messages.find((m) => m.id === pinnedId)!;
          return (
            <div
              onClick={() => setReplyTo({ id: pm.id, text: (pm.content || '').slice(0, 120), sender: pm.senderId === myParticipantId ? 'user' : 'assistant' })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderLeft: '3px solid #E91E63', borderRadius: 12, padding: '8px 12px', cursor: 'pointer', order: -1, position: 'sticky', top: 0, zIndex: 30, boxShadow: 'var(--shadow-sm)' }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>📌</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#E91E63' }}>Mensaje fijado</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pm.content}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPinnedId(null);
                  try { if (conversationId || targetId) localStorage.removeItem(`rabbitty_pinned_${conversationId || targetId}`); } catch {}
                }}
                aria-label="Desfijar"
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 15, cursor: 'pointer', padding: 2 }}
              >
                ✕
              </button>
            </div>
          );
        })()}
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
            const isSelected = selectedIds.includes(msg.id);
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id || idx}
                style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%', position: 'relative' }}
              >
                {/* Telegram-style Reply indicator circle behind message during swipe */}
                <div
                  style={{
                    position: 'absolute',
                    left: isMe ? 'auto' : 8,
                    right: isMe ? 8 : 'auto',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 0,
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(233,30,99,0.2)',
                    border: '1.5px solid #E91E63',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#E91E63',
                    pointerEvents: 'none',
                    opacity: swipingMsgId === msg.id ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                  </svg>
                </div>

                <motion.div
                  drag={selectMode ? false : 'x'}
                  dragSnapToOrigin
                  dragConstraints={{ left: isMe ? -80 : 0, right: isMe ? 0 : 80 }}
                  dragElastic={0.25}
                  dragDirectionLock
                  onDragStart={() => setSwipingMsgId(msg.id)}
                  onDragEnd={(_, info) => {
                    setSwipingMsgId(null);
                    const threshold = isMe ? -50 : 50;
                    const triggered = isMe ? info.offset.x < threshold : info.offset.x > threshold;
                    if (triggered) {
                      PlatformBridge.hapticFeedback('medium');
                      setReplyTo({ id: msg.id, text: (msg.content || '').slice(0, 120), sender: isMe ? 'user' : 'assistant' });
                    }
                  }}
                  onPointerDown={(e) => {
                    if (selectMode) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    longPressTimerRef.current = window.setTimeout(() => {
                      PlatformBridge.hapticFeedback('medium');
                      setContextMenuPos({ top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, isMe });
                      setContextMsg(msg.id);
                    }, 450);
                  }}
                  onPointerUp={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                  onPointerLeave={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                  onPointerMove={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                  onClick={() => {
                    if (selectMode) {
                      PlatformBridge.hapticFeedback('light');
                      setSelectedIds((prev) => (prev.includes(msg.id) ? prev.filter((x) => x !== msg.id) : [...prev, msg.id]));
                    }
                  }}
                  style={{ cursor: selectMode ? 'pointer' : 'grab', position: 'relative', zIndex: 1 }}
                >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    backgroundColor: isMe ? 'var(--rabbitty-pink)' : 'var(--bg-elevated)',
                    color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                    borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    boxShadow: 'var(--shadow-sm)',
                    border: isSelected ? '2px solid #FCD34D' : (isMe ? 'none' : '1px solid var(--border-subtle)'),
                    outline: isSelected ? '2px solid rgba(252,211,77,0.5)' : 'none',
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
                  {(() => {
                    const meta = msg.metadata && typeof msg.metadata === 'object' ? (msg.metadata as Record<string, unknown>) : null;
                    if (meta && meta.kind === 'REPLY' && meta.replyTo && typeof meta.replyTo === 'object') {
                      const rt = meta.replyTo as { text?: string; sender?: string };
                      return (
                        <div style={{ marginBottom: 6, paddingLeft: 8, borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.7)' : '#E91E63'}`, background: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(233,30,99,0.07)', borderRadius: 8, padding: '4px 8px' }}>
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, opacity: 0.85 }}>
                            {rt.sender === 'user' ? 'Tú' : 'Otro'}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {rt.text || ''}
                          </span>
                        </div>
                      );
                    }
                    if (!isMe && meta && meta.kind === 'FORWARDED' && meta.forwardedFrom && typeof meta.forwardedFrom === 'object') {
                      const ff = meta.forwardedFrom as { name?: string };
                      return (
                        <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 800, fontStyle: 'italic', opacity: 0.7 }}>↪ Reenviado de {ff.name || 'contacto'}</div>
                      );
                    }
                    return null;
                  })()}
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
                  {msgReactions[msg.id] && (
                    <div style={{ position: 'absolute', bottom: -14, [isMe ? 'left' : 'right']: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '2px 7px', fontSize: 13, boxShadow: 'var(--shadow-sm)', lineHeight: 1.2 } as React.CSSProperties}>
                      {msgReactions[msg.id]}
                    </div>
                  )}
                </div>
                </motion.div>
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

        {replyTo && !selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)', borderLeft: '3px solid #E91E63', borderRadius: 12, padding: '8px 12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#E91E63' }}>
                ↩ Respondiendo a {replyTo.sender === 'user' ? 'Tú' : 'Otro'}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyTo.text}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancelar respuesta"
              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 4 }}
            >
              ✕
            </button>
          </div>
        )}

        {!selectMode && recording && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              aria-label="Cancelar grabación"
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--bg-pressed)', color: '#D32F2F', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
            >
              🗑️
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-pressed)', border: '1px solid #E91E63', borderRadius: 100, padding: '12px 18px' }}>
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ width: 10, height: 10, borderRadius: '50%', background: '#E91E63', flexShrink: 0 }}
              />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                Grabando… 0:{String(recordDuration).padStart(2, '0')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              aria-label="Enviar nota de voz"
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--rabbitty-pink)', color: '#fff', fontSize: 18, cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 12px rgba(233,30,99,0.35)' }}
            >
              ➤
            </button>
          </div>
        )}

        {!selectMode && !recording && (
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
          {input.trim() ? (
            <button
              type="submit"
              disabled={sending}
              aria-label="Enviar mensaje"
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: sending ? 'var(--bg-pressed)' : 'var(--rabbitty-pink)',
                color: sending ? 'var(--text-muted)' : '#FFFFFF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: sending ? 'none' : '0 4px 12px rgba(233, 30, 99, 0.35)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px) translateY(1px)' }}>
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={sending}
              title="Grabar nota de voz"
              aria-label="Grabar nota de voz"
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: sending ? 'var(--bg-pressed)' : 'var(--rabbitty-pink)',
                color: sending ? 'var(--text-muted)' : '#FFFFFF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: sending ? 'none' : '0 4px 12px rgba(233, 30, 99, 0.35)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          )}
        </form>
        )}
      </footer>

      {contextMsg && (() => {
        const msg = messages.find((m) => m.id === contextMsg);
        if (!msg) return null;
        const isMyMsg = msg.senderId === myParticipantId;
        const rows: Array<{ icon: string; label: string; danger?: boolean; run: () => void }> = [
          { icon: '↩️', label: 'Responder', run: () => { setReplyTo({ id: msg.id, text: (msg.content || '').slice(0, 120), sender: isMyMsg ? 'user' : 'assistant' }); setContextMsg(null); } },
          { icon: '📋', label: 'Copiar', run: () => { copyText(msg.content); showToast('Mensaje copiado', 'success'); setContextMsg(null); } },
          { icon: '↪️', label: 'Reenviar', run: () => { openForward([msg.content]); setContextMsg(null); } },
          { icon: '📌', label: pinnedId === msg.id ? 'Desfijar' : 'Fijar', run: () => { const next = pinnedId === msg.id ? null : msg.id; setPinnedId(next); try { if (conversationId || targetId) localStorage.setItem(`rabbitty_pinned_${conversationId || targetId}`, next || ''); } catch {} PlatformBridge.hapticFeedback('medium'); showToast(next ? '📌 Fijado' : 'Desfijado', 'success'); setContextMsg(null); } },
          { icon: '🔊', label: 'Escuchar', run: () => { speakText(msg.content); setContextMsg(null); } },
          { icon: '☑️', label: 'Seleccionar', run: () => { setSelectMode(true); setSelectedIds([msg.id]); setContextMsg(null); } },
          ...(!isMyMsg ? [{ icon: '🚩', label: 'Reportar', run: () => reportMessage(msg) }] : []),
          { icon: '🗑️', label: 'Eliminar', danger: true, run: () => { removeMessages([msg.id]); setContextMsg(null); } },
        ];

        // Telegram-style smart positioning
        const pos = contextMenuPos;
        const isNearBottom = pos && pos.top > (typeof window !== 'undefined' ? window.innerHeight * 0.6 : 500);

        return (
          <div
            onClick={() => setContextMsg(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 400,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: isNearBottom ? 'flex-end' : 'center',
              alignItems: isMyMsg ? 'flex-end' : 'flex-start',
              padding: '16px 20px calc(24px + env(safe-area-inset-bottom, 20px))',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 270,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                animation: 'scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Telegram Floating Emoji Reaction Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(26, 26, 38, 0.88)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 999,
                  padding: '6px 10px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  alignSelf: isMyMsg ? 'flex-end' : 'flex-start',
                }}
              >
                {['🔥', '❤️', '👍', '😂', '😮', '🙏'].map((em) => (
                  <button
                    key={em}
                    onClick={() => {
                      setMsgReactions((prev) => ({ ...prev, [msg.id]: em }));
                      PlatformBridge.hapticFeedback('light');
                      setContextMsg(null);
                    }}
                    style={{
                      fontSize: 22,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '50%',
                      width: 38,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      padding: 0,
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Telegram Floating Action Menu */}
              <div
                style={{
                  background: 'rgba(26, 26, 38, 0.94)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: 18,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  overflow: 'hidden',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
                  width: '100%',
                }}
              >
                {rows.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      r.run();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '11px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: i < rows.length - 1 ? '1px solid rgba(255, 255, 255, 0.07)' : 'none',
                      cursor: 'pointer',
                      color: r.danger ? '#FF453A' : '#FFFFFF',
                      textAlign: 'left',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <span>{r.label}</span>
                    <span style={{ fontSize: 16, opacity: 0.85, width: 20, textAlign: 'right' }}>{r.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <BottomSheet isOpen={Boolean(forwardTexts)} onClose={() => setForwardTexts(null)} title="Reenviar mensaje">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {forwardTexts && forwardTexts.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg-pressed)', borderLeft: '3px solid #E91E63', borderRadius: 10, padding: '8px 10px' }}>
              <span style={{ fontSize: 14, lineHeight: 1.3 }}>↪️</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                {forwardTexts.slice(0, 2).join(' · ')}
                {forwardTexts.length > 2 ? ` (+${forwardTexts.length - 2})` : ''}
              </span>
            </div>
          )}
          {forwardLoading ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>Cargando conversaciones…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '38vh', overflowY: 'auto' }}>
              {(forwardList || []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => sendForward(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.isBot ? 'var(--rabbitty-pink)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, fontSize: 15 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.isBot ? '🐰' : c.targetAvatar ? <img src={c.targetAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.targetName}</span>
                </button>
              ))}
              {!forwardLoading && (forwardList || []).length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No hay conversaciones disponibles.</p>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                const text = (forwardTexts || []).map((t) => `↪ ${t}`).join('\n');
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              style={{ flex: 1, border: '1px solid #25D366', background: 'rgba(37,211,102,0.12)', color: '#25D366', borderRadius: 100, padding: '12px 0', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => copyText((forwardTexts || []).map((t) => `↪ ${t}`).join('\n'))}
              style={{ flex: 1, border: '1px solid var(--border-subtle)', background: 'var(--bg-pressed)', color: 'var(--text-primary)', borderRadius: 100, padding: '12px 0', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              📋 Copiar
            </button>
          </div>
        </div>
      </BottomSheet>

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
