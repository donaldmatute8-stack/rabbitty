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
            {/* Header: Avatar, Name & Username like X */}
            <div className="px-5 pt-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="w-[56px] h-[56px] rounded-full overflow-hidden p-0.5 border-2 border-[#E91E63] shrink-0" style={{ background: 'var(--bg-elevated)' }}>
                  <img
                    src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`}
                    alt={user?.firstName || 'User'}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <button
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  aria-label="Cerrar"
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-none"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <h2 className="text-[19px] font-black tracking-tight text-[var(--text-primary)] m-0 leading-tight">
                  {user?.firstName || 'Explorador'}
                </h2>
                <p className="text-[13px] font-medium text-[var(--text-muted)] m-0 mt-0.5">
                  @{user?.username || 'explorador'}
                </p>
              </div>

              {/* Bunz Pill */}
              <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(233, 30, 99, 0.12)', border: '1px solid rgba(233, 30, 99, 0.3)' }}>
                <span className="text-[13px] font-black text-[var(--text-primary)]">{bunzBalance.toLocaleString()}</span>
                <span className="text-[10px] font-black text-[#E91E63] tracking-wide">BUNZ</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-[var(--border-subtle)] my-1" />

            {/* Scrollable Navigation Items */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {ACCOUNT_SECTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl no-underline active:bg-[var(--bg-pressed)] transition-colors"
                >
                  <span className="text-xl w-6 text-center">{item.icon}</span>
                  <span className="flex-1 text-[16px] font-bold text-[var(--text-primary)]">{item.label}</span>
                </Link>
              ))}

              {(user?.role === 'AFFILIATE') && (
                <Link
                  href="/business"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl no-underline active:bg-[var(--bg-pressed)] transition-colors"
                >
                  <span className="text-xl w-6 text-center">🏪</span>
                  <span className="flex-1 text-[16px] font-bold text-[var(--text-primary)]">Portal Comercio</span>
                </Link>
              )}

              <div className="h-px w-full bg-[var(--border-subtle)] my-3" />

              {SETTINGS_SECTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    onClose();
                  }}
                  className="flex items-center gap-4 px-4 py-2.5 rounded-2xl no-underline active:bg-[var(--bg-pressed)] transition-colors"
                >
                  <span className="text-lg w-6 text-center">{item.icon}</span>
                  <span className="flex-1 text-[15px] font-semibold text-[var(--text-secondary)]">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Bottom: Appearance Dark/Light Toggle + Logout */}
            <div className="px-5 pb-5 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="mb-3">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2 px-1">Tema</span>
                <ThemeToggle />
              </div>

              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('warning');
                  onClose();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-sm cursor-pointer active:scale-[0.98] transition-transform"
              >
                <span>🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
