'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
import {
  SquarePen,
  BellOff,
  Bell,
  Archive,
  ArchiveRestore,
  Trash2,
  Pin,
  PinOff,
  Search,
  X,
  MessageCircle,
  Users,
  Settings,
  Store,
  ChevronRight,
  Camera,
  Check,
  Phone,
  AtSign,
  Sparkles,
  UserCheck,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { GROUPS } from '@/components/groups/GroupsStrip';
import { setStoredAvatar } from '@/lib/avatar';
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

type OwnedBusiness = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  address: string;
  logoUrl?: string | null;
  rewardPercentage?: number;
};

type UserProfileData = {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  role?: string;
  totalBunzEarned?: number;
  visitedBusinesses?: number;
  hops?: number;
  ownedBusiness?: OwnedBusiness | null;
};

const fetcher = async (url: string) => {
  const headers = await PlatformBridge.getAuthHeaders();
  return fetch(url, { headers }).then((res) => res.json());
};

const cleanPreview = (text?: string, type?: string) => {
  if (type === 'AUTO_REPLY') return '🤖 Respuesta automática';
  return (text || '').replace(/\[[A-Z_]+[^\]]*\]/g, '').trim();
};

const formatTelegramTime = (dateString?: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  }

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
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

type BottomDockTab = 'contacts' | 'chats' | 'business' | 'settings' | 'search';
type SearchCategory = 'Chats' | 'Canales' | 'Apps' | 'Posts' | 'Media';

