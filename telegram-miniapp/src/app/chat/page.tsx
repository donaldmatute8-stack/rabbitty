'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { BottomSheet } from '@/components/ui/BottomSheet';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, Reorder, useMotionValue, animate } from 'framer-motion';
import useSWR from 'swr';
import { BusinessCardSkeleton } from '@/components/ui/Skeleton';
import { PlatformBridge } from '@/lib/platform';
import { useConvPrefs, setPref, setOrder, type ConvPref } from '@/lib/convPrefs';
import { Pencil, SquarePen, BellOff, Bell, Archive, ArchiveRestore, Trash2, Pin, PinOff, Search, X, Menu, Users, Send, MessageCircle } from 'lucide-react';
import { GROUPS, openTelegramLink } from '@/components/groups/GroupsStrip';
import { openBunzy } from '@/lib/bunzyLaunch';

type Conversation = {
  id: string;
  targetId: string;
  targetName: string;
  targetAvatar: string | null;
  isBot?: boolean;
  isBusinessInbox?: boolean;
  businessName?: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageType?: string;
  unreadCount?: number;
};

const fetcher = async (url: string) => {
  const headers = await PlatformBridge.getAuthHeaders();
  return fetch(url, { headers }).then((res) => res.json());
};

const cleanPreview = (text?: string, type?: string) => {
  if (type === 'AUTO_REPLY') return '🤖 Respuesta automática';
  return (text || '').replace(/\[[A-Z_]+[^\]]*\]/g, '').trim();
};

const OPEN_WIDTH = 174;

const actionStyleBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  width: 58,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
};

const actionLabelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, lineHeight: 1.1 };

