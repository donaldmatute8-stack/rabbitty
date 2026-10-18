'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sun, 
  Moon, 
  LogOut, 
  Wallet, 
  History, 
  Trophy, 
  Ticket, 
  UserPlus, 
  Store, 
  Bell, 
  ShieldCheck, 
  HelpCircle,
  Home
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { PlatformBridge } from '@/lib/platform';

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const MENU_ITEMS = [
  { icon: Wallet, label: 'Mi Billetera', href: '/profile/wallet' },
  { icon: History, label: 'Historial', href: '/history' },
  { icon: Trophy, label: 'Logros y Misiones', href: '/profile/gamification' },
  { icon: Ticket, label: 'Mis Cupones', href: '/profile/inventory' },
  { icon: UserPlus, label: 'Invitar amigos', href: '/referral' },
  { icon: Store, label: 'Portal Comercio', href: '/business', isBusiness: true },
  { icon: Bell, label: 'Notificaciones', href: '/notifications' },
  { icon: ShieldCheck, label: 'Seguridad y Privacidad', href: '/security' },
  { icon: HelpCircle, label: 'Ayuda y Soporte', href: '/support' },
];

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // Lock the page behind the drawer so the home doesn't scroll through the overlay
    const scrollY = window.scrollY;
    const { overflow, position, top, width } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  const bunzBalance = (user?.totalBunzEarned || 0) - (user?.totalBunzSpent || 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-200 bg-black/60"
            style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
          />

          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed top-0 left-0 bottom-0 z-201 w-[82%] max-w-85 flex flex-col justify-between"
            style={{
              background: 'var(--bg-primary)',
              borderRight: '1px solid var(--border-subtle)',
              paddingTop: 'calc(max(var(--safe-top, 0px), 8px) + 8px)',
              paddingBottom: 'calc(max(var(--safe-bottom, 0px), 8px) + 12px)',
              boxShadow: '24px 0 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header: X/Twitter style layout */}
            <div className="px-5 pt-2 pb-3 shrink-0">
              {/* Top Row: Avatar with subtle Home/Badge shadow, plus business avatars and close */}
              <div className="flex items-center justify-between mb-3">
                {/* Main Avatar with subtle home badge on bottom right corner */}
                <div className="relative">
                  <div 
                    className="w-11 h-11 rounded-full overflow-hidden p-0.5 border-2 border-[#E91E63]/80 shrink-0 shadow-sm"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`}
                      alt={user?.firstName || 'User'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  {/* Mini Home icon with soft glow & corner shadow */}
                  <div 
                    className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white"
                    style={{ 
                      background: '#E91E63',
                      boxShadow: '0 2px 6px rgba(233, 30, 99, 0.45)',
                      border: '1.5px solid var(--bg-primary)'
                    }}
                  >
                    <Home size={9} strokeWidth={2.8} />
                  </div>
                </div>

                {/* Right cluster: subtle affiliated businesses pill + Close button */}
                <div className="flex items-center gap-2">
                  {user?.role === 'AFFILIATE' && (
                    <div 
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ 
                        background: 'rgba(233, 30, 99, 0.12)', 
                        border: '1px solid rgba(233, 30, 99, 0.28)' 
                      }}
                    >
                      <Store size={10} className="text-[#E91E63]" />
                      <span className="text-[10px] font-black text-[#E91E63] tracking-wide">SOCIO</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      onClose();
                    }}
                    aria-label="Cerrar menú"
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-none shrink-0"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* User Name & Handle */}
              <div className="mb-2.5">
                <h2 className="text-base font-black tracking-tight text-(--text-primary) m-0 leading-tight truncate">
                  {user?.firstName || 'Explorador Rabbitty'}
                </h2>
                <p className="text-xs font-medium text-(--text-muted) m-0 mt-0.5 truncate">
                  @{user?.username || 'explorador'}
                </p>
              </div>

              {/* Followers / Stats Row (Twitter style) */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-(--text-primary)">{bunzBalance.toLocaleString()}</span>
                  <span className="text-(--text-muted)">Bunz</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-(--text-primary)">
                    {user?.role === 'AFFILIATE' ? '1' : '0'}
                  </span>
                  <span className="text-(--text-muted)">Negocios</span>
                </div>
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="h-px w-full bg-(--border-subtle) opacity-60" />

            {/* Single Consolidated Navigation Menu (Clean Twitter/X style list) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-0.5 scrollbar-hide">
              {MENU_ITEMS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      onClose();
                    }}
                    className="flex items-center gap-4 px-3.5 py-3 rounded-2xl no-underline transition-all active:scale-[0.98] group"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <IconComponent 
                      size={20} 
                      strokeWidth={2}
                      className="text-(--text-secondary) group-hover:text-[#E91E63] shrink-0 transition-colors" 
                    />
                    <span className="text-[15px] font-bold tracking-tight flex-1">
                      {item.label}
                    </span>
                    {item.isBusiness && user?.role === 'AFFILIATE' && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 uppercase">
                        Activo
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Bottom section: smaller typography, theme toggle + logout in single row */}
            <div 
              className="px-4 pt-3 pb-1 shrink-0 flex items-center justify-between gap-3"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Dark / Light Toggle */}
              <div
                className="flex items-center gap-1 p-0.5 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <button
                  type="button"
                  aria-label="Modo claro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('light');
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'light' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'light' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'light' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Sun size={14} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Modo oscuro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('dark');
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'dark' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'dark' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'dark' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Moon size={14} strokeWidth={2.4} />
                </button>
              </div>

              {/* Logout button (compact typography) */}
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('warning');
                  onClose();
                  logout();
                }}
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
                className="h-8 px-3 rounded-xl flex items-center gap-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[11px] cursor-pointer active:scale-95 transition-transform"
              >
                <LogOut size={13} strokeWidth={2.2} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