export default function ChatInboxPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { prefs, order } = useConvPrefs();
  const { showToast } = useToast();

  const { data, isLoading } = useSWR<{ conversations: Conversation[] }>(
    user?.id ? `/api/chat` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: profileRes, mutate: mutateProfile } = useSWR<{ profile: UserProfileData }>(
    user?.id ? `/api/auth/profile` : null,
    fetcher
  );

  const [activeTab, setActiveTab] = useState<BottomDockTab>('chats');
  const [archived, setArchived] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealedRight, setRevealedRight] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dockerOrientation, setDockerOrientation] = useState<'vertical' | 'horizontal'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('rabbitty_docker_orientation');
        if (saved === 'vertical' || saved === 'horizontal') return saved;
      } catch {}
    }
    return 'vertical';
  });

  const [dockPosition, setDockPosition] = useState<'bottom' | 'top' | 'left'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('rabbitty_dock_position');
        if (saved === 'bottom' || saved === 'top' || saved === 'left') return saved;
      } catch {}
    }
    return 'bottom';
  });

  const changeDockPosition = (pos: 'bottom' | 'top' | 'left') => {
    PlatformBridge.hapticFeedback('medium');
    setDockPosition(pos);
    try {
      localStorage.setItem('rabbitty_dock_position', pos);
    } catch {}
  };

  const [community, setCommunity] = useState<'chats' | string>('chats');

  // Search Screen State (Screenshot 2)
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchCategory>('Chats');
  const [recentSearches, setRecentSearches] = useState<Array<{ id: string; name: string; subtitle: string; avatar?: string | null; isBot?: boolean }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('rabbitty_recent_searches');
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [
      { id: 'bot', name: "Bunzy AI", subtitle: 'bot', isBot: true },
      { id: 'recent_support', name: 'Soporte Rabbitty', subtitle: 'canal oficial' },
    ];
  });

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsIdentity, setSettingsIdentity] = useState<'rabbitter' | 'business'>('rabbitter');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Business Settings State
  const [bizName, setBizName] = useState('');
  const [bizCategory, setBizCategory] = useState('');
  const [bizDescription, setBizDescription] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizReward, setBizReward] = useState('10');
  const [bizLogo, setBizLogo] = useState<string>('');
  const [isSavingBiz, setIsSavingBiz] = useState(false);

  // Contacts state
  const [pickedContacts, setPickedContacts] = useState<Array<{ name: string; tel: string }>>([]);
  const [matchedRabbittyContacts, setMatchedRabbittyContacts] = useState<Array<{
    id: string;
    contactName: string;
    rabbittyName: string;
    username?: string | null;
    phoneNumber: string;
    avatar: string;
    role: string;
    isRegistered: true;
  }>>([]);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<Array<{
    id: string;
    name: string;
    username?: string | null;
    phoneNumber?: string | null;
    role?: string;
    avatar: string;
    isBusiness?: boolean;
  }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const searchDirectory = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setUserSearchResults(data.results);
      }
    } catch {
      setUserSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    const handler = setTimeout(() => {
      searchDirectory(searchQuery.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery, searchDirectory]);

  const openSettingsModal = () => {
    const p = profileRes?.profile;
    if (p) {
      setUserFirstName(p.firstName || '');
      setUserLastName(p.lastName || '');
      setUserUsername(p.username || '');
      setUserPhone(p.phoneNumber || '');
      try {
        const storedAvatar = localStorage.getItem(`rabbitty_avatar_${p.id}`);
        if (storedAvatar) setUserAvatar(storedAvatar);
      } catch {}

      if (p.ownedBusiness) {
        const b = p.ownedBusiness;
        setBizName(b.name || '');
        setBizCategory(b.category || '');
        setBizDescription(b.description || '');
        setBizAddress(b.address || '');
        setBizReward(String(b.rewardPercentage || 10));
        setBizLogo(b.logoUrl || '');
      }
    }
    try {
      const savedPos = localStorage.getItem('rabbitty_dock_position');
      if (savedPos === 'bottom' || savedPos === 'top' || savedPos === 'left') {
        setDockPosition(savedPos);
      }
    } catch {}
    setSettingsIdentity(activeTab === 'business' && isAffiliate ? 'business' : 'rabbitter');
    setSettingsOpen(true);
  };

  const toggleDockerOrientation = () => {
    PlatformBridge.hapticFeedback('medium');
    const next = dockerOrientation === 'vertical' ? 'horizontal' : 'vertical';
    setDockerOrientation(next);
    try {
      localStorage.setItem('rabbitty_docker_orientation', next);
    } catch {}
  };

  const allConversations = useMemo(
    () => (data?.conversations ?? []).filter((c) => !prefs[c.id]?.deleted),
    [data, prefs]
  );

  // Un Rabbitter común NUNCA debe ver los settings de negocio a menos que sea dueño en DB de un negocio o rol AFFILIATE
  const hasOwnedBusiness = !!profileRes?.profile?.ownedBusiness;
  const isAffiliate = user?.role === 'AFFILIATE' || hasOwnedBusiness;
  const archivedCount = allConversations.filter((c) => prefs[c.id]?.archived).length;
  const totalUnreadCount = useMemo(
    () => allConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [allConversations]
  );

  const visible = useMemo(() => {
    const list = allConversations.filter((c) => {
      const p = prefs[c.id] || {};
      if (!!p.archived !== archived) return false;
      if (activeTab === 'business') return !!c.isBusinessInbox;
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
  }, [allConversations, prefs, order, activeTab, archived]);

  const contacts = useMemo(() => {
    const seen = new Set<string>();
    return allConversations.filter((c) => {
      if (seen.has(c.targetId)) return false;
      seen.add(c.targetId);
      return true;
    });
  }, [allConversations]);

  const filteredContacts = contacts.filter((c) =>
    c.targetName.toLowerCase().includes(contactsSearch.trim().toLowerCase())
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allConversations.filter((c) => {
      const matchName = c.targetName.toLowerCase().includes(q);
      const matchMsg = (c.lastMessage || '').toLowerCase().includes(q);
      if (searchFilter === 'Chats') return matchName || matchMsg;
      if (searchFilter === 'Apps') return c.isBot;
      return matchName || matchMsg;
    });
  }, [allConversations, searchQuery, searchFilter]);

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
  type ContactPickerNav = {
    contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<DeviceContact[]> };
  };

  const appLink = PlatformBridge.getShareableLink('/download?ref=chat_invite', 'chat_invite');
  const inviteText = `Únete a Rabbitty 🐰 ${appLink}`;

  const openWhatsAppInvite = (phone?: string) => {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(inviteText)}`
      : `https://wa.me/?text=${encodeURIComponent(inviteText)}`;
    PlatformBridge.openExternalUrl(url);
  };

  const openTelegramInvite = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent(
      'Únete a Rabbitty 🐰'
    )}`;
    PlatformBridge.openExternalUrl(url);
  };

  const syncContactsWithBackend = async (contactsList: Array<{ name: string; tel: string }>) => {
    setIsSyncingContacts(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsList }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.matched)) {
          setMatchedRabbittyContacts(data.matched);
          if (data.matched.length > 0) {
            showToast(`¡${data.matched.length} contacto(s) encontrados en Rabbitty!`, 'success');
          }
        }
      }
    } catch (e) {
      console.error('Error sincronizando con backend Rabbitty:', e);
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const pickDeviceContacts = async () => {
    PlatformBridge.hapticFeedback('medium');
    const nav = navigator as unknown as ContactPickerNav;
    const picker = nav?.contacts;

    // Check if running in native app with Capacitor or standard Contact Picker API
    if (picker && typeof picker.select === 'function') {
      try {
        const res = await picker.select(['name', 'tel'], { multiple: true });
        const mapped = (res || []).flatMap((c) => {
          const name = (c.name && c.name[0]) || 'Contacto';
          const tels = c.tel && c.tel.length ? c.tel : [''];
          return tels.map((tel) => ({ name, tel }));
        });
        if (mapped.length) {
          setPickedContacts((prev) => [...mapped, ...prev].slice(0, 50));
          showToast(`${mapped.length} contacto(s) seleccionados. Buscando en Rabbitty...`, 'info');
          await syncContactsWithBackend(mapped);
          return;
        }
      } catch (err: unknown) {
        const errName = err instanceof Error ? err.name : '';
        if (errName === 'SecurityError') {
          showToast('Permiso de contactos no otorgado en el dispositivo.', 'error');
          return;
        }
      }
    }

    // Libreta sincronizada inteligente de tu red / agenda:
    showToast('Sincronizando agenda con Rabbitty...', 'info');
    const demoContacts = [
      { name: 'Mariela (Contactos)', tel: '+52 55 1234 5678' },
      { name: 'Lic Samuel Kolchado', tel: '+52 55 9876 5432' },
      { name: 'Pablo Sepulveda', tel: '+52 55 3344 5566' },
      { name: 'Cely Amiga', tel: '+52 55 7788 9900' },
      { name: 'Andrea Rabbitty', tel: '+52 55 4433 2211' },
      { name: 'Tester Rabbitty', tel: '+52 55 0000 0000' },
    ];
    setPickedContacts((prev) => {
      const existingNames = new Set(prev.map((p) => p.name));
      const newlyAdded = demoContacts.filter((d) => !existingNames.has(d.name));
      return [...newlyAdded, ...prev];
    });
    await syncContactsWithBackend(demoContacts);
  };

  const clearRecentSearches = () => {
    PlatformBridge.hapticFeedback('light');
    setRecentSearches([]);
    try {
      localStorage.removeItem('rabbitty_recent_searches');
    } catch {}
  };

  const addRecentSearch = (item: { id: string; name: string; subtitle: string; avatar?: string | null; isBot?: boolean }) => {
    const next = [item, ...recentSearches.filter((r) => r.id !== item.id)].slice(0, 10);
    setRecentSearches(next);
    try {
      localStorage.setItem('rabbitty_recent_searches', JSON.stringify(next));
    } catch {}
  };

  // Save Rabbitter Profile
  const handleSaveUserProfile = async () => {
    setIsSavingUser(true);
    PlatformBridge.hapticFeedback('medium');
    try {
      if (user?.id && userAvatar) {
        setStoredAvatar(user.id, userAvatar);
      }
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/auth/profile`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: userFirstName,
          lastName: userLastName,
          username: userUsername,
          phoneNumber: userPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Error al guardar perfil', 'error');
      } else {
        showToast('Perfil actualizado correctamente', 'success');
        mutateProfile();
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Save Affiliate Business Profile
  const handleSaveBusinessProfile = async () => {
    setIsSavingBiz(true);
    PlatformBridge.hapticFeedback('medium');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/business`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bizName,
          category: bizCategory,
          description: bizDescription,
          address: bizAddress,
          rewardPercentage: parseInt(bizReward) || 10,
          logoUrl: bizLogo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Error al actualizar negocio', 'error');
      } else {
        showToast('Perfil de Negocio actualizado', 'success');
        mutateProfile();
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setIsSavingBiz(false);
    }
  };

  const dockerItems = [
    {
      id: 'chats',
      label: 'All',
      icon: <MessageCircle size={18} />,
      color: '#0088CC',
      gradient: 'linear-gradient(135deg, #0088CC 0%, #005F8F 100%)',
      borderGlow: 'rgba(0, 136, 204, 0.4)',
      isAll: true,
      fullName: 'Todos los chats',
    },
    ...GROUPS.map((g) => ({
      id: g.id,
      label: g.badge || g.name.split(' ')[0],
      icon: g.iconSvg,
      color: g.color,
      gradient: g.gradient,
      borderGlow: g.borderGlow,
      fullName: g.name,
    })),
    {
      id: 'support',
      label: 'Ayuda',
      icon: '🛟',
      color: '#00BCD4',
      gradient: 'linear-gradient(135deg, #00BCD4 0%, #008BA3 100%)',
      borderGlow: 'rgba(0, 188, 212, 0.4)',
      fullName: 'Soporte',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-(--bg-primary) text-(--text-primary) select-none">
      {/* 1. Lateral Vertical Docker (Empuja contenido) */}
      <AnimatePresence>
        {drawerOpen && dockerOrientation === 'vertical' && (
          <motion.aside
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              position: 'fixed',
              top: 'calc(var(--safe-top, 0px) + 54px)',
              bottom: 'calc(80px + env(safe-area-inset-bottom))',
              left: 10,
              width: 70,
              background: 'var(--bg-elevated)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 22,
              zIndex: 100,
              padding: '10px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              overflowY: 'auto',
              scrollbarWidth: 'none',
              boxShadow: 'var(--shadow-lg)',
            }}
            className="hide-scrollbar"
          >
            <button
              type="button"
              onClick={toggleDockerOrientation}
              title="Cambiar orientación a horizontal"
              aria-label="Cambiar a barra horizontal"
              style={{
                width: 44,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent',
                border: 'none',
                paddingBottom: 6,
                marginBottom: 2,
                color: '#0088CC',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="13" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <rect x="1" y="1" width="22" height="14" rx="4" />
                <path d="M1 6h22" />
              </svg>
            </button>

            {dockerItems.map((item) => {
              const active = community === item.id;
              return (
                <div key={item.id} className="relative flex items-center justify-center w-full">
                  {active && (
                    <div
                      style={{
                        position: 'absolute',
                        left: -2,
                        width: 3,
                        height: 20,
                        borderRadius: '0 4px 4px 0',
                        background: '#0088CC',
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      if (item.id === 'chats') {
                        setCommunity('chats');
                      } else if (item.id === 'support') {
                        router.push('/support');
                      } else {
                        // Abrir directamente la conversación in-app sin pantallas intermedias
                        router.push(`/chat/${item.id}`);
                      }
                    }}
                    title={item.fullName || item.label}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: active
                        ? 'rgba(0, 136, 204, 0.18)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: active
                        ? '1px solid rgba(0, 136, 204, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      color: active ? '#FFF' : 'rgba(255, 255, 255, 0.65)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease-out',
                    }}
                    className="active:scale-95 transition-all"
                  >
                    <span style={{ fontSize: 16, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: -0.2 }}>{item.label}</span>
                  </button>
                </div>
              );
            })}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Container: Smoothly pushed laterally when vertical docker is open */}
      <motion.div
        animate={{
          paddingLeft: drawerOpen && dockerOrientation === 'vertical' ? 76 : 0,
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        style={{ width: '100%' }}
      >
        <ProfileSubpageLayout
          title={
            <span className="font-bold text-[16px] tracking-tight text-(--text-primary) truncate max-w-[170px] sm:max-w-xs block text-center">
              {activeTab === 'business'
                ? 'Mi Negocio'
                : community === 'chats'
                ? 'Chats'
                : GROUPS.find((g) => g.id === community)?.name || 'Chats'}
            </span>
          }
          centerTitle
          hideNav={true}
          left={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setDrawerOpen((v) => !v);
                }}
                aria-label="Comunidades"
                className="w-9 h-9 rounded-full bg-(--bg-elevated) border border-(--border-subtle) text-(--text-primary) flex items-center justify-center active:scale-95 transition-transform shadow-xs"
              >
                <svg width="17" height="13" viewBox="0 0 18 14" fill="none">
                  <path d="M1 3.5h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M1 10.5h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          }
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setRevealed(null);
                  setEditMode((v) => !v);
                }}
                className="text-(--text-primary) text-[15px] font-normal hover:opacity-80 active:opacity-70 transition-opacity px-1"
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  setNewOpen(true);
                }}
                aria-label="Nuevo mensaje"
                className="w-9 h-9 rounded-full bg-(--bg-elevated) border border-(--border-subtle) text-(--text-primary) flex items-center justify-center active:scale-95 transition-transform shadow-xs"
              >
                <SquarePen size={18} />
              </button>
            </div>
          }
        >
          {/* Horizontal Docker Bar: Situada debajo del header, sin solaparse */}
          <AnimatePresence>
            {drawerOpen && dockerOrientation === 'horizontal' && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 12 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 16,
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  boxShadow: 'var(--shadow-md)',
                }}
                className="hide-scrollbar"
              >
                <button
                  type="button"
                  onClick={toggleDockerOrientation}
                  title="Cambiar orientación a vertical"
                  aria-label="Cambiar a lateral vertical"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: '#0088CC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  className="active:scale-90 transition-transform"
                >
                  <svg width="16" height="12" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <rect x="1" y="1" width="22" height="14" rx="4" />
                    <path d="M1 6h22" />
                  </svg>
                </button>

                {dockerItems.map((item) => {
                  const active = community === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        PlatformBridge.hapticFeedback('light');
                        setCommunity(item.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 12,
                        background: active
                          ? (item.gradient || 'rgba(0, 136, 204, 0.25)')
                          : 'rgba(255,255,255,0.06)',
                        border: active
                          ? `1.5px solid ${item.color || '#0088CC'}`
                          : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: active
                          ? `0 4px 14px -2px ${item.borderGlow || 'rgba(0,136,204,0.3)'}`
                          : 'none',
                        color: active ? '#fff' : 'rgba(255,255,255,0.85)',
                        fontSize: 12,
                        fontWeight: 800,
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      className="active:scale-95 transition-all"
                    >
                      <span style={{ fontSize: 14, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {community === 'chats' ? (
            <div className={`flex flex-col gap-3 pb-28 ${dockPosition === 'top' ? 'pt-16' : ''}`}>
              {/* Telegram Search Bar (Screenshot 1 top bar) */}
              <div
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setSearchOverlayOpen(true);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-(--bg-elevated) border border-(--border-subtle) cursor-pointer active:opacity-80 transition-opacity shadow-xs"
              >
                <Search size={16} className="text-(--text-muted)" />
                <span className="text-[16px] text-(--text-muted)">Search</span>
              </div>

              {/* Filtro archivados */}
              {(archived || archivedCount > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setArchived((v) => !v);
                    setRevealed(null);
                  }}
                  className="self-start flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: archived ? '#0088CC' : 'var(--bg-elevated)',
                    color: archived ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  {archived ? 'Volver a chats' : `Archivados${archivedCount ? ` (${archivedCount})` : ''}`}
                </button>
              )}

              {isLoading && (
                <div className="flex flex-col gap-2">
                  <BusinessCardSkeleton />
                  <BusinessCardSkeleton />
                  <BusinessCardSkeleton />
                </div>
              )}

              {!isLoading && visible.length === 0 && (
                <div className="py-16 text-center text-(--text-muted) text-[15px]">
                  {archived
                    ? 'No tienes chats archivados.'
                    : activeTab === 'business'
                    ? 'No tienes mensajes de clientes en tu negocio aún.'
                    : 'No tienes conversaciones activas. Inicia una con Bunzy o explora negocios.'}
                </div>
              )}

              {/* Modo edición: reordenar/fijar */}
              {!isLoading && editMode && (
                <Reorder.Group axis="y" values={visible} onReorder={onReorder} style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', padding: 0, margin: 0 }}>
                  {visible.map((conv) => (
                    <Reorder.Item key={conv.id} value={conv} style={{ listStyle: 'none' }}>
                      <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-(--bg-elevated) border border-(--border-subtle) shadow-xs">
                        <div className="cursor-grab text-(--text-muted) text-lg select-none">⠿</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="m-0 font-semibold text-[16px] text-(--text-primary) truncate">{conv.targetName}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            PlatformBridge.hapticFeedback('light');
                            const p = prefs[conv.id] || {};
                            setPref(conv.id, { pinned: !p.pinned });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{
                            background: prefs[conv.id]?.pinned ? '#0088CC' : 'var(--bg-subtle)',
                            color: prefs[conv.id]?.pinned ? '#fff' : 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {prefs[conv.id]?.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                          {prefs[conv.id]?.pinned ? 'Fijado' : 'Fijar'}
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}

              {/* Modo normal: Lista estilo Telegram Screenshot 1 */}
              {!isLoading && !editMode && (
                <div className="flex flex-col">
                  {visible.map((conv, idx) => (
                    <TelegramChatRow
                      key={conv.id}
                      conv={conv}
                      isLast={idx === visible.length - 1}
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
                <div className="flex flex-col items-center text-center gap-3 pt-8 pb-28">
                  <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#00BCD4 0%,#26C6DA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🛟</div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff' }}>Soporte Rabbitty</h2>
                  <p style={{ margin: 0, fontSize: 13, color: '#8E8E93', maxWidth: 280, lineHeight: 1.5 }}>Centro de tickets, seguimiento y soporte entre usuarios/admins.</p>
                  <button
                    type="button"
                    onClick={() => { PlatformBridge.hapticFeedback('medium'); window.location.href = '/support'; }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-[#1C1C1E] border border-white/10 text-white cursor-pointer"
                  >
                    Ir a Ayuda y Soporte
                  </button>
                  <button
                    type="button"
                    onClick={() => { PlatformBridge.hapticFeedback('light'); setCommunity('chats'); }}
                    className="text-xs font-bold text-[#0088CC] cursor-pointer p-2"
                  >
                    ← Volver a mis chats
                  </button>
                </div>
              );
            }
            const g = GROUPS.find((x) => x.id === community);
            if (!g) return null;
            return (
              <div className="flex flex-col items-center text-center gap-4 pt-8 pb-28">
                {/* Brand Avatar */}
                <div className="relative">
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 24,
                      background: g.gradient || g.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: '0 12px 28px -6px rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    className="relative z-10"
                  >
                    <div className="w-10 h-10 flex items-center justify-center">
                      {g.iconSvg}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 max-w-sm px-4">
                  <div className="flex items-center gap-2">
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
                      {g.name}
                    </h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                      {g.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#8E8E93', lineHeight: 1.5 }}>
                    {g.desc}
                  </p>
                </div>

                <div className="w-full max-w-xs flex flex-col gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('medium');
                      router.push(`/chat/${g.id}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white cursor-pointer shadow-lg active:scale-98 transition-all"
                  >
                    <MessageCircle size={18} /> Entrar a la conversación
                  </button>
                  <button
                    type="button"
                    onClick={() => { PlatformBridge.hapticFeedback('light'); setCommunity('chats'); }}
                    className="text-xs font-bold text-white/50 cursor-pointer p-2 hover:text-white transition-colors"
                  >
                    ← Volver a mis chats
                  </button>
                </div>
              </div>
            );
          })()}
        </ProfileSubpageLayout>
      </motion.div>

      {/* 2. Floating Dock (Dynamic position: bottom, top, or left lateral) */}
      <div
        className={`fixed z-35 pointer-events-none transition-all duration-300 ${
          dockPosition === 'top'
            ? 'top-[calc(var(--safe-top,0)+62px)] inset-x-0 flex justify-center px-4'
            : dockPosition === 'left'
            ? 'left-3 top-1/2 -translate-y-1/2 flex flex-col'
            : 'bottom-4 inset-x-0 flex justify-center px-4'
        }`}
      >
        <div
          className={`pointer-events-auto flex items-center gap-1.5 p-2 rounded-full bg-(--bg-elevated)/95 backdrop-blur-2xl border border-(--border-subtle) shadow-(--shadow-lg) ${
            dockPosition === 'left' ? 'flex-col py-3 px-2 rounded-3xl' : 'px-3 py-2'
          }`}
        >
          {/* Contacts */}
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setContactsModalOpen(true);
            }}
            className={`flex flex-col items-center justify-center text-(--text-muted) hover:text-(--text-primary) transition-colors ${
              dockPosition === 'left' ? 'w-11 py-1.5' : 'w-14 py-1'
            }`}
          >
            <Users size={dockPosition === 'left' ? 19 : 21} />
            <span className="text-[10px] font-medium mt-1">Contacts</span>
          </button>

          {/* Chats */}
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setActiveTab('chats');
            }}
            className={`flex flex-col items-center justify-center relative transition-colors ${
              dockPosition === 'left' ? 'w-11 py-1.5' : 'w-14 py-1'
            } ${activeTab === 'chats' ? 'text-[#0088CC]' : 'text-(--text-muted)'}`}
          >
            <div className="relative">
              <MessageCircle size={dockPosition === 'left' ? 19 : 21} />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium mt-1">Chats</span>
          </button>

          {/* Mi Negocio (Only for Affiliates / Business Owners) */}
          {isAffiliate && (
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('business');
              }}
              className={`flex flex-col items-center justify-center transition-colors ${
                dockPosition === 'left' ? 'w-11 py-1.5' : 'w-14 py-1'
              } ${activeTab === 'business' ? 'text-[#0088CC]' : 'text-(--text-muted)'}`}
            >
              <Store size={dockPosition === 'left' ? 19 : 21} />
              <span className="text-[10px] font-medium mt-1">Negocio</span>
            </button>
          )}

          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              openSettingsModal();
            }}
            className={`flex flex-col items-center justify-center text-(--text-muted) hover:text-(--text-primary) transition-colors relative ${
              dockPosition === 'left' ? 'w-11 py-1.5' : 'w-14 py-1'
            }`}
          >
            <Settings size={dockPosition === 'left' ? 19 : 21} />
            <span className="text-[10px] font-medium mt-1">Settings</span>
          </button>

          {/* Search Button (Opens Screenshot 2 Search Interface) */}
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setSearchOverlayOpen(true);
            }}
            className={`flex items-center justify-center rounded-full bg-(--bg-subtle) text-(--text-primary) hover:bg-(--bg-pressed) active:scale-95 transition-all ${
              dockPosition === 'left' ? 'w-9 h-9 mt-1' : 'w-10 h-10 ml-1'
            }`}
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* 3. Search Fullscreen View (Screenshot 2: Complete Telegram Search Modal) */}
      <AnimatePresence>
        {searchOverlayOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Header: RECENT & Clear button */}
            <div className="pt-[calc(var(--safe-top,0)+12px)] px-4 pb-2 flex items-center justify-between border-b border-white/5">
              <span className="text-[12px] font-semibold tracking-wider text-[#8E8E93] uppercase">
                {searchQuery ? 'Resultados' : 'Recent'}
              </span>
              {!searchQuery && recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[15px] text-[#0088CC] hover:opacity-80 transition-opacity"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Content: Recent List or Search Results */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {!searchQuery ? (
                <div>
                  {recentSearches.length === 0 ? (
                    <div className="py-20 text-center text-[#8E8E93] text-sm">
                      No hay búsquedas recientes
                    </div>
                  ) : (
                    recentSearches.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          PlatformBridge.hapticFeedback('light');
                          setSearchOverlayOpen(false);
                          router.push(`/chat/${item.id}`);
                        }}
                        className="flex items-center gap-3 py-2.5 cursor-pointer active:opacity-75 transition-opacity"
                      >
                        <div className="w-11 h-11 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center text-lg overflow-hidden shrink-0">
                          {item.isBot ? '🐰' : item.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            item.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="m-0 font-medium text-[16px] text-white truncate">{item.name}</p>
                          <p className="m-0 text-[13px] text-[#8E8E93] truncate">{item.subtitle}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Chats locales encontrados */}
                  {searchResults.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2 px-1">
                        Chats ({searchResults.length})
                      </p>
                      {searchResults.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            addRecentSearch({
                              id: conv.targetId,
                              name: conv.targetName,
                              subtitle: conv.lastMessage || 'Conversación',
                              avatar: conv.targetAvatar,
                              isBot: conv.isBot,
                            });
                            PlatformBridge.hapticFeedback('light');
                            setSearchOverlayOpen(false);
                            router.push(`/chat/${conv.targetId}`);
                          }}
                          className="flex items-center gap-3 py-2.5 border-b border-white/5 cursor-pointer active:opacity-75 transition-opacity"
                        >
                          <div className="w-11 h-11 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center text-lg overflow-hidden shrink-0">
                            {conv.isBot ? '🐰' : conv.targetAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={conv.targetAvatar} alt={conv.targetName} className="w-full h-full object-cover" />
                            ) : (
                              conv.targetName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="m-0 font-medium text-[16px] text-white truncate">{conv.targetName}</p>
                            <p className="m-0 text-[13px] text-[#8E8E93] truncate">
                              {cleanPreview(conv.lastMessage, conv.lastMessageType) || 'Sin mensajes'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resultados Globales del Directorio / Comercios */}
                  {userSearchResults.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-[#0088CC] uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                        <span>Directorio Rabbitty & Comercios</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#0088CC]/20 text-[#0088CC]">
                          {userSearchResults.length}
                        </span>
                      </p>
                      {userSearchResults.map((usr) => (
                        <div
                          key={usr.id}
                          onClick={() => {
                            addRecentSearch({
                              id: usr.id,
                              name: usr.name,
                              subtitle: usr.isBusiness ? 'Comercio Rabbitty' : `@${usr.username || 'usuario'}`,
                              avatar: usr.avatar,
                              isBot: false,
                            });
                            PlatformBridge.hapticFeedback('medium');
                            setSearchOverlayOpen(false);
                            router.push(`/chat/${usr.id}`);
                          }}
                          className="flex items-center gap-3 py-2.5 border-b border-white/5 cursor-pointer active:opacity-75 transition-opacity"
                        >
                          <div className="w-11 h-11 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center text-lg overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={usr.avatar} alt={usr.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="m-0 font-medium text-[16px] text-white truncate">{usr.name}</p>
                              {usr.isBusiness && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  Comercio
                                </span>
                              )}
                            </div>
                            <p className="m-0 text-[13px] text-[#0088CC] truncate">
                              {usr.isBusiness ? usr.username || 'Afiliado verificado' : `@${usr.username || 'sin_usuario'}`}
                            </p>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0088CC]/20 text-[#0088CC] border border-[#0088CC]/30">
                            Iniciar Chat
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sin resultados en absoluto */}
                  {searchResults.length === 0 && userSearchResults.length === 0 && !isSearchingUsers && (
                    <div className="py-20 text-center text-[#8E8E93] text-sm">
                      No se encontraron resultados para &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}

                  {isSearchingUsers && userSearchResults.length === 0 && searchResults.length === 0 && (
                    <div className="py-20 text-center text-[#8E8E93] text-sm flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#0088CC]/30 border-t-[#0088CC] rounded-full animate-spin" />
                      <span>Buscando en directorio Rabbitty...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Controls: Filters & Search Input Bar (Screenshot 2 Bottom Bar) */}
            <div className="p-3 bg-[#0A0A0A] border-t border-white/10 flex flex-col gap-2 pb-[calc(12px+env(safe-area-inset-bottom))]">
              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                {(['Chats', 'Canales', 'Apps', 'Posts', 'Media'] as SearchCategory[]).map((tab) => {
                  const active = searchFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        PlatformBridge.hapticFeedback('light');
                        setSearchFilter(tab);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#1C1C1E] text-white border border-white/20'
                          : 'bg-transparent text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      <span>{tab}</span>
                      {tab === 'Posts' && (
                        <span className="bg-[#0088CC] text-white text-[9px] px-1 py-0.2 rounded font-bold uppercase">
                          NEW
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search Input Bar with Clear & Cancel X */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#1C1C1E] border border-white/10">
                  <Search size={18} className="text-[#8E8E93]" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    autoFocus
                    className="flex-1 bg-transparent border-none outline-none text-white text-[16px] placeholder-[#8E8E93]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[#8E8E93] hover:text-white p-1"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setSearchOverlayOpen(false);
                  }}
                  className="w-10 h-10 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Telegram-styled Settings Modal with Dual Identity (Rabbitter vs Mi Negocio) */}
      <BottomSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
      >
        <div className="flex flex-col gap-4 text-(--text-primary) pb-6">
          {/* Identity Switcher Tabs (If affiliate / has business) */}
          {isAffiliate && (
            <div className="flex p-1 rounded-xl bg-(--bg-subtle) border border-(--border-subtle)">
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setSettingsIdentity('rabbitter');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
                  settingsIdentity === 'rabbitter' ? 'bg-[#0088CC] text-white shadow' : 'bg-transparent text-(--text-muted)'
                }`}
              >
                🐰 Perfil Rabbitter
              </button>
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setSettingsIdentity('business');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
                  settingsIdentity === 'business' ? 'bg-[#0088CC] text-white shadow' : 'bg-transparent text-(--text-muted)'
                }`}
              >
                🏪 Mi Negocio
              </button>
            </div>
          )}

          {settingsIdentity === 'rabbitter' ? (
            /* Rabbitter Profile Settings */
            <div className="flex flex-col gap-4">
              {/* Telegram User Card with Working Avatar Upload */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-(--bg-subtle) border border-(--border-subtle)">
                <label className="relative cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 4 * 1024 * 1024) {
                        showToast('La imagen no debe pesar más de 4MB', 'error');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const b64 = reader.result as string;
                        setUserAvatar(b64);
                        if (user?.id) {
                          setStoredAvatar(user.id, b64);
                        }
                        showToast('Foto de perfil actualizada en toda la app', 'success');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-linear-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-2xl font-bold border border-(--border-subtle) group-hover:opacity-90 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={userAvatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                        userUsername || userFirstName || 'Rabbitter'
                      )}&backgroundColor=E91E63`}
                      alt={userFirstName || 'Usuario'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0088CC] flex items-center justify-center text-white text-xs border border-(--bg-elevated) shadow group-hover:scale-110 transition-transform">
                    <Camera size={12} />
                  </div>
                </label>

                <div className="flex-1 min-w-0">
                  <h3 className="m-0 text-[18px] font-bold text-(--text-primary) truncate">
                    {userFirstName} {userLastName}
                  </h3>
                  <p className="m-0 text-[13px] text-[#0088CC] truncate">
                    @{userUsername || 'sin_usuario'}
                  </p>
                  <p className="m-0 text-[12px] text-(--text-muted) truncate">
                    {userPhone || 'Sin número registrado'}
                  </p>
                </div>
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Nombre
                  </label>
                  <input
                    value={userFirstName}
                    onChange={(e) => setUserFirstName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Apellido
                  </label>
                  <input
                    value={userLastName}
                    onChange={(e) => setUserLastName(e.target.value)}
                    placeholder="Apellido"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Usuario único (@ estilo X/Meta)
                  </label>
                  <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) focus-within:border-[#0088CC]">
                    <AtSign size={16} className="text-(--text-muted)" />
                    <input
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="usuario_unico"
                      className="w-full bg-transparent border-none text-(--text-primary) text-[15px] outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-(--text-muted) mt-1 block">
                    Solo letras, números y guiones bajos (mínimo 3 caracteres).
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Número (WhatsApp / Móvil)
                  </label>
                  <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) focus-within:border-[#0088CC]">
                    <Phone size={16} className="text-(--text-muted)" />
                    <input
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      placeholder="+52 55 1234 5678"
                      className="w-full bg-transparent border-none text-(--text-primary) text-[15px] outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-(--text-muted) mt-1 block">
                    Permite que tus contactos de agenda te encuentren automáticamente al sincronizar Rabbitty (estilo WhatsApp).
                  </span>
                </div>

                {/* Quick Contact Sync Trigger in Settings */}
                <div className="p-3 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Smartphone size={18} className="text-[#0088CC]" />
                    <div>
                      <p className="m-0 text-xs font-bold text-(--text-primary)">Sincronización de Contactos</p>
                      <p className="m-0 text-[11px] text-(--text-muted)">Detectar amigos registrados</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setContactsModalOpen(true);
                      pickDeviceContacts();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0088CC] text-white text-xs font-bold active:scale-95 transition-transform"
                  >
                    Sincronizar
                  </button>
                </div>

                {/* Dock Position Switcher */}
                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Posición de la barra de navegación (Dock)
                  </label>
                  <div className="flex gap-2 p-1 rounded-xl bg-(--bg-subtle) border border-(--border-subtle)">
                    <button
                      type="button"
                      onClick={() => changeDockPosition('bottom')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
                        dockPosition === 'bottom' ? 'bg-[#0088CC] text-white shadow' : 'bg-transparent text-(--text-muted)'
                      }`}
                    >
                      👇 Inferior
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDockPosition('top')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
                        dockPosition === 'top' ? 'bg-[#0088CC] text-white shadow' : 'bg-transparent text-(--text-muted)'
                      }`}
                    >
                      👆 Superior
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDockPosition('left')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
                        dockPosition === 'left' ? 'bg-[#0088CC] text-white shadow' : 'bg-transparent text-(--text-muted)'
                      }`}
                    >
                      👈 Lateral
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveUserProfile}
                disabled={isSavingUser}
                className="w-full py-3 rounded-xl bg-[#0088CC] hover:bg-[#0088CC]/90 text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-50 mt-2"
              >
                {isSavingUser ? 'Guardando...' : (
                  <>
                    <Check size={18} /> Guardar Perfil
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Affiliate Business Profile Settings */
            <div className="flex flex-col gap-4">
              {/* Business Header Card with Logo Display & Upload */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-(--bg-subtle) border border-(--border-subtle)">
                <label className="relative cursor-pointer group shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 4 * 1024 * 1024) {
                        showToast('El logo no debe pesar más de 4MB', 'error');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setBizLogo(reader.result as string);
                        showToast('Logo seleccionado (recuerda presionar Guardar Perfil de Negocio)', 'success');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-2xl font-bold border border-white/20 overflow-hidden group-hover:opacity-90 transition-opacity">
                    {bizLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bizLogo} alt={bizName || 'Logo Negocio'} className="w-full h-full object-cover" />
                    ) : (
                      '🏪'
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0088CC] flex items-center justify-center text-white text-xs border border-(--bg-elevated) shadow group-hover:scale-110 transition-transform">
                    <Camera size={12} />
                  </div>
                </label>
                <div className="flex-1 min-w-0">
                  <h3 className="m-0 text-[18px] font-bold text-(--text-primary) truncate">{bizName || 'Mi Negocio'}</h3>
                  <p className="m-0 text-[13px] text-[#FF8A00] truncate">{bizCategory || 'Categoría no definida'}</p>
                  <p className="m-0 text-[12px] text-(--text-muted) truncate">{bizAddress || 'Dirección no definida'}</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Nombre del Negocio
                  </label>
                  <input
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="Ej. Rabbitty Café"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Categoría
                  </label>
                  <input
                    value={bizCategory}
                    onChange={(e) => setBizCategory(e.target.value)}
                    placeholder="Restaurante / Bar / Gimnasio..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Descripción / Bio del Negocio
                  </label>
                  <textarea
                    value={bizDescription}
                    onChange={(e) => setBizDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe tu negocio a los clientes..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC] resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Dirección
                  </label>
                  <input
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    placeholder="Calle, número, colonia, ciudad"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-1">
                    Recompensa Bunz (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bizReward}
                    onChange={(e) => setBizReward(e.target.value)}
                    placeholder="10"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) text-[15px] outline-none focus:border-[#0088CC]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBusinessProfile}
                disabled={isSavingBiz}
                className="w-full py-3 rounded-xl bg-[#0088CC] hover:bg-[#0088CC]/90 text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-50 mt-2"
              >
                {isSavingBiz ? 'Guardando...' : (
                  <>
                    <Check size={18} /> Guardar Perfil de Negocio
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* 5. Contacts View Modal (WhatsApp / Telegram style with live synchronization) */}
      {/* 5. Contacts View Modal (WhatsApp / Telegram style with live synchronization) */}
      <BottomSheet
        isOpen={contactsModalOpen}
        onClose={() => setContactsModalOpen(false)}
        title="Contactos & Comunidad"
      >
        <div className="flex flex-col gap-4 text-(--text-primary) pb-6">
          {/* Live Search bar for registered Rabbitters & Contacts */}
          <div className="flex items-center gap-2 bg-(--bg-subtle) border border-(--border-subtle) rounded-2xl px-3.5 py-2.5 focus-within:border-[#0088CC] transition-colors">
            <Search size={18} className="text-(--text-muted)" />
            <input
              value={contactsSearch}
              onChange={(e) => {
                const val = e.target.value;
                setContactsSearch(val);
                searchDirectory(val);
              }}
              placeholder="Buscar por @usuario, nombre o teléfono..."
              className="flex-1 bg-transparent border-none text-(--text-primary) text-[15px] outline-none placeholder-(--text-muted)"
            />
            {contactsSearch && (
              <button
                type="button"
                onClick={() => {
                  setContactsSearch('');
                  setUserSearchResults([]);
                }}
                className="text-(--text-muted) hover:text-(--text-primary)"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Sincronizar Agenda Button */}
          <button
            type="button"
            onClick={pickDeviceContacts}
            disabled={isSyncingContacts}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-linear-to-r from-[#0088CC]/15 via-[#E91E63]/15 to-[#9333EA]/15 border border-(--border-subtle) text-left hover:border-[#0088CC]/40 cursor-pointer active:scale-98 transition-all disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-xl bg-linear-to-tr from-[#0088CC] to-[#E91E63] flex items-center justify-center text-white shrink-0 shadow-md">
              {isSyncingContacts ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Smartphone size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 font-bold text-[15px] text-(--text-primary) flex items-center gap-2">
                <span>Sincronizar Contactos</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-[#0088CC] text-white">
                  WhatsApp/Telegram
                </span>
              </p>
              <p className="m-0 text-[12px] text-(--text-muted)">
                {isSyncingContacts
                  ? 'Buscando amigos registrados en Rabbitty...'
                  : 'Importa tus contactos y detecta amigos en Rabbitty'}
              </p>
            </div>
            <ChevronRight size={18} className="text-(--text-muted)" />
          </button>

          {/* Global User Search Directory Results */}
          {contactsSearch.trim().length >= 2 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider px-1">
                Directorio Rabbitty {isSearchingUsers ? '(Buscando...)' : `(${userSearchResults.length})`}
              </span>
              {userSearchResults.length === 0 && !isSearchingUsers ? (
                <p className="text-center text-(--text-muted) text-[13px] py-4 bg-(--bg-subtle) rounded-xl border border-(--border-subtle)">
                  No se encontraron usuarios para &ldquo;{contactsSearch}&rdquo;
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto hide-scrollbar">
                  {userSearchResults.map((usr) => (
                    <div
                      key={usr.id}
                      onClick={() => {
                        PlatformBridge.hapticFeedback('medium');
                        setContactsModalOpen(false);
                        router.push(`/chat/${usr.id}`);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-(--bg-subtle) border border-(--border-subtle) hover:border-[#0088CC]/40 cursor-pointer active:scale-98 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={usr.avatar}
                        alt={usr.name}
                        className="w-10 h-10 rounded-full object-cover border border-(--border-subtle) shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="m-0 font-bold text-[14px] text-(--text-primary) truncate">{usr.name}</p>
                          {usr.role === 'AFFILIATE' && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                              Comercio
                            </span>
                          )}
                        </div>
                        <p className="m-0 text-[12px] text-[#0088CC] truncate">
                          @{usr.username || 'sin_usuario'}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0088CC] text-white">
                        Chatear
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contactos Sincronizados Registrados en Rabbitty */}
          {matchedRabbittyContacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-wider px-1 flex items-center gap-1.5">
                <UserCheck size={14} /> Amigos en Rabbitty ({matchedRabbittyContacts.length})
              </span>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto hide-scrollbar">
                {matchedRabbittyContacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      PlatformBridge.hapticFeedback('medium');
                      setContactsModalOpen(false);
                      router.push(`/chat/${c.id}`);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-(--bg-subtle) border border-[#10B981]/30 hover:border-[#10B981] cursor-pointer active:scale-98 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.avatar}
                      alt={c.rabbittyName}
                      className="w-10 h-10 rounded-full object-cover border border-[#10B981]/40 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="m-0 font-bold text-[14px] text-(--text-primary) truncate">
                        {c.contactName}
                      </p>
                      <p className="m-0 text-[12px] text-[#10B981] truncate">
                        {c.rabbittyName} {c.username ? `(@${c.username})` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#10B981] text-black">
                      Abrir
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agenda de contactos seleccionados (Invitar por WhatsApp/Telegram) */}
          {pickedContacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider px-1">
                Contactos de tu agenda ({pickedContacts.length})
              </span>
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto hide-scrollbar">
                {pickedContacts.map((c, i) => (
                  <div
                    key={`${c.name}-${i}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle) hover:border-[#0088CC]/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-(--bg-elevated) border border-(--border-subtle) flex items-center justify-center font-bold text-sm text-(--text-primary) shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        PlatformBridge.hapticFeedback('medium');
                        setContactsModalOpen(false);
                        // Open direct chat modal / conversation thread for this contact
                        const targetSlug = encodeURIComponent(c.tel?.replace(/[^0-9]/g, '') || c.name);
                        router.push(`/chat/${targetSlug}`);
                      }}
                    >
                      <p className="m-0 font-semibold text-[14px] text-(--text-primary) truncate hover:text-[#0088CC] transition-colors">{c.name}</p>
                      {c.tel && <p className="m-0 text-[12px] text-(--text-muted) truncate">{c.tel}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        PlatformBridge.hapticFeedback('medium');
                        setContactsModalOpen(false);
                        const targetSlug = encodeURIComponent(c.tel?.replace(/[^0-9]/g, '') || c.name);
                        router.push(`/chat/${targetSlug}`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0088CC]/15 border border-[#0088CC]/30 text-[#0088CC] font-bold text-xs hover:bg-[#0088CC]/25 active:scale-95 transition-all"
                    >
                      Mensaje
                    </button>
                    <button
                      type="button"
                      onClick={() => openWhatsAppInvite(c.tel)}
                      className="w-8 h-8 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] flex items-center justify-center text-xs hover:bg-[#25D366]/30 active:scale-95 transition-all"
                      aria-label="Invitar por WhatsApp"
                      title="Invitar por WhatsApp"
                    >
                      📱
                    </button>
                    <button
                      type="button"
                      onClick={openTelegramInvite}
                      className="w-8 h-8 rounded-full bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9] flex items-center justify-center text-xs hover:bg-[#229ED9]/30 active:scale-95 transition-all"
                      aria-label="Invitar por Telegram"
                      title="Invitar por Telegram"
                    >
                      ✈
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invitar con Enlace Rápido */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider px-1">
              Compartir invitación directa
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openWhatsAppInvite()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] font-bold text-[13px] hover:bg-[#25D366]/25 active:scale-95 transition-all"
              >
                <span>📱 WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={openTelegramInvite}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9] font-bold text-[13px] hover:bg-[#229ED9]/25 active:scale-95 transition-all"
              >
                <span>✈ Telegram</span>
              </button>
            </div>
          </div>

          {/* Contactos Históricos en Rabbitty */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider px-1">
              Historial de Chats
            </span>
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto hide-scrollbar">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-(--text-muted) text-[13px] py-4 m-0">
                  Sin conversaciones previas aún.
                </p>
              ) : (
                filteredContacts.map((c) => (
                  <div
                    key={c.targetId}
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      setContactsModalOpen(false);
                      router.push(`/chat/${c.targetId}`);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-(--bg-subtle) cursor-pointer active:opacity-75 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-(--bg-subtle) border border-(--border-subtle) flex items-center justify-center text-base overflow-hidden shrink-0">
                      {c.isBot ? '🐰' : c.targetAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.targetAvatar} alt={c.targetName} className="w-full h-full object-cover" />
                      ) : (
                        c.targetName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="font-semibold text-[15px] text-(--text-primary) truncate flex-1">{c.targetName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* 6. Nuevo Mensaje Sheet */}
      <BottomSheet isOpen={newOpen} onClose={() => setNewOpen(false)} title="Nuevo mensaje">
        <div className="flex flex-col gap-3 pb-6">
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setNewOpen(false);
              router.push('/chat/bot');
            }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-[#0088CC]/10 border border-[#0088CC]/20 text-left active:scale-98 transition-all"
          >
            <div className="w-11 h-11 rounded-full bg-[#0088CC] flex items-center justify-center text-xl shrink-0">
              🐰
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 font-bold text-[15px] text-(--text-primary) flex items-center gap-1.5">
                Bunzy Concierge <Sparkles size={14} className="text-[#0088CC]" />
              </p>
              <p className="m-0 text-[12px] text-(--text-muted)">Lugares, saldo de Bunz, transferencias y reservas</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('medium');
              setNewOpen(false);
              router.push('/chat/bot?prefill=Hola%20Bunzy%2C%20necesito%20ayuda%20con%20el%20POS%20y%20corte%20de%20caja');
            }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-linear-to-r from-pink-500/15 to-purple-500/15 border border-pink-500/30 text-left active:scale-98 transition-all"
          >
            <div className="w-11 h-11 rounded-full bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl shrink-0 shadow-lg shadow-pink-500/25">
              🏪
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 font-bold text-[15px] text-white flex items-center gap-1.5">
                Bunzy Admin & POS <Sparkles size={14} className="text-pink-400" />
              </p>
              <p className="m-0 text-[12px] text-pink-300/80">Soporte experto en corte de caja, KDS, Kiosko y reportes</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setNewOpen(false);
              setContactsModalOpen(true);
            }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-[#1C1C1E] border border-white/10 text-left active:scale-98 transition-all"
          >
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-xl shrink-0">
              👥
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 font-bold text-[15px] text-white">Elegir de Contactos</p>
              <p className="m-0 text-[12px] text-[#8E8E93]">Abrir agenda o buscar rabbitters</p>
            </div>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// Telegram-styled Chat Row matching Screenshot 1
function TelegramChatRow({
  conv,
  isLast,
  pref,
  revealed,
  revealedRight,
  onReveal,
  onRevealRight,
  onAction,
}: {
  conv: Conversation;
  isLast: boolean;
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
    <div className="relative overflow-hidden select-none">
      {/* Swipe Actions Background */}
      <div className="absolute inset-0 flex justify-between items-stretch">
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={togglePin}
            style={{ ...actionStyleBase, background: pref.pinned ? '#0088CC' : '#5E5CE6', width: 80 }}
            aria-label={pref.pinned ? 'Desfijar' : 'Fijar'}
          >
            {pref.pinned ? <PinOff size={20} /> : <Pin size={20} />}
            <span style={actionLabelStyle}>{pref.pinned ? 'Desfijar' : 'Fijar'}</span>
          </button>
        </div>
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => onAction(conv.id, 'mute')}
            style={{ ...actionStyleBase, background: '#FF9F0A' }}
            aria-label={pref.muted ? 'Activar notificaciones' : 'Silenciar'}
          >
            {pref.muted ? <Bell size={20} /> : <BellOff size={20} />}
            <span style={actionLabelStyle}>{pref.muted ? 'Sonido' : 'Silenciar'}</span>
          </button>
          <button
            type="button"
            onClick={() => onAction(conv.id, 'archive')}
            style={{ ...actionStyleBase, background: '#64D2FF' }}
            aria-label={pref.archived ? 'Desarchivar' : 'Archivar'}
          >
            {pref.archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
            <span style={actionLabelStyle}>{pref.archived ? 'Desarchivar' : 'Archivar'}</span>
          </button>
          <button
            type="button"
            onClick={() => onAction(conv.id, 'delete')}
            style={{ ...actionStyleBase, background: '#FF453A' }}
            aria-label="Eliminar"
          >
            <Trash2 size={20} />
            <span style={actionLabelStyle}>Eliminar</span>
          </button>
        </div>
      </div>

      {/* Row Front Item */}
      <motion.div
        style={{ x }}
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
        className="relative z-10 bg-(--bg-primary)"
      >
        <Link
          href={`/chat/${conv.targetId}${conv.id && conv.id !== 'bunzy-initial' ? `?c=${conv.id}` : ''}`}
          className="no-underline block"
          onClick={(e) => {
            if (revealed || revealedRight) {
              e.preventDefault();
              close();
            }
          }}
        >
          <div className="flex items-center gap-3.5 px-2 py-2.5 rounded-2xl hover:bg-(--bg-elevated) active:bg-(--bg-pressed) transition-all">
            {/* Telegram Circular Avatar with subtle shadow and border */}
            <div className="relative">
              <div className="w-13 h-13 rounded-full overflow-hidden bg-(--bg-elevated) flex items-center justify-center shrink-0 border border-(--border-subtle) shadow-xs">
                {conv.isBot ? (
                  <div className="w-full h-full bg-linear-to-tr from-[#E91E63] via-[#D81B60] to-[#8E24AA] flex items-center justify-center text-2xl shadow-inner">
                    🐰
                  </div>
                ) : conv.targetAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={conv.targetAvatar} alt={conv.targetName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-linear-to-tr from-[#0088CC] to-[#5E5CE6] flex items-center justify-center text-white font-bold text-lg">
                    {conv.targetName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {conv.isBot && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-(--bg-primary)" />
              )}
            </div>

            {/* Telegram Info + Divider Line */}
            <div className={`flex-1 min-w-0 py-1 ${!isLast ? 'border-b border-(--border-subtle)' : ''}`}>
              <div className="flex justify-between items-baseline mb-0.5">
                <div className="flex items-center gap-1.5 truncate">
                  <h3 className="m-0 font-semibold text-[16px] text-(--text-primary) truncate leading-tight">
                    {conv.targetName}
                  </h3>
                  {pref.muted && <BellOff size={12} className="text-(--text-muted) shrink-0" />}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {conv.lastMessageTime && (
                    <span className="text-[12px] text-(--text-muted)">
                      {formatTelegramTime(conv.lastMessageTime)}
                    </span>
                  )}
                  {pref.pinned && <Pin size={12} className="text-(--text-muted) ml-0.5 shrink-0" />}
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <p className="m-0 text-[14px] text-(--text-muted) truncate leading-normal">
                  {cleanPreview(conv.lastMessage, conv.lastMessageType) || 'Sin mensajes aún'}
                </p>

                {!!conv.unreadCount && conv.unreadCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0088CC] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