export default function ChatInboxPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { prefs, order } = useConvPrefs();

  const { data, isLoading } = useSWR<{ conversations: Conversation[] }>(
    user?.id ? `/api/chat` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const [category, setCategory] = useState<'all' | 'business'>('all');
  const [archived, setArchived] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealedRight, setRevealedRight] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const allConversations = useMemo(
    () => (data?.conversations ?? []).filter((c) => !prefs[c.id]?.deleted),
    [data, prefs]
  );
  const hasBusinessConvs = allConversations.some((c) => c.isBusinessInbox);
  const archivedCount = allConversations.filter((c) => prefs[c.id]?.archived).length;

  const visible = useMemo(() => {
    const list = allConversations.filter((c) => {
      const p = prefs[c.id] || {};
      if (!!p.archived !== archived) return false;
      if (category === 'business') return !!c.isBusinessInbox;
      return true;
    });
    return [...list].sort((a, b) => {
      const pa = prefs[a.id]?.pinned ? 1 : 0;
      const pb = prefs[b.id]?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      const ta = a.lastMessageTime ? Date.parse(a.lastMessageTime) : 0;
      const tb = b.lastMessageTime ? Date.parse(b.lastMessageTime) : 0;
      return tb - ta;
    });
  }, [allConversations, prefs, order, category, archived]);

  const contacts = useMemo(() => {
    const seen = new Set<string>();
    return allConversations.filter((c) => {
      if (seen.has(c.targetId)) return false;
      seen.add(c.targetId);
      return true;
    });
  }, [allConversations]);
  const filteredContacts = contacts.filter((c) => c.targetName.toLowerCase().includes(search.trim().toLowerCase()));

  const handleAction = (id: string, action: 'mute' | 'archive' | 'delete' | 'pin') => {
    PlatformBridge.hapticFeedback('medium');
    const p = prefs[id] || {};
    if (action === 'mute') setPref(id, { muted: !p.muted });
    else if (action === 'archive') setPref(id, { archived: !p.archived });
    else if (action === 'pin') setPref(id, { pinned: !p.pinned });
    else setPref(id, { deleted: true });
    setRevealed(null);
    setRevealedRight(null);
  };

  const onReorder = (next: Conversation[]) => {
    setOrder(next.map((c) => c.id));
  };

  return (
    <ProfileSubpageLayout
      title="Chats"
      centerTitle
      left={
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            setExpandedGroup(null);
            setGroupsOpen(true);
          }}
          aria-label="Comunidad y grupos"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Menu size={18} strokeWidth={2.5} />
        </button>
      }
      right={
        <>
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setRevealed(null);
              setEditMode((v) => !v);
            }}
            aria-label={editMode ? 'Listo' : 'Editar'}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '1px solid var(--border-subtle)',
              background: editMode ? '#E91E63' : 'var(--bg-elevated)',
              color: editMode ? '#fff' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {editMode ? <X size={18} /> : <Pencil size={18} />}
          </button>
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('medium');
              setNewOpen(true);
            }}
            aria-label="Nuevo mensaje"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <SquarePen size={18} />
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">

        {/* Filtro archivados */}
        {(archived || archivedCount > 0) && (
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setArchived((v) => !v);
              setRevealed(null);
            }}
            className="self-start flex items-center gap-2 px-3 py-2 rounded-full text-xs font-black"
            style={{
              background: archived ? '#3F51B5' : 'var(--bg-elevated)',
              color: archived ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {archived ? 'Volver a la bandeja' : `Archivados${archivedCount ? ` (${archivedCount})` : ''}`}
          </button>
        )}

        {/* Category Tabs for Affiliates / Business Owners */}
        {hasBusinessConvs && !archived && (
          <div className="flex gap-2 p-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setCategory('all');
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl border-none cursor-pointer transition-all ${category === 'all' ? 'bg-[#E91E63] text-white shadow-md' : 'bg-transparent text-[var(--text-muted)]'}`}
            >
              Mis Chats (Rabbitter)
            </button>
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setCategory('business');
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 ${category === 'business' ? 'bg-[#E91E63] text-white shadow-md' : 'bg-transparent text-[var(--text-muted)]'}`}
            >
              <span>🏪 Mi Negocio</span>
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-4">
            <BusinessCardSkeleton />
            <BusinessCardSkeleton />
          </div>
        )}

        {!isLoading && visible.length === 0 && (
          <div className="p-10 text-center text-[#AAA]">
            {archived
              ? 'No tienes chats archivados.'
              : category === 'business'
                ? 'No tienes solicitudes de clientes pendientes en tu negocio.'
                : 'No tienes conversaciones activas. Explora negocios o pregúntale a Bunzy.'}
          </div>
        )}

        {/* Modo edición: reordenar/fijar */}
        {!isLoading && editMode && (
          <Reorder.Group axis="y" values={visible} onReorder={onReorder} style={{ display: 'flex', flexDirection: 'column', gap: 16, listStyle: 'none', padding: 0, margin: 0 }}>
            {visible.map((conv) => (
              <Reorder.Item key={conv.id} value={conv} style={{ listStyle: 'none' }}>
                <div
                  className="flex items-center gap-4 p-4 rounded-3xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="cursor-grab text-[var(--text-muted)] text-lg select-none">⠿</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="m-0 font-black text-base truncate" style={{ color: 'var(--text-primary)' }}>{conv.targetName}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      const p = prefs[conv.id] || {};
                      setPref(conv.id, { pinned: !p.pinned });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-black"
                    style={{
                      background: prefs[conv.id]?.pinned ? '#E91E63' : 'var(--bg-pressed)',
                      color: prefs[conv.id]?.pinned ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {prefs[conv.id]?.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                    {prefs[conv.id]?.pinned ? 'Fijado' : 'Fijar'}
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Modo normal: filas con swipe */}
        {!isLoading && !editMode && (
          <div className="flex flex-col gap-4">
            {visible.map((conv) => (
              <SwipeRow
                key={conv.id}
                conv={conv}
                pref={prefs[conv.id] || {}}
                revealed={revealed === conv.id}
                revealedRight={revealedRight === conv.id}
                onReveal={setRevealed}
                onRevealRight={setRevealedRight}
                onAction={handleAction}
              />
            ))}
          </div>
        )}

      </div>

      <BottomSheet isOpen={newOpen} onClose={() => setNewOpen(false)} title="Nuevo mensaje">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '10px 12px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contacto…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
            {filteredContacts.length === 0 && (
              <p style={{ margin: '8px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Sin contactos aún. Comparte tu link o escanea un ticket para conectar.
              </p>
            )}
            {filteredContacts.map((c) => (
              <button
                key={c.targetId}
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setNewOpen(false);
                  router.push(`/chat/${c.targetId}`);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 14 }}
              >
                <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-pressed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.isBot ? '🐰' : c.targetAvatar ? <img src={c.targetAvatar} alt={c.targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'}
                </div>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>{c.targetName}</span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={groupsOpen} onClose={() => { setGroupsOpen(false); setExpandedGroup(null); }} title="Comunidad">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>Grupos oficiales</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 'auto' }}>Comunidad</span>
          </div>

          {GROUPS.map((g) => {
            const expanded = expandedGroup === g.id;
            return (
              <div key={g.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setExpandedGroup(expanded ? null : g.id);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: g.color,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{g.icon}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 900, fontSize: 15 }}>{g.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.95 }}>{g.desc}</span>
                  </span>
                  <span style={{ opacity: 0.9, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
                </button>

                {expanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--bg-pressed)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        PlatformBridge.hapticFeedback('medium');
                        setGroupsOpen(false);
                        setExpandedGroup(null);
                        openTelegramLink(g.link);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 800, fontSize: 14, textAlign: 'left' }}
                    >
                      <Send size={16} style={{ color: '#229ED9', flexShrink: 0 }} />
                      Abrir en Telegram
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        PlatformBridge.hapticFeedback('medium');
                        setGroupsOpen(false);
                        setExpandedGroup(null);
                        openBunzy('Quisiera unirme al grupo ' + g.name);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg,#E91E63 0%,#FF4081 100%)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14, textAlign: 'left' }}
                    >
                      <MessageCircle size={16} style={{ flexShrink: 0 }} />
                      Preguntarle a Bunzy (en la app)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </ProfileSubpageLayout>
  );
}

function SwipeRow({
  conv,
  pref,
  revealed,
  revealedRight,
  onReveal,
  onRevealRight,
  onAction,
}: {
  conv: Conversation;
  pref: ConvPref;
  revealed: boolean;
  revealedRight: boolean;
  onReveal: (id: string | null) => void;
  onRevealRight: (id: string | null) => void;
  onAction: (id: string, action: 'mute' | 'archive' | 'delete' | 'pin') => void;
}) {
  const x = useMotionValue(0);

  useEffect(() => {
    const target = revealed ? -OPEN_WIDTH : revealedRight ? 80 : 0;
    animate(x, target, { type: 'spring', stiffness: 420, damping: 42 });
  }, [revealed, revealedRight, x]);

  const close = () => {
    onReveal(null);
    onRevealRight(null);
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 42 });
  };

  const togglePin = () => {
    onAction(conv.id, 'pin');
    close();
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <button
            type="button"
            onClick={togglePin}
            style={{ ...actionStyleBase, background: pref.pinned ? '#E91E63' : '#9C27B0', width: 80 }}
            aria-label={pref.pinned ? 'Desfijar' : 'Fijar'}
          >
            {pref.pinned ? <PinOff size={20} /> : <Pin size={20} />}
            <span style={actionLabelStyle}>{pref.pinned ? 'Desfijar' : 'Fijar'}</span>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <button type="button" onClick={() => onAction(conv.id, 'mute')} style={{ ...actionStyleBase, background: '#607D8B' }} aria-label={pref.muted ? 'Activar notificaciones' : 'Silenciar'}>
            {pref.muted ? <Bell size={20} /> : <BellOff size={20} />}
            <span style={actionLabelStyle}>{pref.muted ? 'Activar' : 'Silenciar'}</span>
          </button>
        <button type="button" onClick={() => onAction(conv.id, 'archive')} style={{ ...actionStyleBase, background: '#3F51B5' }} aria-label={pref.archived ? 'Desarchivar' : 'Archivar'}>
          {pref.archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
          <span style={actionLabelStyle}>{pref.archived ? 'Desarchivar' : 'Archivar'}</span>
        </button>
        <button type="button" onClick={() => onAction(conv.id, 'delete')} style={{ ...actionStyleBase, background: '#E53935' }} aria-label="Eliminar">
          <Trash2 size={20} />
          <span style={actionLabelStyle}>Eliminar</span>
        </button>
        </div>
      </div>

      <motion.div
        style={{ x, position: 'relative', zIndex: 1, background: 'var(--bg-primary)' }}
        drag="x"
        dragConstraints={{ left: -OPEN_WIDTH, right: 80 }}
        dragElastic={0.06}
        dragDirectionLock
        onDragEnd={(_, info) => {
          const dx = info.offset.x;
          if (dx < -40) {
            onReveal(conv.id);
            onRevealRight(null);
            animate(x, -OPEN_WIDTH, { type: 'spring', stiffness: 420, damping: 42 });
          } else if (dx > 40) {
            onRevealRight(conv.id);
            onReveal(null);
            animate(x, 80, { type: 'spring', stiffness: 420, damping: 42 });
          } else {
            close();
          }
        }}
      >
        <Link
          href={`/chat/${conv.targetId}${conv.id && conv.id !== 'bunzy-initial' ? `?c=${conv.id}` : ''}`}
          className="no-underline block"
          onClick={(e) => {
            if (revealed) {
              e.preventDefault();
              close();
            }
          }}
        >
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 p-4 rounded-3xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
          >
            {conv.isBot ? (
              <div className="size-14 rounded-full bg-[#E91E63] flex items-center justify-center text-2xl shadow-[0_0_16px_rgba(233,30,99,0.3)] shrink-0">🐰</div>
            ) : (
              <div className="size-14 rounded-full bg-[#F5F5F5] overflow-hidden shrink-0 border border-[#EBEBEB]">
                {conv.targetAvatar ? (
                  <img src={conv.targetAvatar} alt={conv.targetName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">{conv.isBusinessInbox ? '👤' : '💬'}</div>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2 truncate">
                  <h3 className="m-0 font-black text-base truncate" style={{ color: 'var(--text-primary)' }}>
                    {conv.targetName}
                  </h3>
                  {pref.pinned && <Pin size={13} style={{ color: '#E91E63', flexShrink: 0 }} />}
                  {pref.muted && <BellOff size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                </div>
                {conv.isBot ? (
                  <span className="text-[10px] font-black text-[#E91E63] bg-[rgba(233,30,99,0.1)] px-2 py-0.5 rounded-full uppercase shrink-0">Oficial</span>
                ) : conv.lastMessageTime ? (
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
              <p
                className="m-0 text-[13px] truncate"
                style={{
                  color: (conv.unreadCount || 0) > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: (conv.unreadCount || 0) > 0 ? 700 : 400,
                }}
              >
                {cleanPreview(conv.lastMessage, conv.lastMessageType) || 'Sin mensajes aún'}
              </p>
            </div>

            {!!conv.unreadCount && conv.unreadCount > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: '#E91E63' }}>
                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
              </span>
            )}
          </motion.div>
        </Link>
      </motion.div>
    </div>
  );
}
