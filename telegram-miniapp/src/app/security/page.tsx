'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  User,
  ShieldCheck,
  EyeOff,
  Database,
  ChevronRight,
  Search,
  Key,
  Smartphone,
  Lock,
  CheckCircle2,
  LogOut,
  ScanFace,
  Hash,
  Mail,
  MessageSquare,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { QRCodeSVG } from 'qrcode.react';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  PIN_DIGITS,
  hasPin,
  setPin,
  removePin,
  verifyPin,
  pinLockRemainingMs,
  detectBiometric,
  isBiometricEnabled,
  enableBiometric,
  verifyBiometric,
  disableBiometric,
  type BiometricSupport,
} from '@/lib/securityVault';

const ACCENT = '#E91E63';
const HAIRLINE = '1px solid var(--border-subtle)';

/* ───────────── Primitivas planas estilo X ───────────── */

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative shrink-0 border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ width: 44, height: 26, borderRadius: 13, background: on ? ACCENT : 'var(--bg-pressed)' }}
    >
      <span
        className="absolute top-0.75 rounded-full bg-white transition-all"
        style={{ width: 20, height: 20, left: on ? 21 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
      />
    </button>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  trailing,
  onClick,
  iconColor,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  iconColor?: string;
}) {
  const content = (
    <>
      <Icon size={20} strokeWidth={2} className="shrink-0" style={{ color: iconColor ?? 'var(--text-secondary)' }} />
      <div className="flex-1 min-w-0 pr-2 text-left">
        <div className="text-[15px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{title}</div>
        {desc && <div className="text-[12px] mt-0.5 leading-normal" style={{ color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      {trailing}
    </>
  );
  const cls = 'w-full flex items-center gap-3.5 px-1 py-3.5 bg-transparent border-none';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer active:opacity-60`} style={{ borderBottom: HAIRLINE }}>
      {content}
    </button>
  ) : (
    <div className={cls} style={{ borderBottom: HAIRLINE }}>{content}</div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="px-1 pb-4 pt-1 flex flex-col gap-3" style={{ borderBottom: HAIRLINE }}>{children}</div>;
}

function PillButton({ children, onClick, variant = 'primary', disabled }: { children: ReactNode; onClick: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const styles = {
    primary: { background: ACCENT, color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border-subtle)' },
    danger: { background: 'transparent', color: '#EF4444', boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.4)' },
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-4 py-2 text-[13px] font-bold border-none cursor-pointer active:scale-95 transition-transform disabled:opacity-50"
      style={styles}
    >
      {children}
    </button>
  );
}

function Note({ text, tone = 'info' }: { text: string; tone?: 'info' | 'ok' | 'error' }) {
  const color = tone === 'ok' ? '#10B981' : tone === 'error' ? '#EF4444' : 'var(--text-secondary)';
  return <p className="text-[12px] font-medium m-0 leading-normal" style={{ color }}>{text}</p>;
}

function PinInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="w-full relative">
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_DIGITS}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        className="w-full rounded-2xl px-4 py-3 text-center text-xl tracking-[10px] outline-none font-mono bg-(--bg-subtle) border border-(--border-subtle) focus:border-[#E91E63] transition-colors placeholder:text-[13px] placeholder:tracking-normal placeholder:font-sans placeholder:text-(--text-muted)"
        style={{ color: 'var(--text-primary)' }}
      />
    </div>
  );
}

/* ───────────── Face ID / Biometría ───────────── */

function BiometricRow() {
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'info' | 'ok' | 'error' } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, e] = await Promise.all([detectBiometric(), isBiometricEnabled()]);
      if (!alive) return;
      setSupport(s);
      setEnabled(e);
    })();
    return () => { alive = false; };
  }, []);

  const label = support?.label ?? 'Face ID / Touch ID';
  const available = support?.available ?? false;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    PlatformBridge.hapticFeedback('medium');
    try {
      if (enabled) {
        await disableBiometric();
        setEnabled(false);
        setNote({ text: 'Biometría desactivada.', tone: 'info' });
      } else {
        const res = await enableBiometric();
        setEnabled(res.ok);
        setNote({ text: res.message, tone: res.ok ? 'ok' : 'error' });
        PlatformBridge.hapticFeedback(res.ok ? 'success' : 'warning');
      }
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy) return;
    setBusy(true);
    const res = await verifyBiometric('Prueba de verificación en Rabbitty');
    setNote({ text: res.message, tone: res.ok ? 'ok' : 'error' });
    setBusy(false);
  };

  const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/i.test(navigator.userAgent);
  const displayTitle = isApple ? 'Face ID / Clave de Acceso (Apple ID)' : label;

  const desc = support === null
    ? 'Comprobando compatibilidad de claves de acceso…'
    : available
      ? (isApple 
          ? 'Guarda tu clave de acceso en Llavero de iCloud con tu Apple ID y autoriza con Face ID.' 
          : 'Autoriza envíos y acceso con tu clave biométrica de dispositivo.')
      : 'No disponible: configura Face ID o Touch ID en tu dispositivo.';

  return (
    <>
      <Row
        icon={ScanFace}
        title={displayTitle}
        desc={desc}
        trailing={<Switch on={enabled} disabled={!available || busy} onChange={toggle} label={displayTitle} />}
      />
      {(enabled || note) && (
        <Panel>
          {note && <Note text={note.text} tone={note.tone} />}
          {enabled && (
            <div className="flex gap-2">
              <PillButton variant="ghost" onClick={test} disabled={busy}>{busy ? 'Verificando…' : 'Probar'}</PillButton>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

/* ───────────── PIN ───────────── */

type PinMode = 'idle' | 'set' | 'remove';

function PinRow() {
  const [active, setActive] = useState(() => hasPin());
  const [mode, setMode] = useState<PinMode>('idle');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'info' | 'ok' | 'error' } | null>(null);

  const reset = () => { setMode('idle'); setCurrent(''); setNext(''); setConfirm(''); };

  const checkCurrent = async (): Promise<boolean> => {
    if (!active) return true;
    if (current.length !== PIN_DIGITS) {
      setNote({ text: `Ingresa tu PIN actual de ${PIN_DIGITS} dígitos.`, tone: 'error' });
      return false;
    }
    const res = await verifyPin(current);
    if (res.ok) return true;
    setNote({
      text: res.locked
        ? `Demasiados intentos. Espera ${Math.ceil((res.remainingMs || pinLockRemainingMs()) / 1000)} s.`
        : `PIN incorrecto. Te quedan ${res.attemptsLeft} intentos.`,
      tone: 'error',
    });
    return false;
  };

  const save = async () => {
    if (busy) return;
    setNote(null);
    if (next.length !== PIN_DIGITS) return setNote({ text: `El PIN debe tener ${PIN_DIGITS} dígitos.`, tone: 'error' });
    if (next !== confirm) return setNote({ text: 'Los PIN no coinciden.', tone: 'error' });
    setBusy(true);
    try {
      if (!(await checkCurrent())) return;
      await setPin(next);
      setActive(true);
      reset();
      PlatformBridge.hapticFeedback('success');
      setNote({ text: 'PIN guardado en este dispositivo.', tone: 'ok' });
    } catch {
      setNote({ text: 'No se pudo guardar el PIN.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setNote(null);
    setBusy(true);
    try {
      if (!(await checkCurrent())) return;
      removePin();
      setActive(false);
      reset();
      PlatformBridge.hapticFeedback('medium');
      setNote({ text: 'PIN desactivado.', tone: 'info' });
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = () => {
    setNote(null);
    PlatformBridge.hapticFeedback('light');
    if (mode !== 'idle') return reset();
    setMode(active ? 'remove' : 'set');
  };

  return (
    <>
      <Row
        icon={Hash}
        title={`PIN de seguridad (${PIN_DIGITS} dígitos)`}
        desc="Código privado para autorizar envíos de Bunz en este dispositivo."
        trailing={<Switch on={active || mode === 'set'} onChange={onSwitch} label="PIN de seguridad" />}
      />
      {(mode !== 'idle' || note || active) && (
        <Panel>
          {mode === 'set' && (
            <>
              {active && <PinInput value={current} onChange={setCurrent} placeholder="PIN actual" />}
              <PinInput value={next} onChange={setNext} placeholder="Nuevo PIN" />
              <PinInput value={confirm} onChange={setConfirm} placeholder="Confirma el nuevo PIN" />
              <div className="flex gap-2">
                <PillButton onClick={save} disabled={busy}>Guardar PIN</PillButton>
                <PillButton variant="ghost" onClick={reset}>Cancelar</PillButton>
              </div>
            </>
          )}
          {mode === 'remove' && (
            <>
              <PinInput value={current} onChange={setCurrent} placeholder="PIN actual para desactivar" />
              <div className="flex gap-2">
                <PillButton variant="danger" onClick={remove} disabled={busy}>Desactivar PIN</PillButton>
                <PillButton variant="ghost" onClick={reset}>Cancelar</PillButton>
              </div>
            </>
          )}
          {mode === 'idle' && active && (
            <div className="flex gap-2">
              <PillButton variant="ghost" onClick={() => { setMode('set'); setNote(null); }}>Cambiar PIN</PillButton>
            </div>
          )}
          {note && <Note text={note.text} tone={note.tone} />}
        </Panel>
      )}
    </>
  );
}

/* ───────────── 2FA (validado en servidor) ───────────── */

type TfMethod = 'email' | 'phone' | 'totp';

interface TfStatus {
  enabled: TfMethod[];
  available: { email: string | null; phone: string | null; phoneChannel: 'sms' | 'telegram' | null };
}

interface TfFlow {
  kind: 'enable' | 'disable';
  method: TfMethod;
  secret?: string;
  otpauthUrl?: string;
  proofMethod?: TfMethod;
  hint?: string;
}

async function tfPost(payload: Record<string, unknown>) {
  const headers = await PlatformBridge.getAuthHeaders();
  const res = await fetch('/api/security/2fa', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: Record<string, string> };
}

function TwoFactorRows() {
  const [status, setStatus] = useState<TfStatus | null>(null);
  const [version, setVersion] = useState(0);
  const [flow, setFlow] = useState<TfFlow | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'info' | 'ok' | 'error' } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { localStorage.removeItem('rabbitty_2fa_config'); } catch { /* noop */ }
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/security/2fa', { headers });
        if (res.ok && alive) setStatus(await res.json());
      } catch { /* sin red */ }
    })();
    return () => { alive = false; };
  }, [version]);

  const items: { method: TfMethod; icon: LucideIcon; title: string; desc: string; avail: boolean }[] = [
    {
      method: 'email',
      icon: Mail,
      title: 'Código por correo',
      desc: status?.available.email ? `Se enviará a ${status.available.email}.` : 'Vincula un correo real a tu cuenta para usarlo.',
      avail: Boolean(status?.available.email),
    },
    {
      method: 'phone',
      icon: MessageSquare,
      title: status?.available.phoneChannel === 'sms' ? 'Código por SMS' : 'Código por Telegram',
      desc: status?.available.phone ? `Se enviará a ${status.available.phone}.` : 'Vincula tu número o Telegram para usarlo.',
      avail: Boolean(status?.available.phone),
    },
    { method: 'totp', icon: KeyRound, title: 'App autenticadora', desc: 'Google Authenticator, Authy o 1Password (código TOTP).', avail: true },
  ];

  const enabled = status?.enabled ?? [];

  const cancel = () => { setFlow(null); setCode(''); };

  const start = async (method: TfMethod) => {
    if (busy || !status) return;
    setNote(null);
    setCode('');
    PlatformBridge.hapticFeedback('light');

    if (enabled.includes(method)) {
      setFlow({ kind: 'disable', method, proofMethod: enabled[0] });
      return;
    }
    setBusy(true);
    try {
      if (method === 'totp') {
        const r = await tfPost({ action: 'totp_setup' });
        if (!r.ok) return setNote({ text: r.data.error || 'No se pudo iniciar.', tone: 'error' });
        setFlow({ kind: 'enable', method, secret: r.data.secret, otpauthUrl: r.data.otpauthUrl });
      } else {
        const r = await tfPost({ action: 'challenge', method, purpose: 'enroll' });
        if (!r.ok) return setNote({ text: r.data.error || 'No se pudo enviar el código.', tone: 'error' });
        setFlow({ kind: 'enable', method, hint: `Código enviado a ${r.data.hint}.` });
      }
    } finally {
      setBusy(false);
    }
  };

  const sendProofCode = async () => {
    if (!flow?.proofMethod || flow.proofMethod === 'totp' || busy) return;
    setBusy(true);
    setNote(null);
    const r = await tfPost({ action: 'challenge', method: flow.proofMethod, purpose: 'action' });
    setBusy(false);
    if (!r.ok) return setNote({ text: r.data.error || 'No se pudo enviar el código.', tone: 'error' });
    setFlow({ ...flow, hint: `Código enviado a ${r.data.hint}.` });
  };

  const confirm = async () => {
    if (!flow || busy) return;
    if (code.length !== 6) return setNote({ text: 'Ingresa el código de 6 dígitos.', tone: 'error' });
    setBusy(true);
    setNote(null);
    try {
      const r = flow.kind === 'enable'
        ? await tfPost({ action: 'enable', method: flow.method, code })
        : await tfPost({ action: 'disable', method: flow.method, proof: { method: flow.proofMethod, code } });
      if (!r.ok) {
        PlatformBridge.hapticFeedback('warning');
        return setNote({ text: r.data.error || 'Código incorrecto.', tone: 'error' });
      }
      PlatformBridge.hapticFeedback('success');
      setNote({ text: flow.kind === 'enable' ? 'Verificación en dos pasos activada.' : 'Método desactivado.', tone: 'ok' });
      cancel();
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };

  const proofOptions = enabled;

  return (
    <>
      {items.map((it) => (
        <div key={it.method}>
          <Row
            icon={it.icon}
            title={it.title}
            desc={it.desc}
            trailing={
              <Switch
                on={enabled.includes(it.method) || (flow?.kind === 'enable' && flow.method === it.method)}
                disabled={!status || busy || (!it.avail && !enabled.includes(it.method))}
                onChange={() => (flow?.method === it.method ? cancel() : start(it.method))}
                label={it.title}
              />
            }
          />
          {flow?.method === it.method && (
            <Panel>
              {flow.kind === 'enable' && flow.method === 'totp' && flow.otpauthUrl && (
                <>
                  <Note text="Escanea el código con tu app autenticadora y escribe el código de 6 dígitos que genera." />
                  <div className="self-center p-3 bg-white rounded-xl">
                    <QRCodeSVG value={flow.otpauthUrl} size={160} />
                  </div>
                  <p className="m-0 text-[11px] text-center break-all font-mono select-all" style={{ color: 'var(--text-muted)' }}>
                    ¿No puedes escanear? Clave: {flow.secret}
                  </p>
                </>
              )}
              {flow.kind === 'enable' && flow.method !== 'totp' && flow.hint && <Note text={flow.hint} tone="ok" />}
              {flow.kind === 'disable' && (
                <>
                  <Note text="Confirma con un código para desactivar este método." />
                  {proofOptions.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                      {proofOptions.map((m) => (
                        <PillButton key={m} variant={m === flow.proofMethod ? 'primary' : 'ghost'} onClick={() => { setFlow({ ...flow, proofMethod: m, hint: undefined }); setCode(''); }}>
                          {m === 'email' ? 'Correo' : m === 'phone' ? 'Teléfono' : 'Autenticador'}
                        </PillButton>
                      ))}
                    </div>
                  )}
                  {flow.proofMethod && flow.proofMethod !== 'totp' && (
                    <div className="flex gap-2">
                      <PillButton variant="ghost" onClick={sendProofCode} disabled={busy}>{flow.hint ? 'Reenviar código' : 'Enviar código'}</PillButton>
                    </div>
                  )}
                  {flow.hint && <Note text={flow.hint} tone="ok" />}
                </>
              )}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-xl px-3 py-2.5 text-center text-lg tracking-[8px] outline-none bg-transparent"
                style={{ color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }}
              />
              <div className="flex gap-2">
                <PillButton variant={flow.kind === 'disable' ? 'danger' : 'primary'} onClick={confirm} disabled={busy}>
                  {flow.kind === 'enable' ? 'Activar' : 'Desactivar'}
                </PillButton>
                <PillButton variant="ghost" onClick={cancel}>Cancelar</PillButton>
              </div>
            </Panel>
          )}
        </div>
      ))}
      {note && <div className="px-1 pt-3"><Note text={note.text} tone={note.tone} /></div>}
      <p className="text-[12px] m-0 px-1 pt-3 leading-normal" style={{ color: 'var(--text-muted)' }}>
        Con la verificación activa, el servidor exigirá un código válido antes de cada envío de Bunz.
      </p>
    </>
  );
}

/* ───────────── Contenido informativo ───────────── */

const FEATURES: { icon: LucideIcon; color: string; title: string; desc: string }[] = [
  { icon: Key, color: '#10B981', title: 'Llaves Privadas Locales', desc: 'Tus llaves de TON se generan y protegen localmente con cifrado AES-256. Nunca tocan nuestros servidores.' },
  { icon: ShieldCheck, color: '#6366F1', title: 'Smart Contracts Auditados', desc: 'Contratos inteligentes en TON blockchain verificados por firmas de seguridad independientes.' },
  { icon: Smartphone, color: '#F59E0B', title: 'Cripto-Biometría Nativa', desc: 'Soporte integrado para Secure Enclave, Face ID y Touch ID en tu dispositivo.' },
  { icon: EyeOff, color: '#E91E63', title: 'Zero-Knowledge Protocol', desc: 'Privacidad asegurada: comercios y terceros solo reciben datos esenciales de validación de pago.' },
];

const STATS = [
  { val: '0', label: 'Incidentes', color: '#10B981' },
  { val: '100%', label: 'Uptime TON', color: '#6366F1' },
  { val: '256b', label: 'AES Enclave', color: '#F59E0B' },
];

type SettingsSection = 'root' | 'account' | 'security_access' | 'privacy' | 'audit';

function KeyValue({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 py-3.5" style={{ borderBottom: HAIRLINE }}>
      <span className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>{k}</span>
      <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{children}</span>
    </div>
  );
}

export default function SecurityPage() {
  const { user, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState<SettingsSection>('root');
  const [searchQuery, setSearchQuery] = useState('');

  const navigateTo = (sec: SettingsSection) => {
    PlatformBridge.hapticFeedback('light');
    setCurrentSection(sec);
  };

  const MENU_SECTIONS = [
    { id: 'account' as const, icon: User, title: 'Tu cuenta', desc: 'Consulta los datos de tu cuenta, ID de Telegram y estado de la sesión.' },
    { id: 'security_access' as const, icon: Lock, title: 'Seguridad y acceso a la cuenta', desc: 'Administra la seguridad de tu cuenta: Face ID, PIN de 4 dígitos y verificación en dos pasos.' },
    { id: 'privacy' as const, icon: EyeOff, title: 'Privacidad y transacciones', desc: 'Controla la visibilidad de tu saldo Bunz, pagos y protocolos Zero-Knowledge.' },
    { id: 'audit' as const, icon: Database, title: 'Auditoría y arquitectura TON', desc: 'Verifica los Smart Contracts, auditorías de seguridad y cifrado descentralizado.' },
  ];

  const q = searchQuery.trim().toLowerCase();
  const filteredSections = MENU_SECTIONS.filter((s) => !q || s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));

  return (
    <ProfileSubpageLayout
      title={
        currentSection === 'root' ? 'Configuración' :
        currentSection === 'account' ? 'Tu cuenta' :
        currentSection === 'security_access' ? 'Seguridad' :
        currentSection === 'privacy' ? 'Privacidad' : 'Auditoría'
      }
      showBack={true}
      onBackCustom={currentSection !== 'root' ? () => navigateTo('root') : undefined}
    >
      <div className="flex flex-col gap-2 mt-2">

        {currentSection === 'root' && (
          <div className="flex flex-col">
            <div className="relative mb-2">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en Configuración"
                className="w-full rounded-full pl-11 pr-4 py-2.5 text-[14px] outline-none border-none"
                style={{ background: 'var(--bg-pressed)', color: 'var(--text-primary)' }}
              />
            </div>

            {filteredSections.map((item) => (
              <Row
                key={item.id}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
                onClick={() => navigateTo(item.id)}
                trailing={<ChevronRight size={18} className="shrink-0" style={{ color: 'var(--text-muted)' }} />}
              />
            ))}

            <div className="px-1 pt-6">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">Sistema protegido · TON Network</span>
              </div>
              <h4 className="text-[15px] font-black m-0 mb-1" style={{ color: 'var(--text-primary)' }}>Criptografía Descentralizada</h4>
              <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                Rabbitty opera sobre protocolos no-custodiales en la blockchain de TON y cifrado de hardware en tu dispositivo.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {STATS.map(({ val, label, color }) => (
                  <div key={label} className="text-center">
                    <span className="text-base font-black block" style={{ color }}>{val}</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentSection === 'account' && (
          <div className="flex flex-col">
            <p className="text-xs px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
              Consulta o administra los detalles asociados a tu cuenta de Telegram y perfil Rabbitty.
            </p>
            <KeyValue k="Nombre">{user?.firstName || 'Explorador'}</KeyValue>
            <KeyValue k="Usuario">@{user?.username || 'explorador'}</KeyValue>
            <KeyValue k="ID de Telegram"><span className="font-mono">{user?.id || '—'}</span></KeyValue>
            <KeyValue k="Rol de cuenta">
              <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full bg-[#E91E63]/15 text-[#E91E63]">{user?.role || 'EXPLORADOR'}</span>
            </KeyValue>
            <Row
              icon={LogOut}
              iconColor="#EF4444"
              title="Cerrar sesión en este dispositivo"
              onClick={() => { PlatformBridge.hapticFeedback('medium'); logout(); }}
            />
          </div>
        )}

        {currentSection === 'security_access' && (
          <div className="flex flex-col">
            <p className="text-xs px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
              PIN y biometría protegen este dispositivo al autorizar envíos de Bunz.
            </p>
            <BiometricRow />
            <PinRow />
            <TwoFactorRows />
          </div>
        )}

        {currentSection === 'privacy' && (
          <div className="flex flex-col">
            <p className="text-xs px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
              Gestiona qué información ven los comercios afiliados y cómo se resguardan tus actividades.
            </p>
            <Row
              icon={EyeOff}
              iconColor={ACCENT}
              title="Protocolo Zero-Knowledge"
              desc="Tus pagos generan un hash criptográfico de verificación instantáneo en TON. Los comercios no tienen acceso a tu saldo total ni a tu historial general de compras."
            />
            <Row
              icon={CheckCircle2}
              iconColor="#10B981"
              title="Modo Incógnito en Check-ins"
              desc="Tu estado de ánimo y respuestas de Rabbitty Mood se procesan de forma anónima para calcular el vibe colectivo sin vincular tu identidad nominal."
            />
          </div>
        )}

        {currentSection === 'audit' && (
          <div className="flex flex-col">
            <p className="text-xs px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
              Infraestructura técnica, Smart Contracts auditados y estándares de seguridad.
            </p>
            {FEATURES.map((f) => (
              <Row key={f.title} icon={f.icon} iconColor={f.color} title={f.title} desc={f.desc} />
            ))}
          </div>
        )}

      </div>
    </ProfileSubpageLayout>
  );
}
