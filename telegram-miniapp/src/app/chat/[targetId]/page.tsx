'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useAuth } from '@/features/auth/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';
import { cursorFromMessage } from '@/lib/chatCursor';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/contexts/ToastContext';
import { Bell, BellOff, Search, Ban, MoreHorizontal, Store, Bot, ExternalLink, Zap } from 'lucide-react';

import { useRealtimeChat } from '@/lib/realtime/useRealtimeChat';
import { ensureIdentity, getDeviceId } from '@/lib/e2e/identity';
import { ensureConversationKey } from '@/lib/e2e/conversationKeys';
import { decryptBytes, decryptText, encryptBytes, encryptText } from '@/lib/e2e/crypto';
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
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedForAll?: boolean;
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>;
  encrypted?: boolean;
};

interface ForwardConversation {
  id: string;
  targetId: string;
  targetName: string;
  targetAvatar: string | null;
  isBot?: boolean;
}

interface HistoryResponse {
  partnerOnline?: boolean | null;
  success?: boolean;
  conversationId?: string;
  kind?: 'DIRECT' | 'GROUP';
  audience?: 'BUSINESS' | 'PEER';
  group?: { name: string | null; members: Array<{ userId: string; name: string; role: string }> } | null;
  e2eKeyVersion?: number;
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

/**
 * Renderizador de formato Markdown nativo y seguro para respuestas de Bunzy y usuarios.
 * Soporta **negritas**, *cursivas*, `código`, listas numeradas y saltos de línea estéticos.
 */
function renderFormattedMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <span style={{ display: 'inline', fontSize: '16px', lineHeight: '1.34', margin: 0, wordBreak: 'break-word' }}>
      {lines.map((line, lineIdx) => {
        // Detectar si es elemento de lista numerada como "1. **Nombre**"
        const isListItem = /^\d+\.\s/.test(line);

        // Procesar tokens inline: **bold**, *italic*, `code`
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

        return (
          <span
            key={lineIdx}
            style={{
              display: lineIdx === lines.length - 1 ? 'inline' : 'block',
              marginBottom: lineIdx === lines.length - 1 ? 0 : line.trim() === '' ? '6px' : '3px',
              paddingLeft: isListItem ? '4px' : undefined,
            }}
          >
            {parts.map((part, partIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={partIdx} style={{ fontWeight: 800, color: 'inherit' }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('*') && part.endsWith('*')) {
                return (
                  <em key={partIdx} style={{ fontStyle: 'italic', opacity: 0.9 }}>
                    {part.slice(1, -1)}
                  </em>
                );
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code
                    key={partIdx}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </span>
        );
      })}
    </span>
  );
}

function TypewriterText({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let currentIdx = 0;
    // Revelar gradualmente por bloques de caracteres para una animación fluida tipo streaming
    const totalLen = text.length;
    const chunkSize = Math.max(1, Math.min(6, Math.floor(totalLen / 35)));
    const interval = setInterval(() => {
      currentIdx = Math.min(totalLen, currentIdx + chunkSize);
      setDisplayedText(text.slice(0, currentIdx));
      if (currentIdx >= totalLen) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 18);

    return () => clearInterval(interval);
  }, [text, onComplete]);

  return renderFormattedMarkdown(displayedText);
}

function CheckTicks({ read }: { read: boolean }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M1 6L4 9L10 2" stroke={read ? '#4FC3F7' : 'rgba(255,255,255,0.75)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {read && <path d="M6 6L9 9L15 2" stroke="#4FC3F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function formatVoiceDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function VoiceNoteBubble({
  msgId,
  src,
  rawSrc,
  durationMs,
  isMe,
  createdAt,
  read,
  showTicks,
}: {
  msgId: string;
  src: string | null;
  rawSrc?: string | null;
  durationMs: number;
  isMe: boolean;
  createdAt: string;
  read: boolean;
  showTicks: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { showToast } = useToast();
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedSec, setLoadedSec] = useState<number | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  const totalSec = loadedSec ?? Math.max(1, Math.round((durationMs || 1000) / 1000));

  // Generar 30 barras determinísticas estilo Telegram a partir del ID del mensaje
  const bars = useMemo(() => {
    let hash = 2166136261;
    const seed = msgId || 'voice';
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const arr: number[] = [];
    for (let i = 0; i < 30; i++) {
      hash ^= i + 1;
      hash = Math.imul(hash, 16777619);
      const norm = (Math.abs(hash) % 100) / 100;
      // Curva suave con picos tipo voz humana (entre 4px y 20px)
      const envelope = Math.sin((i / 29) * Math.PI) * 0.55 + 0.45;
      arr.push(Math.max(3, Math.round((4 + norm * 16) * envelope)));
    }
    return arr;
  }, [msgId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const dur = el.duration && Number.isFinite(el.duration) ? el.duration : totalSec;
      setCurrentTime(el.currentTime);
      setProgress(dur > 0 ? Math.min(1, el.currentTime / dur) : 0);
    };
    const onLoaded = () => {
      if (el.duration && Number.isFinite(el.duration) && el.duration > 0) {
        setLoadedSec(Math.max(1, Math.round(el.duration)));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => {
      setPlaying(true);
      setHasPlayed(true);
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
    };
  }, [src, totalSec]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    PlatformBridge.hapticFeedback('light');
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.pause();
    } else {
      // Pausar cualquier otro audio activo en la página
      document.querySelectorAll('audio').forEach((other) => {
        if (other !== el) {
          try { other.pause(); } catch {}
        }
      });
      el.play().catch(() => void playWithFallbacks(el));
    }
  };

  /** Fase audio: base64 (o URL) → ArrayBuffer → decodeAudioData → BufferSource. */
  const playThroughAudioContext = async (blobOrDataUrl: string): Promise<void> => {
    const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext) as
      | (typeof AudioContext)
      | undefined;
    if (!AudioCtor) throw new Error('sin AudioContext');
    const ctx = ctxRef.current ?? new AudioCtor();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    let bytes: ArrayBuffer;
    if (blobOrDataUrl.startsWith('data:')) {
      const comma = blobOrDataUrl.indexOf(',');
      const isB64 = blobOrDataUrl.slice(0, comma).includes(';base64');
      const body = comma >= 0 ? blobOrDataUrl.slice(comma + 1) : blobOrDataUrl;
      bytes = atob(isB64 ? body : decodeURIComponent(body)).length
        ? Uint8Array.from(atob(isB64 ? body : decodeURIComponent(body)).split('').map((ch) => ch.charCodeAt(0))).buffer
        : new ArrayBuffer(0);
    } else {
      const res = await fetch(blobOrDataUrl);
      bytes = await res.arrayBuffer();
    }
    const buffer = await ctx.decodeAudioData(bytes);
    // Detener fuente previa del fallback
    sourceRef.current?.stop?.();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => { setPlaying(false); setHasPlayed(true); };
    sourceRef.current = source;
    source.start();
    // Duración conocida para la barra
    if (buffer.duration && Number.isFinite(buffer.duration)) setLoadedSec(Math.max(1, Math.round(buffer.duration)));
    setPlaying(true);
    setHasPlayed(true);
    // Simular progreso via interval hasta que onended dispare
    const startedAt = ctx.currentTime;
    const tick = window.setInterval(() => {
      if (sourceRef.current !== source) { window.clearInterval(tick); return; }
      const t = ctx.currentTime - startedAt;
      setCurrentTime(t);
      setProgress(Math.min(1, t / Math.max(1, buffer.duration)));
      if (t >= buffer.duration) window.clearInterval(tick);
    }, 200);
  };

  /** Cadena de fallbacks al fallar <audio> nativo (iOS WKWebView/codec). */
  const playWithFallbacks = async (el0: HTMLAudioElement): Promise<void> => {
    try {
      const rawUrl = el0.getAttribute('data-raw-src') || '';
      if (rawUrl && el0.src !== rawUrl) {
        el0.src = rawUrl;
        await el0.play();
        return;
      }
    } catch { /* siguiente fallback */ }
    try {
      await playThroughAudioContext(rawSrc || el0.currentSrc || el0.src);
      return;
    } catch (decodeErr) {
      setPlaying(false);
      showToast(
        `No se pudo reproducir la nota de voz (${(String((decodeErr as Error)?.message || 'códec no soportado en este dispositivo')).slice(0, 80)})`,
        'error'
      );
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !src) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = el.duration && Number.isFinite(el.duration) ? el.duration : totalSec;
    if (dur > 0) {
      el.currentTime = ratio * dur;
      setProgress(ratio);
      setCurrentTime(ratio * dur);
    }
  };

  const displaySec = playing || currentTime > 0 ? currentTime : totalSec;
  const timeStr = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        minWidth: 215,
        maxWidth: 265,
        padding: '3px 2px 1px 0',
        userSelect: 'none',
      }}
    >
      {src && <audio ref={audioRef} src={src} data-raw-src={rawSrc || ''} preload="metadata" style={{ display: 'none' }} />}

      {/* Botón circular Play / Pause estilo Telegram */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!src}
        aria-label={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          border: 'none',
          background: isMe ? '#FFFFFF' : 'linear-gradient(135deg, #FF2E93 0%, #E11D74 100%)',
          color: isMe ? '#E11D74' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: src ? 'pointer' : 'default',
          flexShrink: 0,
          boxShadow: isMe ? '0 2px 8px rgba(0,0,0,0.16)' : '0 2px 10px rgba(233,30,99,0.35)',
          opacity: src ? 1 : 0.6,
          padding: 0,
        }}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1.5" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'translateX(1.5px)' }}>
            <path d="M6 4.5C6 3.67 6.94 3.19 7.62 3.67L19.14 11.17C19.74 11.56 19.74 12.44 19.14 12.83L7.62 20.33C6.94 20.81 6 20.33 6 19.5V4.5Z" />
          </svg>
        )}
      </button>

      {/* Columna derecha: Waveform + fila inferior de duración y hora */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Barras de onda interactivas */}
        <div
          onClick={handleSeek}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
            height: 22,
            cursor: src ? 'pointer' : 'default',
          }}
        >
          {bars.map((h, idx) => {
            const barRatio = idx / bars.length;
            const isActive = playing || progress > 0 ? barRatio <= progress : false;
            const activeColor = isMe ? '#FFFFFF' : '#FF2E93';
            const inactiveColor = isMe ? 'rgba(255,255,255,0.48)' : 'rgba(255,255,255,0.28)';
            return (
              <span
                key={idx}
                style={{
                  width: 2.5,
                  height: h,
                  borderRadius: 999,
                  background: isActive ? activeColor : inactiveColor,
                  transition: 'background 0.12s ease',
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>

        {/* Fila inferior estilo Telegram: "0:05 •" a la izquierda y "05:12 PM ✓✓" a la derecha */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            lineHeight: 1,
            color: isMe ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span>{formatVoiceDuration(displaySec)}</span>
            {!hasPlayed && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isMe ? '#FFFFFF' : '#FF2E93',
                  display: 'inline-block',
                }}
              />
            )}
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500, opacity: 0.92 }}>
            {timeStr}
            {showTicks && <CheckTicks read={read} />}
          </span>
        </div>
      </div>
    </div>
  );
}

