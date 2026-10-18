'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { BottomSheet } from '@/components/ui/BottomSheet';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, Reorder, useMotionValue, animate } from 'framer-motion';
import useSWR from 'swr';
import { BusinessCardSkeleton } from '@/components/ui/Skeleton';
import { PlatformBridge } from '@/lib/platform';
import { useConvPrefs, setPref, setOrder, type ConvPref } from '@/lib/convPrefs';
import { Pencil, SquarePen, BellOff, Bell, Archive, ArchiveRestore, Trash2, Pin, PinOff, Search, X, Send, MessageCircle } from 'lucide-react';
import { GROUPS, openTelegramLink } from '@/components/groups/GroupsStrip';
import { openBunzy } from '@/lib/bunzyLaunch';
import { useToast } from '@/contexts/ToastContext';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [community, setCommunity] = useState<'chats' | string>('chats');
  const [search, setSearch] = useState('');
  const [pickedContacts, setPickedContacts] = useState<Array<{ name: string; tel: string }>>([]);
  const { showToast } = useToast();

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

  type DeviceContact = { name?: string[]; tel?: string[] };
  type ContactPickerNav = { contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<DeviceContact[]> } };

  const appLink = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteText = `Únete a Rabbitty 🐰 ${appLink}`;

  const openWhatsAppInvite = (phone?: string) => {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(inviteText)}`
      : `https://wa.me/?text=${encodeURIComponent(inviteText)}`;
    window.open(url, '_blank');
  };

  const openTelegramInvite = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent('Únete a Rabbitty 🐰')}`;
    window.open(url, '_blank');
  };

  const pickDeviceContacts = async () => {
    PlatformBridge.hapticFeedback('medium');
    const picker = (navigator as unknown as ContactPickerNav).contacts;
    if (!picker || typeof picker.select !== 'function') {
      showToast('Tu navegador no permite leer contactos. Usa las invitaciones por WhatsApp o Telegram.', 'info');
      return;
    }
    try {
      const res = await picker.select(['name', 'tel'], { multiple: true });
      const mapped = (res || []).flatMap((c) => {
        const name = (c.name && c.name[0]) || 'Contacto';
        const tels = c.tel && c.tel.length ? c.tel : [''];
        return tels.map((tel) => ({ name, tel }));
      });
      if (!mapped.length) {
        showToast('No se encontraron contactos con teléfono.', 'info');
        return;
      }
      setPickedContacts(mapped.slice(0, 20));
      showToast(`${mapped.length} contacto(s) añadido(s) — invítalos a Rabbitty`, 'success');
    } catch {
      // usuario canceló el selector
    }
  };

  return (
    <>
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210 }}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                width: 'min(78vw, 320px)',
                background: 'var(--bg-elevated)',
                borderRight: '1px solid var(--border-subtle)',
                zIndex: 211,
                padding: 'calc(var(--safe-top, 0px) + 18px) 14px calc(16px + env(safe-area-inset-bottom))',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                overflowY: 'auto',
                boxShadow: '10px 0 34px rgba(0,0,0,0.3)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px 8px' }}>
                Comunidades
              </span>
              {([
                { id: 'chats', label: 'Chats', icon: null as string | null, color: 'var(--bg-pressed)' },
                ...GROUPS.map((g) => ({ id: g.id, label: g.name, icon: g.icon as string | null, color: g.color })),
                { id: 'support', label: 'Soporte', icon: '🛟', color: 'linear-gradient(135deg,#00BCD4 0%,#26C6DA 100%)' },
                { id: 'promotions', label: 'Promociones', icon: '🎉', color: 'linear-gradient(135deg,#FF9800 0%,#FFB74D 100%)' },
              ]).map((item) => {
                const active = community === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      setCommunity(item.id);
                      setDrawerOpen(false);
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', padding: '10px 4px', background: active ? 'var(--bg-pressed)' : 'transparent', border: 'none', borderRadius: 16, cursor: 'pointer' }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: item.icon ? item.color : 'var(--bg-pressed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 26,
                        border: active ? '3px solid #E91E63' : '1px solid var(--border-subtle)',
                        boxShadow: active ? '0 0 0 3px rgba(233,30,99,0.18)' : 'none',
                      }}
                    >
                      {item.icon || <MessageCircle size={24} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: active ? '#E91E63' : 'var(--text-primary)', textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 6px 0', lineHeight: 1.5, margin: 0 }}>
                Más comunidades pronto (ej. Promociones).
              </p>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div style={{ transform: drawerOpen ? 'translateX(min(78vw, 320px))' : 'none', transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      <ProfileSubpageLayout
      title={community === 'chats' ? 'Chats' : (GROUPS.find((g) => g.id === community)?.name || 'Chats')}
      centerTitle
      left={
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            setDrawerOpen((v) => !v);
          }}
          aria-label="Comunidades"
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
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path d="M1 3.5h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M1 10.5h9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
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
      {community === 'chats' ? (
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
      ) : (() => {
        if (community === 'support') {
          return (
            <div className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#00BCD4 0%,#26C6DA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🛟</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>Soporte Rabbitty</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.5 }}>Centro de tickets, seguimiento y soporte entre usuarios/admins.</p>
              <button
                type="button"
                onClick={() => { PlatformBridge.hapticFeedback('medium'); window.location.href = '/support'; }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Ir a Ayuda y Soporte
              </button>
              <button
                type="button"
                onClick={() => { PlatformBridge.hapticFeedback('light'); setCommunity('chats'); }}
                className="text-xs font-black"
                style={{ background: 'transparent', border: 'none', color: '#E91E63', cursor: 'pointer', padding: 6 }}
              >
                ← Volver a mis chats
              </button>
            </div>
          );
        }
        if (community === 'promotions') {
          return (
            <div className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#FF9800 0%,#FFB74D 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🎉</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>Promociones</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.5 }}>Pronto: promociones, cupones y ofertas exclusivas para Rabbitters.</p>
              <button
                type="button"
                onClick={() => { PlatformBridge.hapticFeedback('light'); setCommunity('chats'); }}
                className="text-xs font-black"
                style={{ background: 'transparent', border: 'none', color: '#E91E63', cursor: 'pointer', padding: 6 }}
              >
                ← Volver a mis chats
              </button>
            </div>
          );
        }
                const g = GROUPS.find((x) => x.id === community);
        if (!g) return null;
        return (
          <div className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
              {g.icon}
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{g.name}</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.5 }}>{g.desc}</p>
            <span className="text-[10px] font-black tracking-[1px] px-3 py-1 rounded-full" style={{ background: 'rgba(233,30,99,0.12)', color: '#E91E63', border: '1px solid rgba(233,30,99,0.3)' }}>GRUPO OFICIAL</span>
            <button
              type="button"
              onClick={() => { PlatformBridge.hapticFeedback('medium'); openTelegramLink(g.link); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <Send size={16} style={{ color: '#229ED9' }} /> Abrir en Telegram
            </button>
            <button
              type="button"
              onClick={() => { PlatformBridge.hapticFeedback('medium'); openBunzy('Quisiera unirme al grupo ' + g.name); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm"
              style={{ background: 'linear-gradient(135deg,#E91E63 0%,#FF4081 100%)', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <MessageCircle size={16} /> Preguntarle a Bunzy
            </button>
            <div className="w-full rounded-2xl border border-dashed px-4 py-5 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Aquí aparecerá el contenido de {g.name}: anuncios, novedades y nuevas comunidades (ej. Promociones) muy pronto.
            </div>
            <button
              type="button"
              onClick={() => { PlatformBridge.hapticFeedback('light'); setCommunity('chats'); }}
              className="text-xs font-black"
              style={{ background: 'transparent', border: 'none', color: '#E91E63', cursor: 'pointer', padding: 6 }}
            >
              ← Volver a mis chats
            </button>
          </div>
        );
      })()}

      </ProfileSubpageLayout>
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

          <button
            type="button"
            onClick={pickDeviceContacts}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: 20, width: 30, textAlign: 'center', flexShrink: 0 }}>📇</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>Contactos del dispositivo</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Permite elegir contactos de tu móvil e invitarlos</span>
            </span>
          </button>

          {pickedContacts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: 4 }}>
                Elegidos de tu móvil
              </span>
              {pickedContacts.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-pressed)', borderRadius: 14 }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                    {(c.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.tel && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{c.tel}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => openWhatsAppInvite(c.tel)}
                    aria-label={`Invitar a ${c.name} por WhatsApp`}
                    style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #25D366', background: 'rgba(37,211,102,0.12)', color: '#25D366', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                  >
                    📱
                  </button>
                  <button
                    type="button"
                    onClick={openTelegramInvite}
                    aria-label={`Invitar a ${c.name} por Telegram`}
                    style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #229ED9', background: 'rgba(34,158,217,0.12)', color: '#229ED9', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✈
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: 4 }}>
              Invitar a Rabbitty
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => openWhatsAppInvite()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 14, border: '1px solid #25D366', background: 'rgba(37,211,102,0.1)', color: '#128C4A', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                WhatsApp
              </button>
              <button
                type="button"
                onClick={openTelegramInvite}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 14, border: '1px solid #229ED9', background: 'rgba(34,158,217,0.1)', color: '#229ED9', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </button>
            </div>
          </div>

          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: 4 }}>
            Contactos en Rabbitty
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
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
    </>
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
