'use client';

/**
 * ── /settings ── Ajustes estilo X (Twitter): filas con switches de notificaciones
 * (push nativo / campana in-app / email). ÚNICA pantalla de settings — se entra
 * desde el panel de notificaciones (⚙️) o desde el menú lateral; ambas llegan
 * a ESTA página (sin código duplicado), con deep-link ?section=notifications.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from '@rabbitty/ui';
import { ArrowLeft, Bell, BellRing, Smartphone, Mail, ShieldCheck, HelpCircle, ChevronRight, Megaphone } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';
import { readSettings, saveSettings, subscribeSettings, type UserSettings } from '@/lib/userSettings';

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={onChange}
      aria-pressed={on ? 'true' : 'false'}
      className="relative cursor-pointer border-none shrink-0 transition-colors"
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        background: on ? '#E91E63' : 'var(--bg-pressed)',
        border: on ? 'none' : '1px solid var(--border-subtle)',
        transition: 'background 180ms ease',
      }}
    >
      <motion.span
        animate={{ x: on ? 21 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1/2 -translate-y-1/2 left-[2px] w-[22px] h-[22px] rounded-full bg-white shadow-md"
      />
    </motion.button>
  );
}

const SETTINGS_COPY = {
  nativePush: {
    label: 'Notificaciones push',
    desc: 'Alertas del sistema en tu teléfono: mensajes, cercanía y pagos.',
    icon: Smartphone,
  },
  inAppBell: {
    label: 'Campana en la app',
    desc: 'Historial dentro de Rabbitty. Si la apagas, el push sigue llegando y marca el ícono.',
    icon: BellRing,
  },
  email: {
    label: 'Email',
    desc: 'Resúmenes y alertas a tu correo (disponible próximamente).',
    icon: Mail,
  },
} as const;

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({ nativePush: true, inAppBell: true, email: false });
  const [highlight, setHighlight] = useState(false);
  const notiSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(readSettings());
    const unsubscribe = subscribeSettings(setSettings);
    // H22 · plano CANAL: el worker lee `users.pushInAppEnabled`, así que el
    // switch "Notificaciones en la app" debe hidratarse del server (fuente de
    // verdad), no solo del storage local.
    if (user?.id) {
      void (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const res = await fetch('/api/notifications/preferences', { headers: headers || {}, cache: 'no-store' });
          const data = await res.json();
          if (typeof data?.inAppEnabled === 'boolean') {
            const merged = { ...readSettings(), inAppBell: data.inAppEnabled };
            setSettings(merged);
            saveSettings(merged);
          }
        } catch { /* best-effort */ }
      })();
    }
    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    if (section === 'notifications') {
      setHighlight(true);
      const t = setTimeout(() => {
        notiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
      const t2 = setTimeout(() => setHighlight(false), 2600);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [section]);

  const toggle = async (key: keyof UserSettings) => {
    PlatformBridge.hapticFeedback('light');
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings(next);
    if (!user?.id) return;
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      if (key === 'nativePush') {
        // Al apagar el push nativo desactivamos los tokens del dispositivo (el
        // motor deja de enviar); al encender, AuthProvider re-registra el token
        // (POST /api/notifications/push-token) → isActive.
        await fetch('/api/notifications/push-token', {
          method: next.nativePush ? 'POST' : 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: next.nativePush ? JSON.stringify({ rearm: true }) : JSON.stringify({}),
        });
      } else if (key === 'inAppBell') {
        // H22 · plano CANAL: apagar la campana NO apaga el push nativo — el
        // worker deja de insertar la campana pero el push sí sale y marca el
        // badge iOS (semántica tipo Facebook).
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inAppEnabled: next.inAppBell }),
        });
      }
    } catch { /* best-effort */ }
  };

  return (
    <div className="page-wrap pb-28 min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div style={{ height: 'var(--safe-top, 0px)' }} />
      <div className="flex items-center gap-3 px-5 py-3 sticky top-0 z-20" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => { PlatformBridge.hapticFeedback('light'); router.back(); }}
          aria-label="Volver"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none active:scale-90 transition-transform"
          style={{ background: 'var(--bg-pressed)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-black tracking-tight m-0">Configuración</h1>
      </div>

      {!authLoading && user?.id ? (
        <div className="px-4 py-4 space-y-6">
          {/* ── Notificaciones (push y email) ── */}
          <div
            ref={notiSectionRef}
            className="rounded-2xl p-4"
            style={{
              background: 'var(--bg-elevated)',
              border: highlight ? '1px solid #E91E63' : '1px solid var(--border-subtle)',
              boxShadow: highlight ? '0 0 0 4px rgba(233,30,99,0.15)' : '0 2px 10px rgba(0,0,0,0.03)',
              transition: 'box-shadow 400ms ease, border-color 400ms ease',
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <Bell size={15} className="text-[#E91E63]" />
              <span className="text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: 'var(--text-muted)' }}>
                Notificaciones · push & email
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {(Object.keys(SETTINGS_COPY) as Array<keyof typeof SETTINGS_COPY>).map((key) => {
                const row = SETTINGS_COPY[key];
                const Icon = row.icon;
                const on = settings[key] as boolean;
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (key !== 'email') void toggle(key); }}
                    onKeyDown={(e) => { if (key !== 'email' && (e.key === 'Enter' || e.key === ' ')) void toggle(key); }}
                    className="flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors hover:bg-(--bg-pressed)"
                  >
                    <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-pressed)' }}>
                      <Icon size={17} className={on ? 'text-[#E91E63]' : 'text-(--text-muted)'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold m-0 leading-tight">{row.label}</p>
                      <p className="text-[11px] m-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {row.desc}
                      </p>
                    </div>
                    <Switch on={key === 'email' ? false : on} onChange={() => { if (key !== 'email') void toggle(key); }} />
                  </div>
                );
              })}
            </div>


            {/* ── Preferencias por categoría (v2.1 §2.2) — solo cuando el push nativo está ON ── */}
            {settings.nativePush && (
              <>
                <CategoryMuteRows />
                <CategoryRulesRows />
              </>
            )}

            {/* ── Diagnóstico de push (¿APNs en Vercel + dispositivo registrado?) ── */}
            <PushDiagnosticsRow />
          </div>

          <BunzyConnectRows />

          {/* ── Accesos rápidos ── */}
          <div className="rounded-2xl p-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <LinkRow icon={ShieldCheck} label="Seguridad y Privacidad" href="/security" />
            <LinkRow icon={HelpCircle} label="Ayuda y Soporte" href="/support" />
          </div>
        </div>
      ) : (
        <p className="text-center text-xs py-10" style={{ color: 'var(--text-muted)' }}>Inicia sesión para ver tus ajustes.</p>
      )}

      <BottomNav isDark={!user} />
    </div>
  );
}

