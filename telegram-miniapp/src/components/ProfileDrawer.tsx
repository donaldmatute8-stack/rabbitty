'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import ThemeToggle from '@/components/ui/ThemeToggle';

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
            className="fixed inset-0 z-[200] bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />

          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-[201] w-[84%] max-w-[340px] flex flex-col"
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
                  <div className="w-[42px] h-[42px] rounded-full overflow-hidden p-0.5 border-2 border-[#E91E63] shrink-0" style={{ background: 'var(--bg-elevated)' }}>
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`}
                      alt={user?.firstName || 'User'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-[15px] font-black tracking-tight text-[var(--text-primary)] m-0 leading-tight truncate">
                        {user?.firstName || 'Explorador'}
                      </h2>
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(233, 30, 99, 0.12)', border: '1px solid rgba(233, 30, 99, 0.3)' }}>
                        <span className="text-[11px] font-black text-[var(--text-primary)]">{bunzBalance.toLocaleString()}</span>
                        <span className="text-[9px] font-black text-[#E91E63]">BUNZ</span>
                      </div>
                    </div>
                    <p className="text-[12px] font-medium text-[var(--text-muted)] m-0 truncate">
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
            <div className="h-px w-full bg-[var(--border-subtle)]" />

            {/* Navigation Items (Compact & balanced) */}
            <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-0.5">
              {ACCOUNT_SECTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl no-underline active:bg-[var(--bg-pressed)] transition-colors"
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  <span className="flex-1 text-[14px] font-bold text-[var(--text-primary)]">{item.label}</span>
                </Link>
              ))}

              {(user?.role === 'AFFILIATE') && (
                <Link
                  href="/business"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl no-underline active:bg-[var(--bg-pressed)] transition-colors"
                >
                  <span className="text-base w-5 text-center">🏪</span>
                  <span className="flex-1 text-[14px] font-bold text-[var(--text-primary)]">Portal Comercio</span>
                </Link>
              )}

              <div className="h-px w-full bg-[var(--border-subtle)] my-1" />

              {SETTINGS_SECTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-xl no-underline active:bg-[var(--bg-pressed)] transition-colors"
                >
                  <span className="text-sm w-5 text-center">{item.icon}</span>
                  <span className="flex-1 text-[13px] font-semibold text-[var(--text-secondary)]">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Bottom: Appearance Dark/Light Toggle + Logout */}
            <div className="px-3.5 pb-4 pt-2 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <ThemeToggle />

              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('warning');
                  onClose();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[12px] cursor-pointer active:scale-[0.98] transition-transform"
              >
                <span className="text-sm">🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
