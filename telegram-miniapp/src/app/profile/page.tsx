'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { HelpCircle, Sparkles, Wallet, Ticket, History, Store, Users, Trophy, Bell, ShieldCheck, ChevronRight, Settings, QrCode, LogOut, Trash2, Crown, BadgeCheck, Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import AdminPanel from '@/features/admin/AdminPanel';
import BunzGuide from '@/features/business/BunzGuide';
import { WelcomeRitual } from '@/components/ui/WelcomeRitual';
import { authorizeSensitiveAction } from '@/lib/securityVault';
import { promptForPin } from '@/components/security/PinPromptModal';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { useUserAvatar } from '@/lib/avatar';
import AnimatedBunz from '@/components/ui/AnimatedBunz';

interface UserProfile {
  id?: string;
  email?: string;
  firstName?: string;
  username?: string;
  hops?: number;
  role?: string;
  totalBunzEarned?: number;
  totalBunzSpent?: number;
  visitedBusinesses?: number;
  distinctBusinesses?: number;
}

interface GamificationLevelResponse {
  level?: {
    requiredHops?: number;
    name?: string;
  };
}

const ACCOUNT_ITEMS = [
  { icon: Wallet, label: 'Mi Billetera', desc: 'Saldo y movimientos', href: '/profile/wallet' },
  { icon: BadgeCheck, label: 'Mis Membresías', desc: 'Pases y beneficios', href: '/memberships' },
  { icon: Ticket, label: 'Mis Cupones', desc: 'Cupones y recompensas', href: '/profile/inventory' },
  { icon: History, label: 'Historial', desc: 'Movimientos y tickets', href: '/history' },
];

const COMMUNITY_ITEMS = [
  { icon: Store, label: 'Afiliados', desc: 'Comercios cerca de ti', href: '/business' },
  { icon: Users, label: 'Invitar amigos', desc: 'Gana Bunz por referido', href: '/referral' },
  { icon: Trophy, label: 'Logros y Misiones', desc: 'Insignias y niveles', href: '/profile/gamification' },
];

const PREFERENCE_ITEMS = [
  { icon: Bell, label: 'Notificaciones', desc: 'Ofertas y recordatorios', href: '/notifications' },
  { icon: ShieldCheck, label: 'Seguridad y Privacidad', desc: 'Acceso y datos', href: '/security' },
  { icon: HelpCircle, label: 'Ayuda y Soporte', desc: 'Estamos contigo', href: '/support' },
];

const LEVEL_GRADIENTS: Record<string, string> = {
  'Diamante': 'linear-gradient(135deg, #FFD700, #FFA500)',
  'Rubí': 'linear-gradient(135deg, #9C27B0, #E91E63)',
  'Oro': 'linear-gradient(135deg, #2196F3, #00BCD4)',
  'Plata': 'linear-gradient(135deg, #607D8B, #90A4AE)',
  'Bronce': 'linear-gradient(135deg, #795548, #A1887F)',
};
const DEFAULT_GRADIENT = '#E91E63';