/**
 * ── BunzyConnectRows ── Preferencias del canal oficial de Bunzy.
 * Los avisos de sistema siempre llegan; producto/tips/novedades se pueden apagar.
 */
function BunzyConnectRows() {
  const [prefs, setPrefs] = useState({ product: true, tips: true, news: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/bunzy/preferences', { headers: headers || {}, cache: 'no-store' });
        const data = await res.json();
        if (data?.success) {
          setPrefs({
            product: data.product !== false,
            tips: data.tips !== false,
            news: data.news !== false,
          });
        }
      } catch {
        /* best-effort */
      }
    })();
  }, []);

  const toggle = (key: 'product' | 'tips' | 'news') => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    void (async () => {
      setSaving(true);
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        await fetch('/api/bunzy/preferences', {
          method: 'POST',
          headers: { ...(headers || {}), 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
      } catch {
        toast.error('No se pudo guardar la preferencia');
      } finally {
        setSaving(false);
      }
    })();
  };

  const rows: Array<{ key: 'product' | 'tips' | 'news'; label: string; desc: string }> = [
    { key: 'product', label: 'Actualizaciones de producto', desc: 'Nuevas funciones y mejoras de Rabbitty.' },
    { key: 'tips', label: 'Tips y acompañamiento', desc: 'Consejos prácticos, máximo 1 por semana.' },
    { key: 'news', label: 'Novedades de Rabbitty', desc: 'Campañas y eventos, 1–2 al mes.' },
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <Megaphone size={15} className="text-[#E91E63]" />
        <span className="text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: 'var(--text-muted)' }}>
          Bunzy Connect · actualizaciones
        </span>
        {saving && <span className="ml-auto text-[9px]" style={{ color: 'var(--text-muted)' }}>Guardando…</span>}
      </div>

      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.key}
            role="button"
            tabIndex={0}
            onClick={() => toggle(row.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') toggle(row.key);
            }}
            className="flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors hover:bg-(--bg-pressed)"
          >
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-pressed)' }}>
              <Megaphone size={16} className={prefs[row.key] ? 'text-[#E91E63]' : 'text-(--text-muted)'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold m-0 leading-tight">{row.label}</p>
              <p className="text-[11px] m-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{row.desc}</p>
            </div>
            <Switch on={prefs[row.key]} onChange={() => toggle(row.key)} />
          </div>
        ))}
      </div>

      <p className="text-[10.5px] leading-relaxed m-0 mt-2 px-2" style={{ color: 'var(--text-muted)' }}>
        Los avisos de servicio (mantenimiento, seguridad) siempre llegan.
      </p>
    </div>
  );
}

