'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { PlatformBridge } from '@/lib/platform';

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ACCOUNT_SECTIONS = [
  { icon: '💳', label: 'Mi Billetera', href: '/profile/wallet' },
  { icon: '📜', label: 'Historial', href: '/history' },
  { icon: '🏆', label: 'Logros y Misiones', href: '/profile/gamification' },
  { icon: '🎟', label: 'Mis Cupones', href: '/profile/inventory' },
  { icon: '👥', label: 'Invitar amigos', href: '/referral' },
];

const SETTINGS_SECTIONS = [
  { icon: '🔔', label: 'Notificaciones', href: '/notifications' },
  { icon: '🛡', label: 'Seguridad y Privacidad', href: '/security' },
  { icon: '❓', label: 'Ayuda y Soporte', href: '/support' },
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

    // Lock the page behind the drawer so the home doesn't scroll through the
    // faded overlay while the user scrolls inside the drawer.
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
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-200 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />

          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-201 w-[84%] max-w-85 flex flex-col"
            style={{
              background: 'var(--bg-primary)',
              borderRight: '1px solid var(--border-subtle)',
              paddingTop: 'var(--safe-top, 0px)',
              paddingBottom: 'var(--safe-bottom, 0px)',
              boxShadow: '20px 0 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header: Horizontal row (Avatar + Name/Handle + Bunz badge + Close) */}
            <div className="px-4 pt-3.5 pb-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10.5 h-10.5 rounded-full overflow-hidden p-0.5 border-2 border-[#E91E63] shrink-0" style={{ background: 'var(--bg-elevated)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`}
                      alt={user?.firstName || 'User'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-[15px] font-black tracking-tight text-(--text-primary) m-0 leading-tight truncate">
                        {user?.firstName || 'Explorador'}
                      </h2>
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(233, 30, 99, 0.12)', border: '1px solid rgba(233, 30, 99, 0.3)' }}>
                        <span className="text-[11px] font-black text-(--text-primary)">{bunzBalance.toLocaleString()}</span>
                        <span className="text-[9px] font-black text-[#E91E63]">BUNZ</span>
                      </div>
                    </div>
                    <p className="text-[12px] font-medium text-(--text-muted) m-0 truncate">
                      @{user?.username || 'explorador'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  aria-label="Cerrar"
                  className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-none shrink-0"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-(--border-subtle)" />

            {/* Navigation Items (Compact & balanced) */}
            <div className="flex-1 min-h-0 flex flex-col px-2.5 py-1.5 gap-0.5 overflow-hidden">
              {ACCOUNT_SECTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex-1 min-h-0 flex items-center gap-3 px-3 rounded-xl no-underline active:bg-(--bg-pressed) transition-colors"
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  <span className="flex-1 text-[14px] font-bold text-(--text-primary)">{item.label}</span>
                </Link>
              ))}

              <Link
                href="/business"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  onClose();
                }}
                className="flex-1 min-h-0 flex items-center gap-3 px-3 rounded-xl no-underline active:bg-(--bg-pressed) transition-colors"
              >
                <span className="text-base w-5 text-center">🏪</span>
                <span className="flex-1 text-[14px] font-bold text-(--text-primary)">Portal Comercio</span>
                {user?.role === 'AFFILIATE' && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 uppercase">
                    Socio
                  </span>
                )}
              </Link>

              <div className="h-px w-full shrink-0 bg-(--border-subtle) my-0.5" />

              {SETTINGS_SECTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex-1 min-h-0 flex items-center gap-3 px-3 rounded-xl no-underline active:bg-(--bg-pressed) transition-colors"
                >
                  <span className="text-sm w-5 text-center">{item.icon}</span>
                  <span className="flex-1 text-[13px] font-semibold text-(--text-secondary)">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Bottom: Minimal Icon-Only Row (Theme Toggle Sun/Moon + Logout Icon Button) */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {/* Sun/Moon Toggle without Auto mode */}
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
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'light' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'light' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'light' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Sun size={15} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Modo oscuro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('dark');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'dark' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'dark' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'dark' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Moon size={15} strokeWidth={2.4} />
                </button>
              </div>

              {/* Logout Icon Button in same row */}
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('warning');
                  onClose();
                  logout();
                }}
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
                className="h-9 px-3 rounded-xl flex items-center gap-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[12px] cursor-pointer active:scale-95 transition-transform"
              >
                <LogOut size={15} strokeWidth={2} />
                <span>Salir</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