export default function ProfilePage() {
  const router = useRouter();
  const { user: rawUser, logout } = useAuth();
  const user = rawUser as UserProfile | null;
  const userAvatar = useUserAvatar(rawUser, 'ffffff');
  const { showToast } = useToast();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showBunzGuide, setShowBunzGuide] = useState(false);
  const [nextLevelHops, setNextLevelHops] = useState(500);
  const [levelGradient, setLevelGradient] = useState(DEFAULT_GRADIENT);
  const [levelName, setLevelName] = useState('1');
  const [hasBusiness, setHasBusiness] = useState(false);
  const [showRitual, setShowRitual] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/business`, { headers }))
        .then(r => r.json())
        .then(d => {
          if (d.success && d.business) {
            setHasBusiness(true);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const handleAvatarTap = async () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current > 3000) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapTimeRef.current = now;

    PlatformBridge.hapticFeedback('light');

    const isOwner = 
      user?.role === 'ADMIN' ||
      user?.email === 'marco@rabbitty.me' ||
      user?.email === 'marco.munoz9@gmail.com' ||
      user?.username?.toLowerCase() === 'mardelbull' ||
      user?.username?.toLowerCase() === 'deltoro' ||
      user?.username?.toLowerCase() === 'marco';

    // Acceso administrativo: con un solo toque si es owner/admin, o gesto secreto de 5 toques
    if (isOwner || tapCountRef.current >= 5) {
      tapCountRef.current = 0;

      // 🛡️ Capa 1: verificación en SERVIDOR (allowlist + initData firmado).
      // El gesto de 5 toques no abre el panel a curiosos: sin ser God, ni aparece.
      try {
        const probe = await fetch('/api/auth/is-admin', { headers: await PlatformBridge.getAuthHeaders(), cache: 'no-store' });
        const probeData = await probe.json();
        if (!probeData?.isAdmin) {
          PlatformBridge.hapticFeedback('light');
          showToast('Esta área es exclusiva del equipo Rabbitty 🐰', 'info');
          return;
        }
      } catch {
        return; // sin red/respuesta válida: no abrir
      }

      PlatformBridge.hapticFeedback('medium');

      // 🛡️ Capa 2: Face ID / Touch ID / PIN del dispositivo
      const auth = await authorizeSensitiveAction(
        promptForPin,
        'Verifica con Face ID para acceder al Panel de Control de Rabbitty'
      );

      if (auth.ok) {
        PlatformBridge.hapticFeedback('success');
        setShowAdmin(true);
      } else if (auth.reason === 'locked') {
        showToast('Acceso bloqueado por reintentos de PIN. Espera un momento.', 'error');
      } else if (auth.reason === 'wrong_pin') {
        showToast('PIN incorrecto.', 'error');
      } else {
        showToast('Verificación de Face ID cancelada.', 'info');
      }
      return;
    }

    if (tapCountRef.current >= 3) {
      showToast(`${5 - tapCountRef.current} toques para consola de control...`, 'info');
      return;
    }

    showToast('Identidad NFT (Próximamente)', 'info');
  };

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/gamification`, { headers }))
        .then(r => r.json())
        .then((data: GamificationLevelResponse) => {
          if (data.level?.requiredHops) {
            setNextLevelHops(data.level.requiredHops);
          }
          const name = data.level?.name;
          if (name) {
            setLevelName(name);
            setLevelGradient(LEVEL_GRADIENTS[name] || DEFAULT_GRADIENT);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const handlePcLogin = async () => {
    PlatformBridge.hapticFeedback('light');
    if (PlatformBridge.isTelegram()) {
      try {
        const mod = await import('@twa-dev/sdk');
        const app = mod.default;
        if (app.showScanQrPopup) {
          app.showScanQrPopup({ text: "Escanea el código QR de tu PC" }, (qrText: string) => {
            (async () => {
              let qrToken = qrText;
              if (qrText.includes('qrlogin_')) {
                qrToken = qrText.split('qrlogin_')[1].split('&')[0].split('?')[0];
              } else if (qrText.startsWith('{')) {
                try {
                  const parsed = JSON.parse(qrText);
                  if (parsed.token) qrToken = parsed.token;
                } catch { /* ignore parse error */ }
              }
              try {
                const headers = await PlatformBridge.getAuthHeaders();
                const res = await fetch('/api/auth/qr/scan', {
                  method: 'POST',
                  headers: { ...headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ qrToken }),
                });
                const data = await res.json();
                if (data.success) {
                  if (app.closeScanQrPopup) {
                    try { app.closeScanQrPopup(); } catch { /* ignore */ }
                  }
                  showToast("¡Inicio de sesión exitoso en la PC! 🪄", 'success');
                } else {
                  showToast("Error: " + data.error, 'error');
                }
              } catch {
                showToast("Error de conexión", 'error');
              }
            })();
            return true;
          });
          return;
        }
      } catch {
        // Fallback al escáner interno
      }
    }
    router.push('/scan?flow=pc-login');
  };

  const hops = user?.hops ?? 0;
  const earned = user?.totalBunzEarned ?? 0;
  const spent = user?.totalBunzSpent ?? 0;
  const netBunz = Math.max(0, earned - spent);
  const visited = user?.distinctBusinesses ?? user?.visitedBusinesses ?? 0;
  const isAffiliate = user?.role === 'AFFILIATE' || hasBusiness;

  return (
    <>
      <ProfileSubpageLayout title="Perfil" showBack={false}>
        <div className="pb-6 space-y-4">
          {/* ── HERO ── */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative overflow-hidden rounded-[28px] border p-5"
            style={{
              borderColor: 'rgba(233,30,99,.28)',
              background: 'linear-gradient(145deg, rgba(233,30,99,.18) 0%, rgba(28,8,20,.94) 52%, rgba(7,3,8,1) 100%)',
              boxShadow: '0 18px 40px -24px rgba(233,30,99,.55)',
            }}
          >
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#E91E63]/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-[#7C3AED]/20 blur-3xl" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={handleAvatarTap}
                    className="relative h-[68px] w-[68px] shrink-0 rounded-[22px] p-[2px]"
                    style={{
                      background: levelGradient,
                      boxShadow: hops >= 500
                        ? '0 8px 22px rgba(0,0,0,.30), 0 0 20px rgba(233,30,99,.22)'
                        : '0 8px 22px rgba(0,0,0,.22)',
                    }}
                    aria-label="Perfil y acceso"
                  >
                    <Image
                      src={userAvatar}
                      alt={user?.firstName || 'User'}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full rounded-[20px] object-cover"
                    />
                    {hops >= 2000 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1B0A14] text-[#FFD36B] ring-1 ring-[#FFD36B]/50">
                        <Crown size={11} />
                      </span>
                    )}
                  </motion.button>

                  <div className="min-w-0">
                    <p className="truncate text-[19px] font-black leading-tight text-white">{user?.firstName || 'Rabbiter'}</p>
                    <p className="truncate text-[12px] text-white/50">@{user?.username || 'explorador'}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#E91E63]/35 bg-[#E91E63]/15 px-2 py-0.5 text-[10px] font-black text-[#FF7DBB]">
                      <Crown size={10} /> Lvl. {levelName}
                    </span>
                  </div>
                </div>

                <Link
                  href="/settings"
                  onClick={() => PlatformBridge.hapticFeedback('light')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-white/60 active:scale-95"
                  aria-label="Configuración"
                >
                  <Settings size={17} />
                </Link>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <span>Progreso de madriguera</span>
                  <span>{hops} / {nextLevelHops} Hops</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((hops / Math.max(1, nextLevelHops)) * 100, 100)}%` }}
                    transition={{ duration: 0.9, delay: 0.1 }}
                    style={{ background: levelGradient }}
                    className="h-full rounded-full"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.05] p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Saldo disponible</p>
                    <div className="flex items-baseline gap-2">
                      <AnimatedBunz value={netBunz} className="text-[34px] font-black leading-none text-white" />
                      <span className="text-sm font-black tracking-wide text-[#FF5FA8]">BUNZ</span>
                    </div>
                  </div>
                  <Link
                    href="/profile/wallet"
                    onClick={() => PlatformBridge.hapticFeedback('light')}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-black text-white/70 active:scale-95"
                  >
                    Ver billetera <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300/70">Ganados</p>
                    <AnimatedBunz value={earned} className="text-sm font-black text-emerald-300" />
                  </div>
                  <div className="rounded-xl border border-rose-400/15 bg-rose-400/10 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-rose-300/70">Usados</p>
                    <AnimatedBunz value={spent} className="text-sm font-black text-rose-300" />
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── ACCESOS RÁPIDOS ── */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { href: '/profile/wallet', icon: Wallet, label: 'Billetera' },
              { href: '/memberships', icon: BadgeCheck, label: 'Membresías' },
              { href: '/profile/inventory', icon: Gift, label: 'Cupones' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => PlatformBridge.hapticFeedback('light')}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-3 active:scale-[0.98] transition-transform"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E91E63]/20 bg-[#E91E63]/10 text-[#E91E63]">
                  <Icon size={17} strokeWidth={2.1} />
                </span>
                <span className="text-[11px] font-extrabold text-(--text-primary)">{label}</span>
              </Link>
            ))}
          </div>

          {/* ── STATS ── */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Hops', value: hops.toLocaleString() },
              { label: 'Negocios', value: visited.toLocaleString() },
              { label: 'Nivel', value: levelName },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-3 py-2.5 text-center">
                <p className="text-[15px] font-black text-(--text-primary)">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── NEGOCIO ── */}
          {isAffiliate ? (
            <div className="rounded-2xl border border-[#E91E63]/25 bg-gradient-to-br from-[#E91E63]/15 via-transparent to-transparent p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E91E63]/25 bg-[#E91E63]/15 text-[#E91E63]">
                  <Store size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black text-(--text-primary)">Portal de Negocio</p>
                  <p className="text-[11px] text-(--text-muted)">Gestiona tu negocio, campañas y tasa de Bunz</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/business"
                  onClick={() => PlatformBridge.hapticFeedback('light')}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#E91E63] px-3 py-2.5 text-[12px] font-black text-white active:scale-[0.98]"
                >
                  Ir al portal <ChevronRight size={13} />
                </Link>
                <button
                  type="button"
                  onClick={handlePcLogin}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-[11px] font-bold text-(--text-secondary) active:scale-[0.98]"
                >
                  <QrCode size={14} /> QR de PC
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/business"
              onClick={() => PlatformBridge.hapticFeedback('light')}
              className="flex items-center gap-3 rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E91E63]/20 bg-[#E91E63]/10 text-[#E91E63]">
                <Store size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-black text-(--text-primary)">¿Tienes un negocio?</p>
                <p className="text-[11px] text-(--text-muted)">Afíliate y otorga Bunz</p>
              </div>
              <ChevronRight size={16} className="text-(--text-muted)" />
            </Link>
          )}

          {/* ── MENÚ ── */}
          <MenuGroup title="Mi cuenta" items={ACCOUNT_ITEMS} />
          <MenuGroup title="Comunidad" items={COMMUNITY_ITEMS} />
          <MenuGroup title="Preferencias" items={PREFERENCE_ITEMS} />

          {/* ── APRENDE / REVIVE ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { PlatformBridge.hapticFeedback('light'); setShowBunzGuide(true); }}
              className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-3 text-left active:scale-[0.98] transition-transform"
            >
              <HelpCircle size={18} className="text-[#E91E63]" />
              <p className="mt-2 text-[12px] font-extrabold text-(--text-primary)">Economía Bunz</p>
              <p className="text-[10px] text-(--text-muted)">Cómo funciona</p>
            </button>
            <button
              type="button"
              onClick={() => { PlatformBridge.hapticFeedback('medium'); setShowRitual(true); }}
              className="rounded-2xl border border-[#E91E63]/25 bg-gradient-to-br from-[#E91E63]/15 to-transparent p-3 text-left active:scale-[0.98] transition-transform"
            >
              <Sparkles size={18} className="text-[#E91E63]" />
              <p className="mt-2 text-[12px] font-extrabold text-(--text-primary)">Ritual</p>
              <p className="text-[10px] text-(--text-muted)">Revive la experiencia</p>
            </button>
          </div>

          {/* ── SESIÓN ── */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) py-3.5 text-[13px] font-bold text-(--text-secondary) active:scale-[0.98] transition-transform"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => { PlatformBridge.hapticFeedback('medium'); setShowDeleteModal(true); }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 py-3 text-[11px] font-bold text-rose-400 active:scale-[0.98] transition-transform"
            >
              <Trash2 size={14} /> Eliminar cuenta permanentemente
            </button>
          </div>
        </div>
      </ProfileSubpageLayout>

      {/* MODAL DE ELIMINACIÓN DE CUENTA CON TRASPASO A TESORERÍA */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userBunzBalance={netBunz}
        onDeleted={() => {
          setShowDeleteModal(false);
          logout();
        }}
      />

      {/* ADMIN PANEL OVERLAY */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* RITUAL DE BIENVENIDA INMERSIVO REPRODUCIBLE */}
      {showRitual && <WelcomeRitual forceOpen={true} onComplete={() => setShowRitual(false)} />}

      {showBunzGuide && <BunzGuide onClose={() => setShowBunzGuide(false)} />}
    </>
  );
}

function MenuGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; desc: string; href: string }>;
}) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-(--text-muted)">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-elevated)">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => PlatformBridge.hapticFeedback('light')}
              className="flex items-center gap-3 px-3.5 py-3 transition-colors active:bg-(--bg-pressed)"
              style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--border-subtle) bg-white/[.04] text-[#E91E63]">
                <Icon size={17} strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-extrabold text-(--text-primary)">{item.label}</span>
                <span className="block text-[10px] text-(--text-muted)">{item.desc}</span>
              </span>
              <ChevronRight size={15} className="text-(--text-muted)" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