/**
 * ── CategoryMuteRows ── Preferencias por categoría (v2.1 §2.2): 6 toggles
 * embebidos bajo el master de push nativo. Mute = { muted: [...activas] }
 * (representación de silenciados). CRITICAL/SYSTEM no son categorías y jamás
 * aparecen. Cambio optimista + POST al server (best-effort como el resto).
 */
const PREFERENCE_CATEGORIES = [
  { key: "chat", label: "Chat y mensajes", desc: "Conversaciones con negocios y amigos" },
  { key: "rewards", label: "Recompensas Bunz", desc: "Ganancias, gastos y transferencias" },
  { key: "orders", label: "Órdenes y cuentas", desc: "Pago confirmado, cuenta enviada, propinas" },
  { key: "proximity", label: "Cercanía al local", desc: "Llegada y recordatorios de check-in" },
  { key: "memberships", label: "Membresías", desc: "Altas, renovaciones y revocaciones" },
  { key: "marketing", label: "Marketing y ofertas", desc: "Ofertas flash y campañas de tus lugares" },
];
// Sincronizado con lib/push/categories.ts — CRITICAL/SYSTEM no son categorías y jamás se silencian.

function CategoryMuteRows() {
  const [muted, setMuted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch("/api/notifications/preferences", { headers: headers || {}, cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data?.muted)) setMuted(data.muted as string[]);
    } catch { /* sin server: quedan defaults(on) */ }
    setLoaded(true);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggleCategory = async (cat: string) => {
    const next = muted.includes(cat) ? muted.filter((c) => c !== cat) : [...muted, cat];
    setMuted(next);
    PlatformBridge.hapticFeedback("light");
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { ...(headers || {}), "Content-Type": "application/json" },
        body: JSON.stringify({ muted: next }),
      });
    } catch { /* best-effort (optimista) */ }
  };

  if (!loaded) return null;

  return (
    <div className="mt-2 rounded-xl" style={{ border: "1px dashed var(--border-subtle)", padding: 6 }}>
      <p className="text-[10px] font-black uppercase tracking-[1.5px] m-0 px-2 pt-1.5" style={{ color: "var(--text-muted)" }}>
        Qué notificaciones quieres recibir
      </p>
      {PREFERENCE_CATEGORIES.map((cat) => {
        const on = !muted.includes(cat.key);
        return (
          <div
            key={cat.key}
            role="button"
            tabIndex={0}
            onClick={() => { void toggleCategory(cat.key); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void toggleCategory(cat.key); }}
            className="flex items-start gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors hover:bg-(--bg-pressed)"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold m-0 leading-tight">{cat.label}</p>
              <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>{cat.desc}</p>
            </div>
            <Switch on={on} onChange={() => { void toggleCategory(cat.key); }} />
          </div>
        );
      })}
      <p className="text-[9px] m-0 px-2 pb-1.5" style={{ color: "var(--text-muted)" }}>
        Si apagas una categoría dejas de recibir su campana y su push. Los pagos, cuentas y avisos de
        seguridad siempre llegan — por tu protección.
      </p>
    </div>
  );
}

/**
 * ── CategoryRulesRows (v2.1 §2.4) ── reglas opt-in por Rabbitter (módulo de
 * reglas activables/desactivables desde Ajustes). Cada regla describe SU efecto
 * (ej. " TODAS las alertas de afiliados cerca, sin límite anti-spam").
 * Persisto en users.pushRules vía POST /api/notifications/preferences.
 */
const RULE_CATALOG = [
  {
    key: 'proximityAllAlerts',
    label: 'Recibir TODAS las alertas near',
    desc: 'Sin límite anti-spam de 12h por negocio — llega cada alerta de cercanía (máx 1 por negocio cada 5 min).',
  },
];