function generateChatTxKey(convId: string | null, attempt: number): string {
  const rand = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `tx_${convId || 'bot'}_${attempt}_${rand}`;
}

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { targetId } = useParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  // ── H-FASE0: paginación/delta (plan §4) ──
  const [cursor, setCursor] = useState<string>( '');
  const cursorRef = useRef('');
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState<boolean | null>(null);
  // Presencia REAL de app (realtime). Cuando llega, manda sobre la de GPS.
  const [realtimePresenceActive, setRealtimePresenceActive] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [isBusinessInbox, setIsBusinessInbox] = useState(false);
  const [businessOpen, setBusinessOpen] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [targetName, setTargetName] = useState('...');
  // ── Grupo: tipo, nombre y miembros ──
  const [chatKind, setChatKind] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [chatAudience, setChatAudience] = useState<'BUSINESS' | 'PEER'>('BUSINESS');
  // ── E2E (solo DIRECT + PEER) ──
  const [e2eKey, setE2eKey] = useState<CryptoKey | null>(null);
  const [e2eVersion, setE2eVersion] = useState(1);
  const decryptedIds = useRef<Set<string>>(new Set());
  // Media E2E ya descifrada (msgId → blob URL)
  const [e2eMedia, setE2eMedia] = useState<Record<string, string>>({});
  const e2eMediaPending = useRef<Set<string>>(new Set());
  const [groupInfo, setGroupInfo] = useState<{ name: string | null; members: Array<{ userId: string; name: string; role: string }> } | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groupAddQuery, setGroupAddQuery] = useState('');
  const [groupAddResults, setGroupAddResults] = useState<Array<{ id: string; name: string; username?: string | null }>>([]);
  const [groupAddBusy, setGroupAddBusy] = useState(false);
  // ── Búsqueda en el historial (solo BUSINESS, ver ADR-013) ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHits, setSearchHits] = useState<Array<{ id: string; content: string; createdAt: string; senderName?: string }>>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [targetAvatar, setTargetAvatar] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<'BOT' | 'AFFILIATE' | 'RABBITTER'>('RABBITTER');
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [targetBio, setTargetBio] = useState<string | null>(null);
  const [targetCategory, setTargetCategory] = useState<string | null>(null);
  const [targetBusinessId, setTargetBusinessId] = useState<string | null>(null);
  // ¿El usuario actual es el DUEÑO del negocio? (el GET de campaigns exige
  // ownership server-side → 200 = dueño, 403 = no). Gating del botón Flash Boost.
  const [targetBusinessIsOwner, setTargetBusinessIsOwner] = useState<boolean | null>(null);
  const [targetMuted, setTargetMuted] = useState(false);
  const [targetBlocked, setTargetBlocked] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // ── Fase 3/4: realtime (Centrifugo) ──────────────────────────────────────
  // Si el backend no lo habilita, el hook no hace nada y el chat sigue con su
  // polling. Los mensajes se deduplican por id (el worker es at-least-once).
  useRealtimeChat({
    conversationId,
    enabled: Boolean(conversationId) && targetId !== 'bot',
    onMessage: (m) => {
      if (!m?.id) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m as unknown as Message]));
    },
    onPeerPresence: (online) => {
      setRealtimePresenceActive(true);
      setPartnerOnline(online);
    },
  });

  // Ownership del negocio destino: el GET de campaigns exige ownership
  // server-side (200 = dueño, 403 = no) — usado para mostrar "⚡ Dar un
  // Flash Boost" SOLO a su dueño; un Rabbitter no debe verlo.
  useEffect(() => {
    setTargetBusinessIsOwner(null);
    if (!targetBusinessId || !user?.id) return;
    let alive = true;
    (async () => {
      try {
        const h = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/business/campaigns?businessId=${targetBusinessId}`, { headers: h || {} });
        if (alive) setTargetBusinessIsOwner(res.ok);
      } catch {
        if (alive) setTargetBusinessIsOwner(false);
      }
    })();
    return () => { alive = false; };
  }, [targetBusinessId]);
  const [showTyping, setShowTyping] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [animatingBotMessageIds, setAnimatingBotMessageIds] = useState<string[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleMainScroll = () => {
    if (!mainRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 90;
    isAtBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom && messages.length > 3);
  };
  const [orderTarget, setOrderTarget] = useState<{ businessId: string; businessName: string } | null>(null);
  const [orderItems, setOrderItems] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [bunzyOpen, setBunzyOpen] = useState(false);
  const [bunzyBusy, setBunzyBusy] = useState(false);
  const [bunzyIntent, setBunzyIntent] = useState('');
  const [bunzyNote, setBunzyNote] = useState<{ mode: 'draft' | 'summarize' | 'admin_qa' | 'marketing_proposal'; text: string } | null>(null);
  const [boostSheetOpen, setBoostSheetOpen] = useState(false);
  const [boostPercentage, setBoostPercentage] = useState(25);
  const [boostHours, setBoostHours] = useState(4);
  const [activeBoostCampaign, setActiveBoostCampaign] = useState<{ id: string; rewardPercentage: number; budgetBunz: number; budgetSpent: number; expiresAt: string } | null>(null);
  const [loadingActiveBoost, setLoadingActiveBoost] = useState(false);
  const [activatingBoost, setActivatingBoost] = useState(false);
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
      // Media en bucket: la URL se arma con la key (proxy autenticado).
      if (typeof meta.key === 'string' && meta.key) {
        const src = `/api/chat/media/${meta.key.split('/').map(encodeURIComponent).join('/')}`;
        setVoiceSrcMap((prev) => (prev[msg.id] ? prev : { ...prev, [msg.id]: src }));
        continue;
      }
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

  // Visual viewport tracking for iOS native keyboard (keeps input visible above keyboard)
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [vvStyle, setVvStyle] = useState<{ height: string; top: number }>({ height: '100dvh', top: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    let baselineHeight = Math.max(window.innerHeight, vv.height);

    const updateViewport = () => {
      const curH = vv.height;
      const curTop = vv.offsetTop;
      if (curH > baselineHeight) baselineHeight = curH;
      const kbDelta = baselineHeight - curH;
      const isOpen = kbDelta > 90;
      setKeyboardOpen(isOpen);
      setVvStyle({
        height: `${Math.round(curH)}px`,
        top: Math.max(0, Math.round(curTop)),
      });
      if (isOpen && isAtBottomRef.current) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
      }
    };

    updateViewport();
    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

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

    const apply = (data: HistoryResponse & Partial<{ hasMore: boolean; nextCursor: string | null }>, mode: 'initial' | 'delta' | 'older' = 'initial') => {
      if (!data.success) return;
      if (data.conversationId) {
        conversationIdRef.current = data.conversationId;
        setConversationId(data.conversationId);
      }
      if (data.myParticipantId) setMyParticipantId(data.myParticipantId);
      if (typeof data.isBusinessInbox === 'boolean') setIsBusinessInbox(data.isBusinessInbox);
      if (data.targetName) setTargetName(data.targetName);
      if (data.kind === 'GROUP' || data.kind === 'DIRECT') setChatKind(data.kind);
      if (data.audience === 'PEER' || data.audience === 'BUSINESS') setChatAudience(data.audience);
      if (typeof data.e2eKeyVersion === 'number') setE2eVersion(data.e2eKeyVersion);
      if (data.group !== undefined) {
        setGroupInfo(data.group ?? null);
        if (data.group?.name) setTargetName(data.group.name);
      }
      if (data.targetAvatar !== undefined) setTargetAvatar(data.targetAvatar);
      if (data.targetRole) setTargetRole(data.targetRole);
      if (data.targetUsername !== undefined) setTargetUsername(data.targetUsername);
      if (data.targetBio !== undefined) setTargetBio(data.targetBio);
      if (data.targetCategory !== undefined) setTargetCategory(data.targetCategory);
      if (data.targetBusinessId !== undefined) setTargetBusinessId(data.targetBusinessId);
      if (data.businessOpen !== undefined) setBusinessOpen(data.businessOpen);
      // H21-bis: si el transporte realtime está activo, su presencia (conectividad
      // de app) manda; el dato de GPS solo se usa como fallback.
      if (typeof data.partnerOnline === 'boolean' && !realtimePresenceActive) setPartnerOnline(data.partnerOnline);
      otherTypingAtRef.current = data.otherTypingAt ?? null;
      if (data.messages) {
        if (mode === 'older') {
          // H-FASE0 · paginación hacia atrás: prepend sin duplicar (antiguos)
          setMessages((prev) => {
            const known = new Set(prev.map(m => m.id));
            const older = data.messages!.filter(m => !known.has(m.id));
            return [...older, ...prev];
          });
        } else if (mode === 'delta') {
          // H-FASE0 · delta del interval: solo LOS NUEVOS se append (sin
          // re-descarga entera). Antes cada tick reemplazaba toda la lista.
          setMessages((prev) => {
            const known = new Set(prev.map(m => m.id));
            const fresh = data.messages!.filter(m => !known.has(m.id));
            if (fresh.length === 0) return prev;
            return [...prev, ...fresh];
          });
        } else {
          setMessages((prev) => {
            if (prev.length === data.messages!.length) {
              const lastPrev = prev[prev.length - 1];
              const lastNew = data.messages![data.messages!.length - 1];
              if (lastPrev?.id === lastNew?.id && lastPrev?.content === lastNew?.content) {
                return prev;
              }
            }
            return data.messages!;
          });
        }
      }
      // H-FASE0 · cursores: confirmado = base del delta y del load-older.
      // El cursor AVANZA con el último mensaje recibido (el cliente ya lo
      // pinta = procesado). `hasOlder` solo se toca en initial/older (el
      // delta no dice nada del historial pasado).
      if (mode !== 'delta') setHasOlder(Boolean(data.hasMore));
      if (mode !== 'older') {
        const last = data.messages?.[data.messages!.length - 1];
        if (last) {
          const next = cursorFromMessage({ createdAt: last.createdAt as string, id: last.id });
          cursorRef.current = next;
          setCursor(next);
        }
      }

      if (urlPrefill && data.conversationId && !prefillApplied) {
        prefillApplied = true;
        setInput(urlPrefill);
      }
    };

    const fetchHistory = async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(buildUrl(), { headers });
        apply(await res.json(), 'initial');
      } catch (err) {
        console.error('Error cargando chat', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // H-FASE0 · delta: el interval (4s) ya no re-descarga la conversación
    // completa — pide SOLO lo nuevo desde el cursor confirmado. El cursor
    // avanza cuando el client recibió (procesó) el lote, no meramente al
    // recibir la respuesta HTTP.
    const interval = setInterval(async () => {
      try {
        const id = conversationIdRef.current;
        if (!id) return;
        const headers = await PlatformBridge.getAuthHeaders();
        const base = `/api/chat/history?conversationId=${encodeURIComponent(id)}`;
        const withDelta = cursorRef.current ? `${base}&after=${encodeURIComponent(cursorRef.current)}` : base;
        const res = await fetch(withDelta, { headers });
        apply(await res.json(), 'delta');
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

  // ── H-FASE0 · mark-read (regla §9: comando, no efecto del GET) ──
  // Marca leído SOLO cuando la conversación está abierta Y la pestaña visible:
  // una precarga, un background o un retry no "leen" por el usuario.
  useEffect(() => {
    const id = conversationIdRef.current;
    if (!id || document.visibilityState !== 'visible') return;
    const unread = messages.filter((m) => m.senderId !== myParticipantId && !m.readAt);
    if (unread.length === 0) return;
    PlatformBridge.getAuthHeaders().then((headers) => {
      fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id }),
      }).catch(() => {});
    });
  }, [messages, myParticipantId, conversationId]);

  // H-FASE0 · reconexión a la vista: al volver a foreground, el delta se pide
  // de inmediato (gap fill — cursor confirmado) en lugar de esperar hasta 4s.
  useEffect(() => {
    const onVisible = () => {
      const id = conversationIdRef.current;
      if (document.visibilityState !== 'visible' || !id || !cursorRef.current) return;
      void (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const res = await fetch(
            `/api/chat/history?conversationId=${encodeURIComponent(id)}&after=${encodeURIComponent(cursorRef.current)}`,
            { headers },
          );
          const data = await res.json();
          if (data?.success && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages((prev) => {
              const known = new Set(prev.map((m: { id: string }) => m.id));
              const fresh = data.messages.filter((m: { id: string }) => !known.has(m.id));
              if (fresh.length === 0) return prev;
              return [...prev, ...fresh];
            });
            const last = data.messages[data.messages.length - 1];
            const next = cursorFromMessage({ createdAt: last.createdAt, id: last.id });
            cursorRef.current = next;
            setCursor(next);
          }
        } catch { /* silencioso */ }
      })();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, showTyping, sending]);

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

  const handleShareLocation = async () => {
    PlatformBridge.hapticFeedback('medium');
    setLocating(true);
    showToast('Obteniendo tu ubicación GPS...', 'info');

    try {
      const loc = await PlatformBridge.getLocation();
      if (!loc.success || loc.lat == null || loc.lng == null) {
        throw new Error(loc.error || 'No se pudo obtener la señal GPS');
      }
      const c = { lat: loc.lat, lng: loc.lng };
      setCoords(c);

      if (isBot) {
        await sendMessage('📍 Aquí está mi ubicación. ¿Qué lugares me recomiendas más cerca?', c, 'LOCATION');
      } else {
        await sendMessage('📍 Ubicación compartida', c, 'LOCATION');
      }
      showToast('Ubicación compartida con éxito', 'success');
    } catch (err) {
      console.error('Error al obtener ubicación:', err);
      showToast('No se pudo obtener la señal GPS. Verifica los permisos de tu dispositivo.', 'error');
    } finally {
      setLocating(false);
    }
  };

  const sendMessage = async (
    raw: string,
    explicitCoords?: { lat: number; lng: number } | null,
    msgType?: string,
  ) => {
    const content = raw.trim();
    if (!content || !user || sending) return;

    const isLoc = msgType === 'LOCATION';

    if (!isLoc && /usar mi ubicacion|compartir ubicacion/i.test(content) && !coords && !explicitCoords) {
      handleShareLocation();
      return;
    }

    setInput('');
    setSuggestions([]);
    setSending(true);
    isAtBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    tempCounterRef.current += 1;
    const tempId = `temp-${tempCounterRef.current}`;
    // H-FASE0 · idempotencia de envío: uuid por MENSAJE — si la respuesta se
    // pierde y el usuario reintenta, el server regresa el MISMO mensaje
    // (UNIQUE conversation+clientMessageId) y el optimista se reemplaza, no
    // se duplica.
    const clientMessageId = crypto.randomUUID();
    let metaOut: MessageMetadata | null = isLoc && explicitCoords ? { kind: 'LOCATION', lat: explicitCoords.lat, lng: explicitCoords.lng } as MessageMetadata : null;
    if (replyTo && !isLoc) {
      metaOut = { kind: 'REPLY', replyTo } as MessageMetadata;
    }
    const optimisticType = metaOut && 'kind' in metaOut && typeof (metaOut as { kind?: unknown }).kind === 'string'
      ? (metaOut as { kind: string }).kind
      : (isLoc ? 'LOCATION' : 'TEXT');
    const optimistic: Message = {
      id: tempId,
      senderId: myParticipantId || user.id || 'me',
      content,
      createdAt: new Date().toISOString(),
      type: optimisticType,
      metadata: metaOut,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      // E2E: si hay clave de conversación, el servidor recibe SOLO el cifrado.
      let outgoing = content;
      let outgoingEncrypted = false;
      if (e2eKey && !isLoc) {
        try {
          outgoing = await encryptText(e2eKey, content);
          outgoingEncrypted = true;
        } catch { outgoing = content; outgoingEncrypted = false; }
      }
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetId,
          content: outgoing,
          encrypted: outgoingEncrypted,
          ...(outgoingEncrypted ? { deviceId: getDeviceId() } : {}),
          type: isLoc ? 'LOCATION' : 'TEXT',
          lat: explicitCoords?.lat ?? coords?.lat ?? null,
          lng: explicitCoords?.lng ?? coords?.lng ?? null,
          metadata: metaOut ?? null,
          clientMessageId,
        }),
      });
      const data: SendResponse & { code?: string; error?: string } = await res.json();
      if (!data.success && data.error) {
        // p. ej. REKEY_REQUIRED: el grupo está cambiando de llave.
        showToast(data.error, data.code === 'REKEY_REQUIRED' ? 'info' : 'error');
      }
      if (data.success) {
        if (replyTo) setReplyTo(null);
        setMessages((prev) => {
          // H-FASE0 · delta-safe: reemplaza el optimistic por el id real y
          // evita insertar el server-side si otro tick ya lo trajo (dedupe
          // por id — el worker at-least-once jamás duplica a la vista).
          const known = new Set(prev.filter(m => !m.id.startsWith('temp-')).map(m => m.id));
          const replaced = prev.map((m) => (m.id === tempId && data.message ? data.message : m));
          if (data.message && known.has(data.message.id)) {
            return prev; // el realtime/interval ya lo entregó
          }
          const extra: Message[] = [];
          if (data.botResponse) {
            extra.push(data.botResponse);
            setAnimatingBotMessageIds((prev) => [...prev, data.botResponse!.id]);
          }
          if (data.autoReply) extra.push(data.autoReply);
          return [...replaced, ...extra];
        });
        if (data.suggestions?.length) setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error enviando', err);
      showToast('No se pudo enviar el mensaje — intenta de nuevo', 'error');
    } finally {
      setSending(false);
    }
  };

  // ── H-FASE0 · loadOlder: paginación hacia atrás con `before` = cursor del
  // mensaje MÁS ANTIGUO en pantalla (no del último recibido). ──
  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const id = conversationIdRef.current;
      if (!id) return;
      const oldest = messages[0];
      const before = cursorFromMessage({ createdAt: oldest.createdAt as string, id: oldest.id });
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(
        `/api/chat/history?conversationId=${encodeURIComponent(id)}&before=${encodeURIComponent(before)}`,
        { headers },
      );
      const data = await res.json();
      if (data?.success && Array.isArray(data.messages) && data.messages.length > 0) {
        const known = new Set(messages.map((m: { id: string }) => m.id));
        const older = data.messages.filter((m: { id: string }) => !known.has(m.id));
        setMessages((prev) => [...older, ...prev]);
        setHasOlder(Boolean(data.hasMore));
      } else if (data?.success) {
        setHasOlder(false);
      }
    } catch {
      /* silencioso */
    } finally {
      setLoadingOlder(false);
    }
  };

  const confirmTransfer = async (req: TransferRequest) => {
    if (!req.recipient) {
      sendMessage('¿A quién quieres enviar los bunz? Dame el @usuario.');
      return;
    }

    // Comprobación de seguridad local: biometría primero, PIN como respaldo
    const [{ authorizeSensitiveAction }, { promptForPin }] = await Promise.all([
      import('@/lib/securityVault'),
      import('@/components/security/PinPromptModal'),
    ]);
    const auth = await authorizeSensitiveAction(promptForPin, 'Autoriza el envío de Bunz');
    if (!auth.ok) {
      showToast(
        auth.reason === 'locked'
          ? 'Demasiados intentos. Operación bloqueada por 1 minuto.'
          : 'Operación cancelada por seguridad.',
        'error',
      );
      PlatformBridge.hapticFeedback('error');
      return;
    }
    if (auth.reason === 'none') {
      showToast('Te sugerimos activar PIN o Face ID en Configuración > Seguridad.', 'info');
    } else {
      PlatformBridge.hapticFeedback('success');
    }

    setSending(true);
    tempCounterRef.current += 1;
    const attemptId = tempCounterRef.current;
    try {
      await PlatformBridge.hapticFeedback('medium');
      const headers = await PlatformBridge.getAuthHeaders();
      const idempotencyKey = generateChatTxKey(conversationId, attemptId);
      const sendTransfer = (twoFactor?: { method: string; code: string }) =>
        fetch('/api/wallet/transfer', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: req.recipient.replace(/^@/, ''),
            amount: req.amount,
            note: req.note,
            idempotencyKey,
            twoFactor,
          }),
        });

      let res = await sendTransfer();
      let data = await res.json();

      // Segundo factor exigido por el servidor: pedir código y reintentar con la misma idempotencyKey
      for (let tries = 0; tries < 3 && res.status === 403 && (data.code === '2FA_REQUIRED' || data.code === '2FA_INVALID'); tries++) {
        const { promptForTwoFactor } = await import('@/components/security/TwoFactorPromptModal');
        const proof = await promptForTwoFactor(data.methods, data.code === '2FA_INVALID' ? data.error : undefined);
        if (!proof) throw new Error('Operación cancelada: falta la verificación en dos pasos.');
        res = await sendTransfer(proof);
        data = await res.json();
      }
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

  const runBunzy = async (mode: 'draft' | 'summarize' | 'admin_qa' | 'marketing_proposal') => {
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
          // Storage: el binario va al bucket privado (no a jsonb). El mensaje
          // guarda solo la key y se reproduce vía /api/chat/media/<key>.
          const uploaded = await uploadChatMedia(blob, durationMs, 'voice', Boolean(e2eKey));
          if (!uploaded) {
            PlatformBridge.hapticFeedback('error');
            showToast('No se pudo subir la nota de voz', 'error');
            return;
          }
          sendVoiceNote(uploaded.key, durationMs);
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

  /** Sube un binario (voz/foto) al bucket privado. Devuelve la key o null. */
  const uploadChatMedia = async (
    blob: Blob,
    durationMs: number,
    kind: 'voice' | 'image',
    encrypt = false,
  ): Promise<{ key: string } | null> => {
    try {
      const id = conversationIdRef.current;
      if (!id) return null;
      // E2E: el binario se cifra ANTES de salir del dispositivo.
      let outgoing: Blob = blob;
      if (encrypt && e2eKey) {
        try {
          const plain = await blob.arrayBuffer();
          const ct = await encryptBytes(e2eKey, plain);
          outgoing = new Blob([ct], { type: blob.type });
        } catch { outgoing = blob; }
      }
      const headers = await PlatformBridge.getAuthHeaders();
      // FormData: NO fijar Content-Type (el navegador pone el boundary).
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers || {})) {
        if (k.toLowerCase() !== 'content-type') clean[k] = String(v);
      }
      const form = new FormData();
      form.append('file', outgoing, kind === 'voice' ? 'voice.webm' : 'image.webp');
      form.append('conversationId', id);
      form.append('durationMs', String(Math.round(durationMs || 0)));
      const res = await fetch('/api/chat/media', { method: 'POST', headers: clean, body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.key) {
        console.warn('[chat] media upload falló:', res.status, data?.error);
        return null;
      }
      return { key: String(data.key) };
    } catch (err) {
      console.warn('[chat] media upload error:', err);
      return null;
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

  const sendVoiceNote = (mediaKey: string, durationMs: number) => {
    if (!conversationId || sending) return;
    tempCounterRef.current += 1;
    const tempId = `temp-${tempCounterRef.current}`;
    const mediaUrl = `/api/chat/media/${mediaKey.split('/').map(encodeURIComponent).join('/')}`;
    // Reproducción inmediata: la URL ya está autenticada por sesión.
    setVoiceSrcMap((prev) => ({ ...prev, [tempId]: mediaUrl }));
    const meta = { kind: 'VOICE', key: mediaKey, durationMs, e2e: Boolean(e2eKey) } as unknown as MessageMetadata;
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
          const realId = (data.message as Message).id;
          if (realId) {
            setVoiceSrcMap((prev) => ({ ...prev, [realId]: prev[tempId] || mediaUrl }));
          }
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

  // ── E2E: preparar identidad + clave de conversación (solo DIRECT + PEER) ──
  useEffect(() => {
    if (chatAudience !== 'PEER') { setE2eKey(null); return; }
    if (chatKind !== 'DIRECT' && chatKind !== 'GROUP') { setE2eKey(null); return; }

    const convId = typeof conversationId === 'string' ? conversationId : null;
    const myId = user?.id;
    if (!convId || !myId) return;

    // DIRECT → el otro usuario. GROUP → todos los miembros activos.
    let peers: string[] = [];
    if (chatKind === 'DIRECT') {
      const peer = typeof targetId === 'string' ? targetId : null;
      if (!peer || !/^[0-9a-f-]{36}$/i.test(peer)) return;
      peers = [peer];
    } else {
      peers = (groupInfo?.members ?? [])
        .map((m) => m.userId)
        .filter((id) => id !== myId && /^[0-9a-f-]{36}$/i.test(id));
      if (peers.length === 0) return;
    }

    let alive = true;
    (async () => {
      try {
        const me = await ensureIdentity();
        if (!alive || !me) return;
        const key = await ensureConversationKey(convId, me, myId, peers, e2eVersion);
        if (alive && key) setE2eKey(key);
      } catch { /* sin cifrado: se mantiene en claro */ }
    })();
    return () => { alive = false; };
  }, [chatKind, chatAudience, conversationId, targetId, user?.id, groupInfo, e2eVersion]);

  // ── E2E: descifrar lo que llega cifrado (una vez por mensaje) ──
  useEffect(() => {
    if (!e2eKey) return;
    const pending = messages.filter((m) => m.encrypted && !decryptedIds.current.has(m.id));
    if (pending.length === 0) return;
    let alive = true;
    (async () => {
      const updates = new Map<string, string>();
      for (const m of pending) {
        try {
          updates.set(m.id, await decryptText(e2eKey, m.content));
          decryptedIds.current.add(m.id);
        } catch { /* mensaje de otra clave: se deja el marcador */ }
      }
      if (alive && updates.size > 0) {
        setMessages((prev) => prev.map((m) => (updates.has(m.id) ? { ...m, content: updates.get(m.id)!, encrypted: false } : m)));
      }
    })();
    return () => { alive = false; };
  }, [messages, e2eKey]);

  // ── E2E: descifrar media (voz/foto) antes de mostrarla ──
  useEffect(() => {
    if (!e2eKey) return;
    const pending = messages.filter((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      if (!meta || meta.e2e !== true || typeof meta.key !== 'string') return false;
      if (e2eMediaPending.current.has(m.id)) return false;
      if (meta.kind === 'IMAGE' && e2eMedia[m.id]) return false;
      if (meta.kind === 'VOICE' && voiceSrcMap[m.id]) return false;
      return true;
    });
    if (pending.length === 0) return;
    let alive = true;
    (async () => {
      for (const m of pending) {
        const meta = m.metadata as Record<string, unknown>;
        e2eMediaPending.current.add(m.id);
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const proxy = `/api/chat/media/${String(meta.key).split('/').map(encodeURIComponent).join('/')}`;
          const res = await fetch(proxy, { headers });
          if (!res.ok) continue;
          const plain = await decryptBytes(e2eKey, await res.arrayBuffer());
          const mime = meta.kind === 'VOICE' ? 'audio/webm' : 'image/webp';
          const url = URL.createObjectURL(new Blob([plain], { type: mime }));
          if (!alive) return;
          if (meta.kind === 'VOICE') setVoiceSrcMap((prev) => (prev[m.id] ? prev : { ...prev, [m.id]: url }));
          else setE2eMedia((prev) => ({ ...prev, [m.id]: url }));
        } catch { /* queda el placeholder */ }
      }
    })();
    return () => { alive = false; };
  }, [messages, e2eKey, e2eMedia, voiceSrcMap]);

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
            router.push(`/affiliate/${target.id}`);
          }}
          style={{ flex: 1, border: 'none', background: '#E91E63', color: '#FFF', fontWeight: 800, fontSize: '13px', padding: '11px', cursor: 'pointer' }}
        >
          🏪 Ver Sucursal
        </button>
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('medium');
            router.push(`/chat/${target.id}`);
          }}
          style={{ flex: 1, border: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 800, fontSize: '13px', padding: '11px', cursor: 'pointer' }}
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
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {options.map((o) => {
        return (
          <div
            key={o.businessId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '12px',
              borderRadius: '18px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Header info con avatar/cover */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'rgba(233,30,99,0.1)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {o.logoUrl ? (
                  <Image src={o.logoUrl} alt={o.businessName} width={48} height={48} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '22px' }}>🏪</span>
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.businessName}
                  </p>
                  {o.rewardPercentage != null && (
                    <span style={{ flexShrink: 0, fontSize: '10.5px', fontWeight: 800, color: '#E91E63', background: 'rgba(233,30,99,0.15)', padding: '2px 7px', borderRadius: '999px', border: '1px solid rgba(233,30,99,0.3)' }}>
                      +{o.rewardPercentage}% bunz
                    </span>
                  )}
                </div>

                <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[o.category, o.distanceKm != null ? `${o.distanceKm.toFixed(1)} km` : null].filter(Boolean).join(' · ')}
                </p>

                <p style={{ margin: '4px 0 0', fontSize: '11px', fontWeight: 700, color: o.openNow === false ? '#EF4444' : '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: o.openNow === false ? '#EF4444' : '#10B981' }} />
                  {o.openNow === false ? 'Cerrado' : 'Abierto ahora'}
                </p>
              </div>
            </div>

            {/* Botones inferiores con layout espacioso */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  router.push(`/affiliate/${o.businessId}`);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-pressed)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                <span>🏪</span>
                <span>Ver sucursal</span>
              </button>

              {o.acceptsBunz !== false && (
                <button
                  type="button"
                  onClick={() => openOrder({ businessId: o.businessId, businessName: o.businessName })}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #E91E63 0%, #FF4081 100%)',
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: '12px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(233,30,99,0.3)',
                  }}
                >
                  <span>🛒</span>
                  <span>Pedir</span>
                </button>
              )}
            </div>
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

  // ── Fotos (con "ver una vez") ──
  // Borrador de foto: se elige, se previsualiza y AHÍ se decide "una vez".
  // Por defecto va normal (como WhatsApp).
  const [photoDraft, setPhotoDraft] = useState<{ file: File; url: string; viewOnce: boolean } | null>(null);
  // Menú de acciones por mensaje (reaccionar / editar / eliminar)
  const [msgMenu, setMsgMenu] = useState<Message | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string; content: string } | null>(null);
  const [viewOnceUnlocked, setViewOnceUnlocked] = useState<Record<string, boolean>>({});
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  /** Comprime en el cliente (máx 1600px, WebP) para no gastar datos ni storage. */
  const compressImage = async (file: File): Promise<Blob | null> => {
    try {
      const bitmap = await createImageBitmap(file);
      const max = 1600;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.8),
      );
      return blob ?? file;
    } catch {
      return file;
    }
  };

  const pickPhoto = (file: File | null) => {
    if (!file || !conversationId) return;
    PlatformBridge.hapticFeedback('light');
    setPhotoDraft({ file, url: URL.createObjectURL(file), viewOnce: false });
  };

  const discardPhotoDraft = () => {
    if (photoDraft?.url) { try { URL.revokeObjectURL(photoDraft.url); } catch { /* noop */ } }
    setPhotoDraft(null);
  };

  const sendPhotoDraft = async () => {
    if (!photoDraft || !conversationId || sending) return;
    const viewOnce = photoDraft.viewOnce;
    const file = photoDraft.file;
    discardPhotoDraft();
    PlatformBridge.hapticFeedback('medium');
    setSending(true);
    try {
      const blob = (await compressImage(file)) ?? file;
      if (blob.size > 5 * 1024 * 1024) {
        showToast('La foto es muy grande (máx 5 MB)', 'error');
        return;
      }
      const uploaded = await uploadChatMedia(blob, 0, 'image', Boolean(e2eKey));
      if (!uploaded) { showToast('No se pudo subir la foto', 'error'); return; }

      tempCounterRef.current += 1;
      const tempId = `temp-${tempCounterRef.current}`;
      const meta = { kind: 'IMAGE', key: uploaded.key, viewOnce, e2e: Boolean(e2eKey) } as unknown as MessageMetadata;
      const optimistic: Message = {
        id: tempId,
        senderId: myParticipantId || user?.id || '',
        content: viewOnce ? '🔒 Foto (una vista)' : '📷 Foto',
        createdAt: new Date().toISOString(),
        type: 'IMAGE',
        metadata: meta,
      };
      setMessages((prev) => [...prev, optimistic]);

      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId, targetId,
          content: viewOnce ? '🔒 Foto (una vista)' : '📷 Foto',
          type: 'IMAGE', metadata: meta,
          clientMessageId: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success && data.message) {
        const real = data.message as Message;
        setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, content: '📷 Foto (no enviada)' } : m)));
      }
    } catch {
      showToast('No se pudo enviar la foto', 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Reaccionar / editar / eliminar ──
  const reactTo = async (msgId: string, emoji: string) => {
    PlatformBridge.hapticFeedback('light');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/chat/messages/${msgId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        const counts = (data.counts ?? {}) as Record<string, number>;
        const mine = (data.myReactions ?? []) as string[];
        setMessages((prev) => prev.map((m) => (m.id === msgId
          ? { ...m, reactions: Object.entries(counts).map(([e, count]) => ({ emoji: e, count: Number(count), mine: mine.includes(e) })) }
          : m)));
      }
    } catch { /* noop */ }
    setMsgMenu(null);
  };

  const saveEdit = async () => {
    if (!editingMsg) return;
    const content = editingMsg.content.trim();
    if (!content) return;
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/chat/messages/${editingMsg.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? { ...m, content, editedAt: new Date().toISOString() } : m)));
        showToast('Mensaje editado', 'success');
      } else {
        showToast(data?.error || 'No se pudo editar', 'error');
      }
    } catch { showToast('No se pudo editar', 'error'); }
    setEditingMsg(null);
  };

  // Ventana para eliminar "para todos" (1 h). Después solo "para mí".
  const DELETE_FOR_ALL_MS = 60 * 60 * 1000;
  const canDeleteForAll = (msg: Message) => {
    if (msg.senderId !== (myParticipantId || user?.id)) return false;
    const ts = msg.createdAt ? Date.parse(msg.createdAt) : NaN;
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= DELETE_FOR_ALL_MS;
  };

  const deleteMessage = async (msg: Message, forEveryone: boolean) => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/chat/messages/${msg.id}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ forEveryone }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setMessages((prev) =>
          forEveryone
            // "Para todos": el mensaje queda visible como eliminado.
            ? prev.map((m) => (m.id === msg.id ? { ...m, content: '', type: 'DELETED', metadata: null } : m))
            // "Para mí": desaparece de MI vista (el otro no se entera).
            : prev.filter((m) => m.id !== msg.id),
        );
        showToast(forEveryone ? 'Mensaje eliminado para todos' : 'Eliminado solo para ti', 'success');
      } else {
        showToast(data?.error || 'No se pudo eliminar', 'error');
      }
    } catch { showToast('No se pudo eliminar', 'error'); }
    setMsgMenu(null);
  };

  /** "Ver una vez": avisa al server, que marca viewedAt y BORRA el archivo. */
  const openViewOnce = async (msgId: string, key: string) => {
    PlatformBridge.hapticFeedback('medium');
    // E2E: el archivo se BORRA al marcarlo como visto, así que hay que
    // descifrarlo antes (si no, ya no habría nada que abrir).
    if (e2eKey && !e2eMedia[msgId]) {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const proxy = `/api/chat/media/${key.split('/').map(encodeURIComponent).join('/')}`;
        const res = await fetch(proxy, { headers });
        if (res.ok) {
          const plain = await decryptBytes(e2eKey, await res.arrayBuffer());
          const url = URL.createObjectURL(new Blob([plain], { type: 'image/webp' }));
          setE2eMedia((prev) => ({ ...prev, [msgId]: url }));
        }
      } catch { /* si falla, se verá el placeholder */ }
    }
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/media/viewed', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) setViewOnceUnlocked((prev) => ({ ...prev, [msgId]: true }));
      else showToast('Ya no está disponible', 'info');
    } catch { /* noop */ }
  };

  const renderContent = (msg: Message, isMe = false) => {
    if (msg.type === 'DELETED') {
      return <span style={{ fontStyle: 'italic', opacity: 0.6 }}>🚫 Mensaje eliminado</span>;
    }
    const meta: MessageMetadata | null =
      msg.metadata && typeof msg.metadata === 'object' ? msg.metadata : null;

    if (meta && typeof meta === 'object' && 'kind' in meta) {
      const m = meta as Record<string, unknown>;
      if (m.kind === 'VOICE') {
        const src =
          (typeof m.voiceUrl === 'string' && m.voiceUrl) ||
          (msg.id && voiceSrcMap[msg.id]) ||
          (typeof m.voiceDataUrl === 'string' && m.voiceDataUrl) ||
          null;
        const dur = typeof m.durationMs === 'number' ? m.durationMs : 0;
        return (
          <VoiceNoteBubble
            msgId={msg.id}
            src={src}
            rawSrc={(typeof m.voiceUrl === 'string' && m.voiceUrl) ||
              (typeof m.voiceDataUrl === 'string' && m.voiceDataUrl) ||
              null}
            durationMs={dur}
            isMe={isMe}
            createdAt={msg.createdAt}
            read={Boolean(msg.readAt)}
            showTicks={isMe && !isBot}
          />
        );
      }
      // ── Fotos (con "ver una vez") ──
      if (m.kind === 'IMAGE' && typeof m.key === 'string') {
        const key = m.key as string;
        const proxySrc = `/api/chat/media/${key.split('/').map(encodeURIComponent).join('/')}`;
        const isE2E = m.e2e === true;
        const src = isE2E ? (e2eMedia[msg.id] ?? '') : proxySrc;
        const viewOnce = Boolean(m.viewOnce);
        const alreadyViewed = typeof m.viewedAt === 'string' && m.viewedAt.length > 0;
        const unlocked = Boolean(viewOnceUnlocked[msg.id]) || alreadyViewed;

        if (viewOnce && !unlocked) {
          return (
            <button
              type="button"
              onClick={() => void openViewOnce(msg.id, key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
                borderRadius: 14, border: '1px dashed rgba(255,255,255,0.28)',
                background: 'rgba(0,0,0,0.22)', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 18 }}>🔒</span>
              <span>
                Foto de una sola vista
                <span style={{ display: 'block', fontSize: 10, opacity: 0.6, fontWeight: 600 }}>
                  Toca para ver · se borra al abrirla
                </span>
              </span>
            </button>
          );
        }

        if (isE2E && !src) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.22)', border: '1px dashed rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
              🔒 Descifrando foto…
            </div>
          );
        }

        return (
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', maxWidth: 260 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Foto"
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 14 }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            {viewOnce && alreadyViewed && (
              <span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 6px', borderRadius: 6 }}>
                Vista · ya no disponible
              </span>
            )}
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
            {cleanOrEmpty(msg.content) && renderFormattedMarkdown(cleanOrEmpty(msg.content))}
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
              {cleanOrEmpty(msg.content) && renderFormattedMarkdown(cleanOrEmpty(msg.content))}
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
        const isAnimating = animatingBotMessageIds.includes(msg.id);
        return (
          <>
            {cleanOrEmpty(msg.content) && (
              isAnimating ? (
                <TypewriterText
                  text={cleanOrEmpty(msg.content)}
                  onComplete={() => {
                    setAnimatingBotMessageIds((prev) => prev.filter((id) => id !== msg.id));
                  }}
                />
              ) : (
                renderFormattedMarkdown(cleanOrEmpty(msg.content))
              )
            )}
            {!isAnimating && renderOptions(typedMeta.options as BusinessOption[])}
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

    const isAnimating = animatingBotMessageIds.includes(msg.id);

    return (
      <>
        {cleanText && (
          isAnimating ? (
            <TypewriterText
              text={cleanText}
              onComplete={() => {
                setAnimatingBotMessageIds((prev) => prev.filter((id) => id !== msg.id));
              }}
            />
          ) : (
            renderFormattedMarkdown(cleanText)
          )
        )}
        {!isAnimating && target && renderBusinessCard(target)}
      </>
    );
  };

  const isTypingActive = (isBot && (sending || animatingBotMessageIds.length > 0)) || showTyping;
  // H21: 'online' real — no decorativo. La API de mensajes regresa partnerOnline
  // (presenciaSession abierta del par en los últimos 5 min); cae a Fuera de línea.
  const headerStatus = chatKind === 'GROUP'
    ? `${groupInfo?.members.length ?? 0} miembro${(groupInfo?.members.length ?? 0) === 1 ? '' : 's'} · privado`
    : isTypingActive
    ? 'escribiendo…'
    : isBot
      ? 'Bunzy IA en línea'
      : businessOpen === false
        ? 'Fuera de horario'
        : partnerOnline === true
          ? 'En línea'
          // Negocio: su presencia real es "abierto/cerrado". "Sin conexión" era
          // engañoso porque el local contesta desde el POS o el admin.
          : businessOpen !== null
            ? (businessOpen ? 'Abierto' : 'Fuera de horario')
            : partnerOnline === false
              ? 'Sin conexión'
              : 'Rabbitty';
  const headerColor = isTypingActive ? 'var(--rabbitty-pink)' : isBot || businessOpen !== false ? '#4CAF50' : '#9E9E9E';

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: vvStyle.top,
        height: vvStyle.height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at top, rgba(233, 30, 99, 0.07) 0%, #09090D 55%, #050507 100%)',
        fontFamily: 'var(--font-family-base)',
      }}
    >
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(var(--safe-top, 0px) + 6px) 12px 8px',
          background: 'linear-gradient(180deg, rgba(5,5,7,0.72) 0%, rgba(5,5,7,0) 100%)',
          pointerEvents: 'none',
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
            pointerEvents: 'auto',
            background: 'rgba(28, 28, 34, 0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            color: '#FFFFFF',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            flexShrink: 0,
          }}
        >
          <svg width="10" height="17" viewBox="0 0 10 18" fill="none" style={{ transform: 'translateX(-1px)' }}>
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 1, pointerEvents: 'none' }}>
          <button
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              // En un grupo el header abre miembros/salir, no el perfil.
              if (chatKind === 'GROUP') setGroupSheetOpen(true);
              else setTargetInfoOpen(true);
            }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              background: 'rgba(28, 28, 34, 0.78)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 999,
              padding: '5px 22px',
              minWidth: 132,
              maxWidth: '62vw',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', lineHeight: 1.15 }}>
              {targetName}
            </span>
            <span style={{ fontSize: 11.5, color: headerColor, fontWeight: 500, lineHeight: 1.1 }}>
              {e2eKey ? '🔒 ' : ''}{headerStatus}
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => { PlatformBridge.hapticFeedback('light'); setSearchOpen(true); }}
          aria-label="Buscar en la conversación"
          title="Buscar en el historial"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, fontSize: 16, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
        >
          🔍
        </button>
        <button
          onClick={() => { PlatformBridge.hapticFeedback('light'); setTargetInfoOpen(true); }}
          aria-label={`Perfil de ${targetName}`}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: isBot ? 'var(--rabbitty-pink)' : 'rgba(28, 28, 34, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: '0 4px 16px rgba(0,0,0,0.35)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
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
                if (typeof navigator !== 'undefined' && navigator.share) {
                  navigator.share({ title: targetName, text: `Chat con ${targetName} en Rabbitty`, url: window.location.href }).catch(() => {});
                } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    showToast('Enlace copiado al portapapeles', 'success');
                  }).catch(() => {
                    showToast('Enlace copiado', 'info');
                  });
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
          ) : (targetRole === 'AFFILIATE' || isBusinessInbox) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {targetBusinessId && (
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
              )}

              {/* Affiliate Action: Darle un Boost Directo — SOLO si el usuario
                  es el DUEÑO del negocio (probe GET /business/campaigns) */}
              {targetBusinessIsOwner && (
              <button
                type="button"
                onClick={async () => {
                  PlatformBridge.hapticFeedback('medium');
                  setTargetInfoOpen(false);
                  setBoostSheetOpen(true);
                  // Consultar si ya existe un boost activo para no apilar campañas
                  const bizIdForBoost = targetBusinessId || user?.id;
                  if (bizIdForBoost) {
                    setLoadingActiveBoost(true);
                    setActiveBoostCampaign(null);
                    try {
                      const hdrs = await PlatformBridge.getAuthHeaders();
                      const res = await fetch(`/api/business/campaigns?businessId=${bizIdForBoost}`, { headers: hdrs });
                      const data = await res.json();
                      const now = Date.now();
                      const active = (data.campaigns || []).find(
                        (c: { campaignType: string; status: string; expiresAt: string }) =>
                          c.campaignType === 'FLASH_OFFER' && c.status === 'ACTIVE' && new Date(c.expiresAt).getTime() > now
                      );
                      if (active) {
                        setActiveBoostCampaign({ id: active.id, rewardPercentage: active.rewardPercentage, budgetBunz: active.budgetBunz, budgetSpent: active.budgetSpent, expiresAt: active.expiresAt });
                        setBoostPercentage(active.rewardPercentage);
                      }
                    } catch { /* falla silenciosa: el sheet funciona igual */ }
                    setLoadingActiveBoost(false);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(233,30,99,0.15) 0%, rgba(255,138,0,0.15) 100%)',
                  border: '1px solid rgba(233,30,99,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#E91E63',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E91E63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={18} color="#FFFFFF" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, display: 'block', color: 'var(--text-primary)' }}>⚡ Dar un Flash Boost</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Asignar % especial en radar y mapa</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#E91E63' }}>Activar ›</span>
              </button>
              )}
            </div>
          ) : null}
        </div>
      </BottomSheet>

      <main
        ref={mainRef}
        onScroll={handleMainScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: 'calc(var(--safe-top, 0px) + 58px) 10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {!loading && messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px', maxWidth: '320px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(233,30,99,0.1)', color: 'var(--rabbitty-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 16px' }}>
              {isBot ? '🐰' : '💬'}
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
              {isBot ? '¡Hola, soy Bunzy!' : 'Conversación iniciada'}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isBot
                ? 'Pregúntame por cafés cercanos, recompensas o promociones en tu ciudad.'
                : 'Aún no hay mensajes en este canal. ¡Sé el primero en escribir!'}
            </p>
          </div>
        )}
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
          <>
          {hasOlder && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
              <button
                type="button"
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
                className="cursor-pointer active:scale-95 transition-transform border-none"
                style={{
                  background: 'var(--bg-pressed)',
                  color: 'var(--text-muted)',
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '5px 12px',
                  borderRadius: 999,
                  opacity: loadingOlder ? 0.6 : 1,
                }}
              >
                {loadingOlder ? 'Cargando…' : 'Mensajes anteriores'}
              </button>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === myParticipantId;
            const isSelected = selectedIds.includes(msg.id);
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
            const sameAsPrev = Boolean(prevMsg && (prevMsg.senderId === myParticipantId) === isMe);
            const sameAsNext = Boolean(nextMsg && (nextMsg.senderId === myParticipantId) === isMe);
            const bubbleRadius = isMe
              ? `${18}px ${sameAsPrev ? 8 : 18}px ${sameAsNext ? 8 : 4}px ${18}px`
              : `${sameAsPrev ? 8 : 18}px ${18}px ${18}px ${sameAsNext ? 8 : 4}px`;
            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id || idx}
                style={{
                  display: 'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  width: '100%',
                  position: 'relative',
                  marginTop: idx > 0 && !sameAsPrev ? 6 : 0,
                }}
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
                  style={{ cursor: selectMode ? 'pointer' : 'grab', position: 'relative', zIndex: 1, maxWidth: '82%' }}
                >
                <div
                  style={{
                    position: 'relative',
                    padding: '7px 11px 6px 12px',
                    background: isMe
                      ? 'linear-gradient(135deg, #FF2E93 0%, #E11D74 100%)'
                      : 'rgba(28, 28, 34, 0.92)',
                    backdropFilter: isMe ? undefined : 'blur(16px)',
                    WebkitBackdropFilter: isMe ? undefined : 'blur(16px)',
                    color: '#FFFFFF',
                    borderRadius: bubbleRadius,
                    boxShadow: isMe
                      ? '0 2px 10px rgba(233, 30, 99, 0.22)'
                      : '0 1px 4px rgba(0, 0, 0, 0.28)',
                    border: isSelected
                      ? '2px solid #FCD34D'
                      : isMe
                      ? 'none'
                      : '1px solid rgba(255, 255, 255, 0.07)',
                    outline: isSelected ? '2px solid rgba(252,211,77,0.5)' : 'none',
                  }}
                >
                  {msg.type === 'AUTO_REPLY' && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '2px',
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
                        <div style={{ marginBottom: 5, paddingLeft: 8, borderLeft: `2.5px solid ${isMe ? 'rgba(255,255,255,0.85)' : '#FF2E93'}`, background: isMe ? 'rgba(0,0,0,0.16)' : 'rgba(233,30,99,0.1)', borderRadius: 6, padding: '3px 8px' }}>
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isMe ? '#FFFFFF' : '#FF4D9E' }}>
                            {rt.sender === 'user' ? 'Tú' : targetName}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, opacity: 0.82, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {rt.text || ''}
                          </span>
                        </div>
                      );
                    }
                    if (!isMe && meta && meta.kind === 'FORWARDED' && meta.forwardedFrom && typeof meta.forwardedFrom === 'object') {
                      const ff = meta.forwardedFrom as { name?: string };
                      return (
                        <div style={{ marginBottom: 3, fontSize: 11, fontWeight: 700, color: '#FF4D9E' }}>↪ Reenviado de {ff.name || 'contacto'}</div>
                      );
                    }
                    return null;
                  })()}
                  <div style={{ fontSize: '16px', lineHeight: '1.34', wordBreak: 'break-word' }}>
                    <div
                      onTouchStart={() => {
                        if (isBot) return;
                        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                        pressTimerRef.current = setTimeout(() => {
                          pressTimerRef.current = null;
                          PlatformBridge.hapticFeedback('medium');
                          setMsgMenu(msg);
                        }, 450);
                      }}
                      onTouchEnd={() => { if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; } }}
                      onTouchMove={() => { if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; } }}
                      onContextMenu={(e) => { if (isBot) return; e.preventDefault(); setMsgMenu(msg); }}
                    >
                    {chatKind === 'GROUP' && !isMe && msg.senderId !== myParticipantId && (
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#FF4D9E', marginBottom: 2 }}>
                        {groupInfo?.members.find((m) => m.userId === msg.senderId)?.name ?? 'Rabbitty'}
                      </span>
                    )}
                    {renderContent(msg, isMe)}
                    {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                      <span style={{ display: 'inline-flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {msg.reactions.map((r) => (
                          <span
                            key={r.emoji}
                            style={{
                              fontSize: 11, padding: '1px 6px', borderRadius: 999,
                              background: r.mine ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)',
                              border: '1px solid rgba(255,255,255,0.18)', lineHeight: 1.5,
                            }}
                          >
                            {r.emoji}{r.count > 1 ? ` ${r.count}` : ''}
                          </span>
                        ))}
                      </span>
                    )}
                    {!(msg.type === 'VOICE' || (msg.metadata && typeof msg.metadata === 'object' && (msg.metadata as Record<string, unknown>).kind === 'VOICE')) && (
                      <span
                        style={{
                          float: 'right',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                          lineHeight: 1,
                          marginLeft: '9px',
                          marginTop: '6px',
                          marginBottom: '-1px',
                          color: isMe ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.42)',
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                          userSelect: 'none',
                        }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && !isBot && <CheckTicks read={Boolean(msg.readAt)} />}

                      </span>
                    )}
                    </div>
                  </div>
                  {msgReactions[msg.id] && (
                    <div style={{ position: 'absolute', bottom: -12, [isMe ? 'left' : 'right']: 8, background: 'rgba(28, 28, 34, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '2px 7px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.35)', lineHeight: 1.2 } as React.CSSProperties}>
                      {msgReactions[msg.id]}
                    </div>
                  )}
                </div>
                </motion.div>
              </motion.div>
            );
          })
          }
          </>
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
          position: 'relative',
          zIndex: 40,
          padding: '6px 10px',
          paddingBottom: keyboardOpen
            ? '6px'
            : 'calc(max(var(--safe-bottom, 0px), env(safe-area-inset-bottom, 16px)) + 6px)',
          backgroundColor: 'rgba(12, 12, 16, 0.78)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Botón flotante ir al final (estilo Telegram iOS) */}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }}
            aria-label="Ir al final"
            style={{
              position: 'absolute',
              top: -48,
              right: 12,
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(28, 28, 34, 0.88)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
              cursor: 'pointer',
              zIndex: 45,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}

        {(suggestions.length > 0 || isBusinessInbox) && !keyboardOpen && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
            {(isBusinessInbox ? BUSINESS_TEMPLATES : suggestions).map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  if (isBusinessInbox) setInput(chip);
                  else if (/usar mi ubicaci[oó]n|compartir ubicaci[oó]n/i.test(chip)) handleShareLocation();
                  else sendMessage(chip);
                }}
                style={{
                  flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '100px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.78)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {!isBot && bunzyNote && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              background: 'rgba(28, 28, 34, 0.92)',
              border: '1px solid rgba(233, 30, 99, 0.3)',
              borderRadius: '14px',
              padding: '7px 10px',
            }}
          >
            <span style={{ flex: 1, fontSize: '12px', lineHeight: 1.35, color: 'rgba(255,255,255,0.85)' }}>
              <strong style={{ color: '#FF4D9E' }}>Bunzy:</strong> {bunzyNote.text}
            </span>
            {(bunzyNote.mode === 'draft' || bunzyNote.mode === 'marketing_proposal') && (
              <button
                type="button"
                onClick={() => {
                  setInput(bunzyNote.text);
                  setBunzyNote(null);
                }}
                style={{ border: 'none', background: '#E91E63', color: '#fff', borderRadius: '100px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
              >
                Usar
              </button>
            )}
            <button
              type="button"
              onClick={() => setBunzyNote(null)}
              style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        )}

        {replyTo && !selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: 'rgba(28, 28, 34, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #FF2E93', borderRadius: 12, padding: '6px 10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#FF4D9E' }}>
                ↩ Respondiendo a {replyTo.sender === 'user' ? 'Tú' : targetName}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyTo.text}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancelar respuesta"
              style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 15, cursor: 'pointer', padding: 4 }}
            >
              ✕
            </button>
          </div>
        )}

        {!selectMode && recording && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              aria-label="Cancelar grabación"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#EF4444', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
            >
              🗑️
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(28, 28, 34, 0.9)', border: '1px solid #FF2E93', borderRadius: 100, padding: '8px 14px' }}>
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF2E93', flexShrink: 0 }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                Grabando… 0:{String(recordDuration).padStart(2, '0')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              aria-label="Enviar nota de voz"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #FF2E93 0%, #E11D74 100%)', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
            >
              ➤
            </button>
          </div>
        )}

        {/* Búsqueda en el historial */}
        {searchOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setSearchOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', left: 0, right: 0, top: 0,
                maxHeight: '80vh', background: '#141418',
                borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                padding: 'calc(12px + env(safe-area-inset-top, 0px)) 14px 16px',
                display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={async (e) => {
                    const q = e.target.value;
                    setSearchTerm(q);
                    const term = q.trim();
                    if (term.length < 2) { setSearchHits([]); return; }

                    // ── Chats cifrados (PEER): se busca en el cliente ──
                    // El servidor no puede indexar contenido cifrado, así que se
                    // filtra lo que ya está descargado y descifrado en pantalla.
                    if (chatAudience === 'PEER') {
                      const lower = term.toLowerCase();
                      const hits = messages
                        .filter((m) => !m.encrypted && typeof m.content === 'string' && m.content.toLowerCase().includes(lower))
                        .slice(-60)
                        .reverse()
                        .map((m) => ({
                          id: m.id,
                          content: m.content,
                          createdAt: m.createdAt,
                          senderName: m.senderId === myParticipantId ? 'Tú' : undefined,
                        }));
                      setSearchHits(hits);
                      return;
                    }

                    setSearchBusy(true);
                    try {
                      const headers = await PlatformBridge.getAuthHeaders();
                      const url = `/api/chat/search?q=${encodeURIComponent(term)}${conversationId ? `&conversationId=${encodeURIComponent(conversationId)}` : ''}`;
                      const res = await fetch(url, { headers });
                      const data = await res.json().catch(() => null);
                      if (data?.success) setSearchHits(data.results ?? []);
                    } catch { /* noop */ } finally { setSearchBusy(false); }
                  }}
                  placeholder="Buscar en el historial…"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontSize: 14, padding: '11px 12px', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  Cerrar
                </button>
              </div>

              {chatAudience === 'PEER' && (
                <p style={{ margin: '8px 2px 0', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                  🔒 Chat cifrado: la búsqueda revisa los mensajes ya cargados en este dispositivo.
                </p>
              )}

              <div style={{ marginTop: 10, overflowY: 'auto' }}>
                {searchBusy && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 10 }}>Buscando…</p>}
                {!searchBusy && searchTerm.trim().length >= 2 && searchHits.length === 0 && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 12 }}>
                    {chatAudience === 'PEER'
                      ? 'Sin coincidencias en los mensajes cargados'
                      : 'Sin resultados'}
                  </p>
                )}
                {searchHits.map((h) => (
                  <div key={h.id} style={{ padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#fff', lineHeight: 1.35 }}>{h.content}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                      {h.senderName ? `${h.senderName} · ` : ''}{new Date(h.createdAt).toLocaleString('es-MX')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hoja del grupo: miembros + salir */}
        {groupSheetOpen && groupInfo && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 78, background: 'rgba(0,0,0,0.65)' }}
            onClick={() => setGroupSheetOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                background: '#141418', borderTopLeftRadius: 22, borderTopRightRadius: 22,
                borderTop: '1px solid rgba(255,255,255,0.12)',
                padding: '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
                maxHeight: '72vh', overflowY: 'auto',
              }}
            >
              <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#fff' }}>
                {groupInfo.name || 'Grupo'}
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                {groupInfo.members.length} miembro{groupInfo.members.length === 1 ? '' : 's'} · privado entre Rabbitters
              </p>

              {groupInfo.members.map((m) => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,46,147,0.18)', border: '1px solid rgba(255,46,147,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#FF4D9E' }}>
                    {(m.name || 'R').charAt(0).toUpperCase()}
                  </div>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}{m.userId === myParticipantId ? ' (tú)' : ''}
                  </span>
                  {m.role === 'ADMIN' && (
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#FFD166', background: 'rgba(255,209,102,0.12)', border: '1px solid rgba(255,209,102,0.3)', borderRadius: 999, padding: '2px 7px' }}>
                      ADMIN
                    </span>
                  )}
                </div>
              ))}

              {(() => {
                const myRole = groupInfo.members.find((m) => m.userId === myParticipantId)?.role;
                if (myRole !== 'ADMIN') return null;
                const existing = new Set(groupInfo.members.map((m) => m.userId));
                return (
                  <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.45)' }}>
                      Añadir personas
                    </p>
                    <input
                      value={groupAddQuery}
                      onChange={async (e) => {
                        const q = e.target.value;
                        setGroupAddQuery(q);
                        if (q.trim().length < 2) { setGroupAddResults([]); return; }
                        try {
                          const headers = await PlatformBridge.getAuthHeaders();
                          const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`, { headers });
                          const data = await res.json().catch(() => null);
                          if (data?.success) {
                            const list = (data.users || data.contacts || [])
                              .filter((u: { id: string; role?: string }) => (u.role ?? '') !== 'AFFILIATE' && !existing.has(u.id))
                              .slice(0, 8);
                            setGroupAddResults(list);
                          }
                        } catch { /* noop */ }
                      }}
                      placeholder="Nombre, @usuario o teléfono"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontSize: 13, padding: '10px 12px', outline: 'none' }}
                    />
                    {groupAddResults.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px' }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}{c.username ? ` · @${c.username}` : ''}
                        </span>
                        <button
                          type="button"
                          disabled={groupAddBusy}
                          onClick={async () => {
                            if (!conversationId) return;
                            setGroupAddBusy(true);
                            try {
                              const headers = await PlatformBridge.getAuthHeaders();
                              const res = await fetch(`/api/chat/groups/${conversationId}`, {
                                method: 'PATCH',
                                headers: { ...headers, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ add: [c.id] }),
                              });
                              const data = await res.json().catch(() => null);
                              if (data?.success) {
                                showToast(`${c.name} añadido`, 'success');
                                setGroupInfo((prev) => prev ? { ...prev, members: [...prev.members, { userId: c.id, name: c.name, role: 'MEMBER' }] } : prev);
                                setGroupAddResults((prev) => prev.filter((x) => x.id !== c.id));
                              } else {
                                showToast(data?.error || 'No se pudo añadir', 'error');
                              }
                            } catch { showToast('No se pudo añadir', 'error'); } finally { setGroupAddBusy(false); }
                          }}
                          style={{ padding: '7px 14px', borderRadius: 999, border: 'none', background: 'rgba(255,46,147,0.2)', color: '#FF4D9E', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
                        >
                          Añadir
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={async () => {
                  if (!conversationId) return;
                  try {
                    const headers = await PlatformBridge.getAuthHeaders();
                    const res = await fetch(`/api/chat/groups/${conversationId}`, { method: 'DELETE', headers });
                    const data = await res.json().catch(() => null);
                    if (data?.success) {
                      showToast('Saliste del grupo', 'success');
                      router.push('/chat');
                    } else {
                      showToast('No se pudo salir del grupo', 'error');
                    }
                  } catch { showToast('No se pudo salir del grupo', 'error'); }
                }}
                style={{ marginTop: 14, width: '100%', padding: '13px', borderRadius: 14, border: 'none', background: 'rgba(255,107,129,0.14)', color: '#FF6B81', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
              >
                Salir del grupo
              </button>
            </div>
          </div>
        )}

        {/* Menú de acciones del mensaje: reaccionar / editar / eliminar */}
        {msgMenu && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setMsgMenu(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', left: 0, right: 0,
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0px)',
                background: '#141418', borderTop: '1px solid rgba(255,255,255,0.12)',
                borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '14px 14px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 14 }}>
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void reactTo(msgMenu.id, emoji)}
                    style={{
                      fontSize: 24, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 999, width: 46, height: 46, cursor: 'pointer',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {msgMenu.senderId === (myParticipantId || user?.id) && msgMenu.type === 'TEXT' && !msgMenu.deletedAt && (
                <button
                  type="button"
                  onClick={() => { setEditingMsg({ id: msgMenu.id, content: msgMenu.content }); setMsgMenu(null); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 6px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  ✏️ Editar mensaje
                </button>
              )}

              {canDeleteForAll(msgMenu) && (
                <button
                  type="button"
                  onClick={() => void deleteMessage(msgMenu, true)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 6px', fontSize: 14, fontWeight: 700, color: '#FF6B81', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  🗑️ Eliminar para todos
                </button>
              )}

              <button
                type="button"
                onClick={() => void deleteMessage(msgMenu, false)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 6px', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                🙈 Eliminar para mí
              </button>

              <button
                type="button"
                onClick={() => setMsgMenu(null)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '12px 6px', fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 12, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Editar mensaje */}
        {editingMsg && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
            <div style={{ width: '100%', maxWidth: 420, background: '#141418', borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)', padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#fff' }}>Editar mensaje</p>
              <textarea
                value={editingMsg.content}
                onChange={(e) => setEditingMsg({ ...editingMsg, content: e.target.value })}
                rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontSize: 14, padding: 10, resize: 'none', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditingMsg(null)} style={{ padding: '10px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="button" onClick={() => void saveEdit()} style={{ padding: '10px 18px', borderRadius: 999, background: 'linear-gradient(135deg,#FF2E93,#E11D74)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista previa de la foto: aquí se elige "una vez" (por defecto normal) */}
        {photoDraft && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 70,
              background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, minHeight: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoDraft.url}
                alt="Vista previa"
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 18, objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10,10,12,0.9)' }}>
              <button
                type="button"
                onClick={() => setPhotoDraft({ ...photoDraft, viewOnce: !photoDraft.viewOnce })}
                title="Ver una sola vez"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px',
                  borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 800,
                  color: '#fff',
                  border: photoDraft.viewOnce ? '1px solid rgba(255,46,147,0.8)' : '1px solid rgba(255,255,255,0.2)',
                  background: photoDraft.viewOnce ? 'rgba(233,30,99,0.28)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontSize: 14 }}>{photoDraft.viewOnce ? '🔒' : '1'}</span>
                {photoDraft.viewOnce ? 'Una vez' : 'Ver una vez'}
              </button>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={discardPhotoDraft}
                style={{
                  height: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
                  fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.8)',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void sendPhotoDraft()}
                disabled={sending}
                style={{
                  height: 40, padding: '0 20px', borderRadius: 999,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 900, color: '#fff',
                  background: sending ? 'rgba(28,28,34,0.9)' : 'linear-gradient(135deg,#FF2E93,#E11D74)',
                  border: 'none', boxShadow: sending ? 'none' : '0 4px 14px rgba(233,30,99,0.4)',
                }}
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        {!selectMode && !recording && (
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
            {/* Botón asistente Bunzy integrado en la fila de Telegram (píldora sin teclado, círculo con teclado) */}
            {!isBot && (
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setBunzyOpen(true);
                }}
                aria-label="Ayuda de Bunzy"
                title="Ayuda de Bunzy"
                style={{
                  height: 36,
                  width: keyboardOpen ? 36 : 'auto',
                  padding: keyboardOpen ? 0 : '0 11px',
                  borderRadius: 999,
                  border: '1px solid rgba(255, 46, 147, 0.45)',
                  background: 'linear-gradient(135deg, rgba(255, 46, 147, 0.28) 0%, rgba(168, 85, 247, 0.25) 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.18s ease',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>🐰</span>
                {!keyboardOpen && <span>Bunzy</span>}
              </button>
            )}

            {/* Botón clip / ubicación estilo Telegram */}
            <button
              type="button"
              onClick={handleShareLocation}
              disabled={locating}
              title="Compartir ubicación GPS"
              aria-label="Compartir ubicación GPS"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: coords ? 'rgba(233, 30, 99, 0.22)' : 'rgba(28, 28, 34, 0.88)',
                color: coords ? '#FF2E93' : 'rgba(255, 255, 255, 0.72)',
                cursor: locating ? 'wait' : 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {locating ? (
                <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid #FF2E93', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              )}
            </button>

            {/* Cápsula de texto estilo Telegram iOS */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(28, 28, 34, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 999,
                padding: '0 14px',
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  signalTyping();
                }}
                placeholder={isBot ? 'Mensaje para Bunzy...' : isBusinessInbox ? 'Mensaje...' : 'Mensaje'}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: '16px',
                  lineHeight: '20px',
                  color: '#FFFFFF',
                  outline: 'none',
                }}
                onFocus={() => {
                  setTimeout(() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                  }, 80);
                }}
              />
            </div>

            {input.trim() ? (
              <button
                type="submit"
                disabled={sending}
                aria-label="Enviar mensaje"
                style={{
                  width: 36,
                  height: 36,
                  background: sending ? 'rgba(28, 28, 34, 0.88)' : 'linear-gradient(135deg, #FF2E93 0%, #E11D74 100%)',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  boxShadow: sending ? 'none' : '0 3px 10px rgba(233, 30, 99, 0.4)',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            ) : (
              <>
              {/* Fotos: un botón; el "una vez" se elige en la vista previa */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.currentTarget.value = '';
                  pickPhoto(file);
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={sending}
                title="Enviar foto"
                aria-label="Enviar foto"
                style={{
                  width: 36, height: 36, background: 'rgba(28, 28, 34, 0.88)',
                  color: 'rgba(255, 255, 255, 0.82)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: sending ? 'not-allowed' : 'pointer', flexShrink: 0,
                  fontSize: 16,
                }}
              >
                📷
              </button>
              <button
                type="button"
                onClick={startRecording}
                disabled={sending}
                title="Grabar nota de voz"
                aria-label="Grabar nota de voz"
                style={{
                  width: 36,
                  height: 36,
                  background: 'rgba(28, 28, 34, 0.88)',
                  color: 'rgba(255, 255, 255, 0.82)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
              </>
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

          {/* Herramientas de NEGOCIO (afiliado). Si quien chatea es un Rabbitter
              no se muestran: el backend ya degradaba estos modos a "draft", así
              que para él eran botones sin efecto. */}
          {isBusinessInbox && (
            <>
              <button
                type="button"
                onClick={() => runBunzy('marketing_proposal')}
                disabled={bunzyBusy}
                style={{
                  width: '100%',
                  border: '1px solid rgba(255,138,0,0.3)',
                  borderRadius: '100px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#FF8A00',
                  background: 'rgba(255,138,0,0.08)',
                  cursor: bunzyBusy ? 'not-allowed' : 'pointer',
                }}
              >
                🚀 Crear propuesta comercial / campaña
              </button>

              <button
                type="button"
                onClick={() => runBunzy('admin_qa')}
                disabled={bunzyBusy}
                style={{
                  width: '100%',
                  border: '1px solid rgba(233,30,99,0.3)',
                  borderRadius: '100px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#FF2E93',
                  background: 'rgba(233,30,99,0.08)',
                  cursor: bunzyBusy ? 'not-allowed' : 'pointer',
                }}
              >
                🏪 Preguntar sobre POS, Caja o Admin
              </button>
            </>
          )}

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

      {/* Affiliate Special Boost Modal */}
      <BottomSheet isOpen={boostSheetOpen} onClose={() => setBoostSheetOpen(false)} title="⚡ Flash Boost de Recompensa">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 16px' }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Asigna un porcentaje especial independiente para atraer a los rabbitters cercanos a través del radar de proximidad y el mapa.
          </p>

          {loadingActiveBoost && (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Verificando boosts activos…</p>
          )}

          {!loadingActiveBoost && activeBoostCampaign && (
            <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.35)', borderRadius: 14, padding: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#FFD166', display: 'block', marginBottom: 4 }}>
                ⚡ Ya tienes un boost activo: +{activeBoostCampaign.rewardPercentage}%
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', lineHeight: 1.45 }}>
                Bolsa: {activeBoostCampaign.budgetSpent}/{activeBoostCampaign.budgetBunz} Bunz consumidos · vence {new Date(activeBoostCampaign.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                Activar un nuevo boost cancelará el actual y creará uno con los valores que elijas.
              </span>
            </div>
          )}

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Porcentaje Especial Bunz</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#E91E63' }}>+{boostPercentage}%</span>
            </div>

            <input
              type="range"
              min="15"
              max="50"
              step="5"
              value={boostPercentage}
              onChange={(e) => setBoostPercentage(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#E91E63', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>15%</span>
              <span>25% (Recomendado)</span>
              <span>50%</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {[2, 4, 8, 24].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setBoostHours(h)}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  borderRadius: 12,
                  border: boostHours === h ? '1.5px solid #E91E63' : '1px solid var(--border-subtle)',
                  background: boostHours === h ? 'rgba(233,30,99,0.12)' : 'var(--bg-elevated)',
                  color: boostHours === h ? '#E91E63' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {h}h
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={activatingBoost}
            onClick={async () => {
              setActivatingBoost(true);
              try {
                PlatformBridge.hapticFeedback('medium');
                const headers = await PlatformBridge.getAuthHeaders();
                // Si el chat es de un negocio o tiene targetBusinessId
                const bizId = targetBusinessId || user?.id;
                // No apilar: cancelar el boost activo previo si existe
                if (activeBoostCampaign) {
                  await fetch('/api/business/campaigns/manage', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId: activeBoostCampaign.id, action: 'CANCEL' }),
                  }).catch(() => {});
                }
                const res = await fetch('/api/business/campaigns', {
                  method: 'POST',
                  headers: { ...headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    businessId: bizId,
                    title: `Flash Boost ${boostPercentage}%`,
                    headline: `¡Flash Boost Especial de +${boostPercentage}% Bunz!`,
                    message: `Aprovecha hoy en ${targetName}: +${boostPercentage}% de cashback directo en Bunz al pagar en caja.`,
                    campaignType: 'FLASH_OFFER',
                    targetSegment: 'ALL_CUSTOMERS',
                    rewardPercentage: boostPercentage,
                    maxRewardPerUser: 50,
                    budgetBunz: 1000,
                    validityHours: boostHours,
                  }),
                });
                const data = await res.json();
                if (data.campaign?.id) {
                  // Activarla inmediatamente
                  await fetch('/api/business/campaigns/manage', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      campaignId: data.campaign.id,
                      action: 'APPROVE_AND_ACTIVATE',
                    }),
                  });
                }
                showToast(`¡Boost del ${boostPercentage}% activado en Radar & Mapa!`, 'success');
                PlatformBridge.hapticFeedback('success');
                setBoostSheetOpen(false);
              } catch (err) {
                console.warn('Boost activation error:', err);
                showToast(`Error al activar boost`, 'error');
              } finally {
                setActivatingBoost(false);
              }
            }}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 100,
              border: 'none',
              background: activatingBoost ? 'var(--bg-pressed)' : 'linear-gradient(135deg, #E91E63 0%, #FF8A00 100%)',
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 900,
              cursor: activatingBoost ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(233,30,99,0.3)',
            }}
          >
            {activatingBoost ? 'Activando Boost…' : `⚡ Activar Boost (+${boostPercentage}% Bunz por ${boostHours}h)`}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
