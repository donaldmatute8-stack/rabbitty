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
  Bug,
  MessageSquarePlus
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { PlatformBridge } from '@/lib/platform';
import { useState } from 'react';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const GENERAL_ITEMS = [
  { icon: Wallet, label: 'Mi Billetera', href: '/profile/wallet' },
  { icon: History, label: 'Historial', href: '/history' },
  { icon: Trophy, label: 'Logros y Misiones', href: '/profile/gamification' },
  { icon: Ticket, label: 'Mis Cupones', href: '/profile/inventory' },
  { icon: UserPlus, label: 'Invitar amigos', href: '/referral' },
];

const SETTINGS_ITEMS = [
  { icon: Store, label: 'Portal Comercio', href: '/business', isBusiness: true },
  { icon: Bell, label: 'Notificaciones', href: '/notifications' },
  { icon: ShieldCheck, label: 'Seguridad y Privacidad', href: '/security' },
  { icon: HelpCircle, label: 'Ayuda y Soporte', href: '/support' },
];

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'BUG' | 'FEEDBACK'>('BUG');

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
            className="fixed top-0 left-0 bottom-0 z-201 w-[75%] max-w-72 sm:max-w-80 flex flex-col justify-between rounded-r-2xl border-r border-(--border-subtle) overflow-hidden"
            style={{
              background: 'var(--bg-primary)',
              paddingTop: 'calc(max(var(--safe-top, 0px), 12px) + 8px)',
              paddingBottom: 'calc(max(var(--safe-bottom, 0px), 8px) + 8px)',
              boxShadow: '10px 0 30px rgba(0, 0, 0, 0.12), 4px 0 10px rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* Header: X/Twitter style layout */}
            <div className="px-5 pt-1 pb-4 shrink-0">
              {/* Top Row: Avatar and Close Button */}
              <div className="flex items-center justify-between mb-3.5">
                {/* Main Avatar */}
                <div className="relative">
                  <div 
                    className="w-12 h-12 rounded-full overflow-hidden p-0.5 border-2 border-[#E91E63] shrink-0 shadow-sm"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`}
                      alt={user?.firstName || 'User'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </div>

                {/* Right cluster: subtle affiliated businesses pill + Close button */}
                <div className="flex items-center gap-2">
                  {user?.role === 'AFFILIATE' && (
                    <div 
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full"
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
              <div className="mb-3">
                <h2 className="text-lg font-black tracking-tight text-(--text-primary) m-0 leading-tight truncate">
                  {user?.firstName || 'Explorador Rabbitty'}
                </h2>
                <p className="text-xs font-medium text-(--text-muted) m-0 mt-0.5 truncate">
                  @{user?.username || 'explorador'}
                </p>
              </div>

              {/* Stats Row (Following / Followers style) */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-(--text-primary)">{bunzBalance.toLocaleString()}</span>
                  <span className="text-(--text-muted)">Bunz</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-(--text-primary)">
                    {user?.role === 'AFFILIATE' ? '1' : '0'}
                  </span>
                  <span className="text-(--text-muted)">Negocios</span>
                </div>
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="h-px w-full bg-(--border-subtle) opacity-40 my-1" />

            {/* Navigation Menu (Group 1: Principal, Group 2: Negocio y Ajustes) */}
            <div className="flex-1 min-h-0 flex flex-col justify-between px-3 py-3 overflow-y-auto gap-3">
              {/* Grupo Principal (tarjeta redondeada con sombra y borde sutil estilo Twitter/iOS) */}
              <div 
                className="flex flex-col gap-1 p-2 rounded-2xl"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                }}
              >
                {GENERAL_ITEMS.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        PlatformBridge.hapticFeedback('light');
                        onClose();
                      }}
                      className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl no-underline transition-all active:scale-[0.98] group hover:bg-(--bg-pressed)"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <IconComponent 
                        size={21} 
                        strokeWidth={2.2}
                        className="text-(--text-primary) group-hover:text-[#E91E63] shrink-0 transition-colors" 
                      />
                      <span className="text-[15px] font-extrabold tracking-tight flex-1">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Grupo Secundario / Ajustes (tarjeta redondeada con borde sutil) */}
              <div 
                className="flex flex-col gap-0.5 p-2 rounded-2xl"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                }}
              >
                {SETTINGS_ITEMS.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        PlatformBridge.hapticFeedback('light');
                        onClose();
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl no-underline transition-all active:scale-[0.98] group hover:bg-(--bg-pressed)"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <IconComponent 
                        size={18} 
                        strokeWidth={2}
                        className="text-(--text-muted) group-hover:text-[#E91E63] shrink-0 transition-colors" 
                      />
                      <span className="text-[13px] font-semibold tracking-tight flex-1 group-hover:text-(--text-primary) transition-colors">
                        {item.label}
                      </span>
                      {item.isBusiness && user?.role === 'AFFILIATE' && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 uppercase tracking-wider">
                          Socio
                        </span>
                      )}
                    </Link>
                  );
                })}

                <div className="h-px bg-[var(--border-subtle)] my-1" />

                {/* Report a bug */}
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setFeedbackType('BUG');
                    setFeedbackOpen(true);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98] group hover:bg-(--bg-pressed) cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Bug 
                    size={18} 
                    strokeWidth={2}
                    className="text-(--text-muted) group-hover:text-red-400 shrink-0 transition-colors" 
                  />
                  <span className="text-[13px] font-semibold tracking-tight flex-1 group-hover:text-(--text-primary) transition-colors">
                    Report a bug
                  </span>
                </button>

                {/* Leave Feedback */}
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setFeedbackType('FEEDBACK');
                    setFeedbackOpen(true);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98] group hover:bg-(--bg-pressed) cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <MessageSquarePlus 
                    size={18} 
                    strokeWidth={2}
                    className="text-(--text-muted) group-hover:text-[#E91E63] shrink-0 transition-colors" 
                  />
                  <span className="text-[13px] font-semibold tracking-tight flex-1 group-hover:text-(--text-primary) transition-colors">
                    Leave Feedback
                  </span>
                </button>
              </div>
            </div>

            <FeedbackModal
              isOpen={feedbackOpen}
              onClose={() => setFeedbackOpen(false)}
              initialType={feedbackType}
            />

            {/* Bottom section: theme toggle + logout, perfectly vertically centered and compact */}
            <div 
              className="px-3.5 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] shrink-0 flex items-center justify-between gap-2.5"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Dark / Light Toggle */}
              <div
                className="flex items-center gap-0.5 p-0.5 rounded-lg"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <button
                  type="button"
                  aria-label="Modo claro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('light');
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'light' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'light' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'light' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Sun size={13} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Modo oscuro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('dark');
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'dark' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'dark' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'dark' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Moon size={13} strokeWidth={2.4} />
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
                className="h-7.5 px-3 rounded-lg flex items-center gap-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[11.5px] cursor-pointer active:scale-95 transition-transform"
              >
                <LogOut size={12} strokeWidth={2.2} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