function CategoryRulesRows() {
  const [rules, setRules] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/notifications/preferences', { headers: headers || {}, cache: 'no-store' });
      const data = await res.json();
      if (data?.rules && typeof data.rules === 'object') setRules(data.rules);
    } catch { /* sin server: defaults OFF */ }
    setLoaded(true);
  };

  useEffect(() => { void load(); }, []);

  const toggleRule = async (key: string) => {
    const next = { ...rules, [key]: !rules[key] };
    setRules(next);
    PlatformBridge.hapticFeedback('light');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: next }),
      });
    } catch { /* best-effort (optimista) */ }
  };

  if (!loaded) return null;

  return (
    <div className="mt-2 rounded-xl" style={{ border: '1px solid var(--border-subtle)', padding: 6 }}>
      <p className="text-[10px] font-black uppercase tracking-[1.5px] m-0 px-2 pt-1.5" style={{ color: 'var(--text-muted)' }}>
        Reglas de notificaciones
      </p>
      {RULE_CATALOG.map((rule) => {
        const on = rules[rule.key] === true;
        return (
          <div
            key={rule.key}
            role="button"
            tabIndex={0}
            onClick={() => { void toggleRule(rule.key); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void toggleRule(rule.key); }}
            className="flex items-start gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors hover:bg-(--bg-pressed)"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold m-0 leading-tight">{rule.label}</p>
              <p className="text-[10px] m-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{rule.desc}</p>
            </div>
            <Switch on={on} onChange={() => { void toggleRule(rule.key); }} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * ── PushDiagnosticsRow ── Consulta /api/notifications/push-check CON LA SESIÓN
 * del usuario y muestra el resultado (APNs, envs faltantes, dispositivos).
 */
function PushDiagnosticsRow() {
  const [state, setState] = useState<"idle" | "loading" | "result" | "error">( "idle" );
  const [result, setResult] = useState<{
    apnsConfigured?: boolean; missingEnvs?: string[]; apnsEnv?: string;
    devices?: Array<{ platform: string; isActive: boolean; token: string; updatedAt: string | null }>;
  } | null>(null);

  const check = async () => {
    setState("loading");
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch("/api/notifications/push-check", { headers: headers || {}, cache: "no-store" });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || data?.hint || `HTTP ${res.status}`);
      setResult(data);
      setState("result");
    } catch (err: unknown) {
      toast.error(String((err as Error)?.message || "No se pudo diagosticar push").slice(0, 120));
      setState("idle");
    }
  };

  if (state !== "result") {
    return (
      <button
        type="button"
        onClick={() => { void check(); PlatformBridge.hapticFeedback("light"); }}
        disabled={state === "loading"}
        className="mt-2 mx-1 w-[calc(100%-8px)] text-left text-[11px] font-bold text-white/35 hover:text-[#E91E63] rounded-xl py-2 transition-colors border-none bg-transparent cursor-pointer disabled:opacity-50"
      >
        {state === "loading" ? "Consultando servidor de push…" : "⟡ Diagnóstico de push (¿APNs en Vercel? ¿dispositivos?)"}
      </button>
    );
  }

  const d = result;
  return (
    <div className="mt-3 mx-1 rounded-2xl bg-black/30 border border-white/10 p-3 space-y-1.5 text-[11px] leading-snug">
      <div className="flex justify-between">
        <span className="text-white/50">APNs en Vercel</span>
        <span className={d?.apnsConfigured ? "text-emerald-300 font-bold" : "text-red-300 font-bold"}>
          {d?.apnsConfigured ? "✓ configurado" : `✗ faltan: ${(d?.missingEnvs ?? []).join(", ") || "?"}`}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-white/50">Entorno APNs</span>
        <span className="text-white font-bold">{d?.apnsEnv}</span>
      </div>
      {(d?.devices ?? []).map((dev, i: number) => (
        <div key={i} className="flex justify-between border-t border-white/5 pt-1">
          <span className="text-white/50 font-mono">…{dev.token.slice(-10)} · {dev.platform}</span>
          <span className={dev.isActive ? "text-emerald-300 font-bold" : "text-gray-400"}>
            {dev.isActive ? "activo" : "inactivo"} · {dev.updatedAt ? new Date(dev.updatedAt).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "—"}
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={(() => { setState("idle"); setResult(null); })}
        className="text-[10px] font-bold text-white/30 hover:text-white py-0.5 cursor-pointer"
      >Cerrar diagnóstico</button>
    </div>
  );
}

function LinkRow({ icon: Icon, label, href }: { icon: typeof ShieldCheck; label: string; href: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => { PlatformBridge.hapticFeedback('light'); router.push(href); }}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border-none transition-colors hover:bg-(--bg-pressed)"
      style={{ background: 'transparent', color: 'var(--text-primary)' }}
    >
      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-pressed)' }}>
        <Icon size={17} className="text-(--text-muted)" />
      </div>
      <span className="text-sm font-bold flex-1 text-left">{label}</span>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
    </button>
  );
}