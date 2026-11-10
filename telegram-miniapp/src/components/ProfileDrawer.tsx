'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
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
  Settings,
  MessageSquarePlus,
  ChevronDown,
  BadgeCheck
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { PlatformBridge } from '@/lib/platform';
import { useState } from 'react';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useUserAvatar } from '@/lib/avatar';
import AnimatedBunz from '@/components/ui/AnimatedBunz';

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const WALLET_ITEMS = [
  { icon: Wallet, label: 'Saldo y movimientos', href: '/profile/wallet' },
  { icon: Ticket, label: 'Mis Cupones', href: '/profile/inventory' },
  { icon: BadgeCheck, label: 'Mis Membresías', href: '/memberships' },
];

const GENERAL_ITEMS = [
  { icon: History, label: 'Historial', href: '/history' },
  { icon: Trophy, label: 'Logros y Misiones', href: '/profile/gamification' },
  { icon: UserPlus, label: 'Invitar amigos', href: '/referral' },
];

const SETTINGS_ITEMS = [
  { icon: Store, label: 'Portal Comercio', href: '/business', isBusiness: true },
  { icon: Bell, label: 'Notificaciones', href: '/notifications' },
  { icon: Settings, label: 'Configuración', href: '/settings' },
  { icon: ShieldCheck, label: 'Seguridad y Privacidad', href: '/security' },
  { icon: HelpCircle, label: 'Ayuda y Soporte', href: '/support' },
];

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(true);
  const [feedbackType, setFeedbackType] = useState<'BUG' | 'FEEDBACK'>('BUG');
  const avatarUrl = useUserAvatar(user, 'E91E63');

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
            className="fixed top-0 left-0 bottom-0 z-201 w-[75%] max-w-72 sm:max-w-80 flex flex-col justify-between border-r border-(--border-subtle) overflow-hidden"
            style={{
              background: 'var(--bg-primary)',
              paddingTop: 'calc(max(var(--safe-top, 0px), 12px) + 8px)',
              // El safe-area inferior lo aplica SOLO la barra de abajo:
              // si lo aplicamos aquí también, en la app nativa se duplica
              // y aparece ese margen raro.
              paddingBottom: 0,
              boxShadow: '10px 0 30px rgba(0, 0, 0, 0.12), 4px 0 10px rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* Header: X/Twitter style layout */}
            <div className="px-5 pt-1 pb-4 shrink-0">
              {/* Top Row: Avatar and Close Button */}
              <div className="flex items-center justify-between mb-3.5">
                {/* Main Avatar — “mancha”: cuadrado redondeado, rotado y pegado al borde */}
                <div className="relative shrink-0 -ml-3">
                  <div
                    className="h-[68px] w-[68px] overflow-hidden rounded-[22px] border-2 border-[#E91E63]"
                    style={{
                      background: 'var(--bg-elevated)',
                      transform: 'rotate(-8deg)',
                      boxShadow: '0 8px 22px rgba(0,0,0,0.45), 0 0 0 1px rgba(233,30,99,0.25), 0 0 18px rgba(233,30,99,0.22)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt={user?.firstName || 'User'}
                      className="h-full w-full object-cover"
                      style={{ transform: 'scale(1.06)' }}
                    />
                  </div>
                </div>

                {/* Right cluster: subtle affiliated businesses pill */}
                <div className="flex items-center gap-2 pr-4">
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
                  <AnimatedBunz value={bunzBalance} className="font-extrabold text-(--text-primary)" />
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
                {/* Mi Billetera: agrupa saldo, cupones y membresías */}
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setWalletOpen((v) => !v);
                  }}
                  className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl no-underline transition-all active:scale-[0.98] group hover:bg-(--bg-pressed)"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Wallet
                    size={21}
                    strokeWidth={2.2}
                    className="text-(--text-primary) group-hover:text-[#E91E63] shrink-0 transition-colors"
                  />
                  <span className="text-[15px] font-extrabold tracking-tight flex-1 text-left">
                    Mi Billetera
                  </span>
                  <ChevronDown
                    size={17}
                    className="text-(--text-muted) transition-transform duration-200"
                    style={{ transform: walletOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
                {walletOpen && (
                  <div className="flex flex-col gap-0.5 pl-5 ml-3 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
                    {WALLET_ITEMS.map((item) => {
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
                          style={{ color: 'var(--text-primary)' }}
                        >
                          <IconComponent
                            size={18}
                            strokeWidth={2.1}
                            className="text-(--text-muted) group-hover:text-[#E91E63] shrink-0 transition-colors"
                          />
                          <span className="text-[14px] font-bold tracking-tight flex-1">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}

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

                {/* Reportar error o Feedback (unificado en un solo renglón) */}
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setFeedbackType('FEEDBACK');
                    onClose();
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
                    Reportar error o Feedback
                  </span>
                </button>
              </div>
            </div>

            {typeof document !== 'undefined' &&
              createPortal(
                <FeedbackModal
                  isOpen={feedbackOpen}
                  onClose={() => setFeedbackOpen(false)}
                  initialType={feedbackType}
                />,
                document.body,
              )}

            {/* Bottom section: theme toggle + logout, perfectly vertically centered and compact */}
            <div 
              className="px-3.5 py-2.5 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] shrink-0 flex items-center justify-between gap-2.5"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Dark / Light Toggle */}
              <div
                className="flex items-center gap-1 p-1 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <button
                  type="button"
                  aria-label="Modo claro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('light');
                  }}
                  className="w-10 h-8 rounded-lg flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'light' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'light' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'light' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Sun size={16} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  aria-label="Modo oscuro"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setTheme('dark');
                  }}
                  className="w-10 h-8 rounded-lg flex items-center justify-center transition-all border-none cursor-pointer"
                  style={{
                    background: resolvedTheme === 'dark' ? 'var(--bg-primary)' : 'transparent',
                    color: resolvedTheme === 'dark' ? '#E91E63' : 'var(--text-muted)',
                    boxShadow: resolvedTheme === 'dark' ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <Moon size={16} strokeWidth={2.4} />
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

          {/* Cerrar: círculo 1.5x centrado SOBRE la línea del borde del sidebar.
              Va fuera del <aside> para quedar por encima del home (que se le
              encima 20px con z-index mayor). */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              onClose();
            }}
            aria-label="Cerrar menú"
            className="fixed z-[203] left-[calc(min(75vw,18rem)-21px)] sm:left-[calc(min(75vw,20rem)-21px)] flex h-[42px] w-[42px] items-center justify-center rounded-full border shadow-[0_6px_20px_rgba(0,0,0,0.35)] cursor-pointer"
            style={{
              top: 'calc(max(var(--safe-top, 0px), 12px) + 15px)',
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <ArrowLeft size={24} strokeWidth={2.4} />
          </motion.button>
        </>
      )}
    </AnimatePresence>
  );
}
