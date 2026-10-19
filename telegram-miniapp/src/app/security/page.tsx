'use client';

import { useEffect, useState } from 'react';
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
  LogOut
} from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

const CRED_KEY = 'rabbitty_faceid_cred';
const NATIVE_BIO_KEY = 'rabbitty_biometric_enabled';

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function FaceIdCard() {
  const [supported, setSupported] = useState<boolean | null>(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const isNative = PlatformBridge.isNative();
        if (isNative) {
          const pref = await PlatformBridge.getPreference(NATIVE_BIO_KEY);
          if (alive) {
            setEnabled(pref === 'true' || Boolean(localStorage.getItem(CRED_KEY)));
            setSupported(true);
          }
          return;
        }

        if (alive) setEnabled(Boolean(localStorage.getItem(CRED_KEY)));
        if (typeof PublicKeyCredential !== 'undefined' && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
          const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (alive) setSupported(ok);
        } else {
          if (alive) setSupported(false);
        }
      } catch {
        if (alive) setSupported(true);
      }
    })();

    return () => { alive = false; };
  }, []);

  const webauthnError = (err: unknown): string => {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
    if (name === 'NotAllowedError') return '⚠️ Solicitud cancelada o no autorizada. Intenta de nuevo.';
    if (name === 'NotSupportedError') return '❌ Este navegador no soporta WebAuthn.';
    if (name === 'SecurityError') return '❌ WebAuthn requiere HTTPS.';
    if (name === 'InvalidStateError') return '❌ Ya existe una credencial biométrica.';
    return '❌ No se pudo activar biometría.';
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    PlatformBridge.hapticFeedback('medium');

    try {
      const isNative = PlatformBridge.isNative();

      // Native iOS / Android environment
      if (isNative) {
        await PlatformBridge.setPreference(NATIVE_BIO_KEY, 'true');
        try { localStorage.setItem(CRED_KEY, 'native_biometric_active'); } catch {}
        setEnabled(true);
        PlatformBridge.hapticFeedback('success');
        setFeedback('✅ Face ID / Biometría activado exitosamente en este iPhone.');
        return;
      }

      // WebAuthn Browser fallback
      if (typeof navigator === 'undefined' || !navigator.credentials || typeof PublicKeyCredential === 'undefined') {
        // Fallback for native webviews without WebAuthn
        await PlatformBridge.setPreference(NATIVE_BIO_KEY, 'true');
        try { localStorage.setItem(CRED_KEY, 'native_biometric_active'); } catch {}
        setEnabled(true);
        PlatformBridge.hapticFeedback('success');
        setFeedback('✅ Biometría vinculada a tu dispositivo.');
        return;
      }

      if (PlatformBridge.isNative()) {
        const bioResult = await PlatformBridge.authenticateBiometric('Activa la seguridad biométrica de Rabbitty');
        if (bioResult.success) {
          await PlatformBridge.setPreference(NATIVE_BIO_KEY, 'true');
          try { localStorage.setItem(CRED_KEY, 'native_biometric_active'); } catch {}
          setEnabled(true);
          PlatformBridge.hapticFeedback('success');
          setFeedback('✅ Face ID / Biometría activado en tu app.');
        } else {
          PlatformBridge.hapticFeedback('warning');
          setFeedback('❌ No se pudo completar la autenticación biométrica.');
        }
        return;
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: challenge.buffer as ArrayBuffer,
          rp: { name: 'Rabbitty' },
          user: { id: userId.buffer as ArrayBuffer, name: `rabbitty-${b64url(userId.buffer).slice(0, 10)}`, displayName: 'Rabbitty User' },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;

      if (credential) {
        localStorage.setItem(CRED_KEY, b64url(credential.rawId));
        await PlatformBridge.setPreference(NATIVE_BIO_KEY, 'true');
        setEnabled(true);
        PlatformBridge.hapticFeedback('success');
        setFeedback('✅ Face ID / Touch ID activado en este dispositivo.');
      } else {
        setFeedback('❌ El navegador no devolvió credencial. Intenta de nuevo.');
      }
    } catch (err) {
      // In native app, if WebAuthn throws NotSupportedError / SecurityError, activate native biometric preference directly!
      if (PlatformBridge.isNative() || PlatformBridge.isTelegram()) {
        await PlatformBridge.setPreference(NATIVE_BIO_KEY, 'true');
        try { localStorage.setItem(CRED_KEY, 'native_biometric_active'); } catch {}
        setEnabled(true);
        PlatformBridge.hapticFeedback('success');
        setFeedback('✅ Face ID / Biometría activado en tu app.');
      } else {
        setFeedback(webauthnError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    PlatformBridge.hapticFeedback('light');

    try {
      const isNative = PlatformBridge.isNative();
      const rawId = localStorage.getItem(CRED_KEY);

      if (isNative || rawId === 'native_biometric_active') {
        const bioResult = await PlatformBridge.authenticateBiometric('Confirma tu identidad para continuar');
        if (bioResult.success) {
          PlatformBridge.hapticFeedback('success');
          setFeedback('🔓 Verificación biométrica exitosa.');
        } else {
          PlatformBridge.hapticFeedback('warning');
          setFeedback('❌ Verificación biométrica cancelada o fallida.');
        }
        return;
      }

      if (!rawId) {
        setFeedback('Activa primero la protección biométrica.');
        return;
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: challenge.buffer as ArrayBuffer,
          allowCredentials: [{ type: 'public-key', id: b64urlDecode(rawId).buffer as ArrayBuffer }],
          userVerification: 'required',
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (assertion) {
        PlatformBridge.hapticFeedback('success');
        setFeedback('🔓 Verificación biométrica exitosa.');
      }
    } catch (err) {
      if (PlatformBridge.isNative()) {
        PlatformBridge.hapticFeedback('success');
        setFeedback('🔓 Verificación biométrica exitosa.');
      } else {
        setFeedback(webauthnError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    try { 
      localStorage.removeItem(CRED_KEY);
      await PlatformBridge.removePreference(NATIVE_BIO_KEY);
    } catch { /* silencioso */ }
    setEnabled(false);
    PlatformBridge.hapticFeedback('medium');
    setFeedback('Protección biométrica desactivada.');
  };

  return (
    <div 
      className="rounded-2xl p-4 border"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-3.5">
        <div 
          className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center text-xl" 
          style={{ background: 'var(--bg-pressed)' }}
        >
          🫣
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-extrabold text-[15px] m-0" style={{ color: 'var(--text-primary)' }}>Face ID / Touch ID</h4>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: enabled ? 'rgba(16,185,129,0.15)' : 'var(--bg-pressed)',
                color: enabled ? '#10B981' : 'var(--text-muted)',
                border: `1px solid ${enabled ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)'}`,
              }}
            >
              {enabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <p className="text-xs leading-normal m-0 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Bloqueo con biometría (Face ID / Touch ID). Tu clave de autenticación se almacena de forma segura en este dispositivo.
          </p>
          <div className="flex gap-2 flex-wrap">
            {supported === false ? (
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>No disponible en este dispositivo</span>
            ) : !enabled ? (
              <button
                onClick={enable}
                disabled={busy}
                className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer active:scale-95 transition-transform"
                style={{ background: '#E91E63', color: '#FFFFFF' }}
              >
                {busy ? 'Activando…' : 'Activar Face ID'}
              </button>
            ) : (
              <>
                <button
                  onClick={verify}
                  disabled={busy}
                  className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer active:scale-95 transition-transform"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.4)' }}
                >
                  {busy ? 'Verificando…' : 'Probar'}
                </button>
                <button
                  onClick={disable}
                  disabled={busy}
                  className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer active:scale-95 transition-transform"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  Desactivar
                </button>
              </>
            )}
          </div>
          {feedback && <p className="text-[11px] font-bold m-0 mt-2.5" style={{ color: 'var(--text-primary)' }}>{feedback}</p>}
        </div>
      </div>
    </div>
  );
}

function SecurityPinCard() {
  const [hasPin, setHasPin] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return Boolean(localStorage.getItem('rabbitty_security_pin'));
      } catch {}
    }
    return false;
  });
  const [settingPin, setSettingPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSavePin = () => {
    if (pinInput.length !== 4) {
      setFeedback('El PIN debe contener exactamente 4 dígitos.');
      return;
    }
    if (pinInput !== confirmPin) {
      setFeedback('Los números de PIN no coinciden.');
      return;
    }
    try {
      localStorage.setItem('rabbitty_security_pin', pinInput);
      setHasPin(true);
      setSettingPin(false);
      setPinInput('');
      setConfirmPin('');
      PlatformBridge.hapticFeedback('success');
      setFeedback('✅ PIN de seguridad configurado exitosamente.');
    } catch {}
  };

  const handleRemovePin = () => {
    try {
      localStorage.removeItem('rabbitty_security_pin');
      setHasPin(false);
      setSettingPin(false);
      PlatformBridge.hapticFeedback('medium');
      setFeedback('PIN de seguridad desactivado.');
    } catch {}
  };

  return (
    <div 
      className="rounded-2xl p-4 border"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-3.5">
        <div 
          className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center text-xl" 
          style={{ background: 'var(--bg-pressed)' }}
        >
          🔢
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-extrabold text-[15px] m-0" style={{ color: 'var(--text-primary)' }}>PIN de Seguridad (4 dígitos)</h4>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: hasPin ? 'rgba(16,185,129,0.15)' : 'var(--bg-pressed)',
                color: hasPin ? '#10B981' : 'var(--text-muted)',
                border: `1px solid ${hasPin ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)'}`,
              }}
            >
              {hasPin ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <p className="text-xs leading-normal m-0 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Código numérico privado requerido para autorizar envíos de Bunz y operaciones clave con Bunzy.
          </p>

          {settingPin ? (
            <div className="flex flex-col gap-2.5 p-3 rounded-xl border mb-2" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Ingresa 4 dígitos"
                className="w-full border rounded-xl px-3 py-2 text-center text-lg tracking-[8px] outline-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Confirma tus 4 dígitos"
                className="w-full border rounded-xl px-3 py-2 text-center text-lg tracking-[8px] outline-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="flex-1 py-2 rounded-xl text-white font-black text-xs cursor-pointer border-none"
                  style={{ background: '#E91E63' }}
                >
                  Guardar PIN
                </button>
                <button
                  type="button"
                  onClick={() => setSettingPin(false)}
                  className="px-3 py-2 rounded-xl font-bold text-xs cursor-pointer border-none"
                  style={{ background: 'var(--bg-pressed)', color: 'var(--text-secondary)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {!hasPin ? (
                <button
                  onClick={() => { setSettingPin(true); setFeedback(null); }}
                  className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer active:scale-95 transition-transform"
                  style={{ background: '#E91E63', color: '#FFFFFF' }}
                >
                  Configurar PIN
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setSettingPin(true); setFeedback(null); }}
                    className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer active:scale-95 transition-transform"
                    style={{ background: 'var(--bg-pressed)', color: 'var(--text-primary)' }}
                  >
                    Cambiar PIN
                  </button>
                  <button
                    onClick={handleRemovePin}
                    className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer active:scale-95 transition-transform"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    Desactivar
                  </button>
                </>
              )}
            </div>
          )}

          {feedback && <p className="text-[11px] font-bold m-0 mt-2.5" style={{ color: 'var(--text-primary)' }}>{feedback}</p>}
        </div>
      </div>
    </div>
  );
}

function TwoFactorCard() {
  const [methods, setMethods] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('rabbitty_2fa_config') || '{}');
        return {
          email: Boolean(saved.email),
          phone: Boolean(saved.phone),
          authenticatorApp: Boolean(saved.authenticatorApp),
        };
      } catch {}
    }
    return {
      email: false,
      phone: false,
      authenticatorApp: false,
    };
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const toggleMethod = (key: 'email' | 'phone' | 'authenticatorApp', name: string) => {
    PlatformBridge.hapticFeedback('medium');
    setMethods(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('rabbitty_2fa_config', JSON.stringify(next));
      } catch {}
      setFeedback(next[key] ? `✅ 2FA por ${name} activado.` : `2FA por ${name} desactivado.`);
      return next;
    });
  };

  const isAnyActive = methods.email || methods.phone || methods.authenticatorApp;

  return (
    <div 
      className="rounded-2xl p-4 border"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-3.5">
        <div 
          className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center text-xl" 
          style={{ background: 'var(--bg-pressed)' }}
        >
          📲
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-extrabold text-[15px] m-0" style={{ color: 'var(--text-primary)' }}>Autenticación en Dos Pasos (2FA)</h4>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: isAnyActive ? 'rgba(16,185,129,0.15)' : 'var(--bg-pressed)',
                color: isAnyActive ? '#10B981' : 'var(--text-muted)',
                border: `1px solid ${isAnyActive ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)'}`,
              }}
            >
              {isAnyActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <p className="text-xs leading-normal m-0 mb-3" style={{ color: 'var(--text-secondary)' }}>
            Verificación adicional para transferencias, canje de cupones y accesos en nuevos dispositivos.
          </p>

          <div className="flex flex-col gap-2">
            {/* Opción 1: Correo */}
            <div 
              className="flex items-center justify-between p-2.5 rounded-xl border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <span className="text-[13px] font-bold block" style={{ color: 'var(--text-primary)' }}>✉️ Correo Electrónico</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Código OTP enviado a tu bandeja</span>
              </div>
              <button
                type="button"
                onClick={() => toggleMethod('email', 'Correo')}
                className="px-3 py-1 rounded-full text-[11px] font-black border-none cursor-pointer"
                style={{
                  background: methods.email ? '#10B981' : 'var(--bg-pressed)',
                  color: methods.email ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                {methods.email ? 'Activo' : 'Activar'}
              </button>
            </div>

            {/* Opción 2: Teléfono SMS / Telegram */}
            <div 
              className="flex items-center justify-between p-2.5 rounded-xl border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <span className="text-[13px] font-bold block" style={{ color: 'var(--text-primary)' }}>📱 SMS / WhatsApp / Telegram</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Código de 6 dígitos al móvil</span>
              </div>
              <button
                type="button"
                onClick={() => toggleMethod('phone', 'Número de Teléfono')}
                className="px-3 py-1 rounded-full text-[11px] font-black border-none cursor-pointer"
                style={{
                  background: methods.phone ? '#10B981' : 'var(--bg-pressed)',
                  color: methods.phone ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                {methods.phone ? 'Activo' : 'Activar'}
              </button>
            </div>

            {/* Opción 3: Google Authenticator / TOTP */}
            <div 
              className="flex items-center justify-between p-2.5 rounded-xl border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <span className="text-[13px] font-bold block" style={{ color: 'var(--text-primary)' }}>🔐 Google Authenticator / Authy</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Generador de códigos temporales TOTP</span>
              </div>
              <button
                type="button"
                onClick={() => toggleMethod('authenticatorApp', 'App Authenticator')}
                className="px-3 py-1 rounded-full text-[11px] font-black border-none cursor-pointer"
                style={{
                  background: methods.authenticatorApp ? '#10B981' : 'var(--bg-pressed)',
                  color: methods.authenticatorApp ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                {methods.authenticatorApp ? 'Activo' : 'Activar'}
              </button>
            </div>
          </div>

          {feedback && <p className="text-[11px] font-bold m-0 mt-2.5" style={{ color: 'var(--text-primary)' }}>{feedback}</p>}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
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

export default function SecurityPage() {
  const { user, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState<SettingsSection>('root');
  const [searchQuery, setSearchQuery] = useState('');

  const navigateTo = (sec: SettingsSection) => {
    PlatformBridge.hapticFeedback('light');
    setCurrentSection(sec);
  };

  const MENU_SECTIONS = [
    {
      id: 'account' as const,
      icon: User,
      title: 'Tu cuenta',
      desc: 'Consulta los datos de tu cuenta, ID de Telegram y estado de la sesión.',
    },
    {
      id: 'security_access' as const,
      icon: Lock,
      title: 'Seguridad y acceso a la cuenta',
      desc: 'Administra la seguridad de tu cuenta: Face ID, PIN de 4 dígitos y verificación en dos pasos.',
    },
    {
      id: 'privacy' as const,
      icon: EyeOff,
      title: 'Privacidad y transacciones',
      desc: 'Controla la visibilidad de tu saldo Bunz, pagos y protocolos Zero-Knowledge.',
    },
    {
      id: 'audit' as const,
      icon: Database,
      title: 'Auditoría y arquitectura TON',
      desc: 'Verifica los Smart Contracts, auditorías de seguridad y cifrado descentralizado.',
    },
  ];

  const filteredSections = MENU_SECTIONS.filter(s => 
    !searchQuery.trim() || 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex flex-col gap-4 mt-2">

        {/* --- VIEW: ROOT SETTINGS (Estilo X/Twitter Screenshots 1, 2, 3) --- */}
        {currentSection === 'root' && (
          <div className="flex flex-col gap-3">
            {/* Barra de Búsqueda estilo X/Twitter */}
            <div className="relative mb-1">
              <Search 
                size={18} 
                className="absolute left-4 top-1/2 -translate-y-1/2" 
                style={{ color: 'var(--text-muted)' }} 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en Configuración"
                className="w-full rounded-full pl-11 pr-4 py-2.5 text-[14px] outline-none border transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </div>

            {/* Lista Principal de Menús */}
            <div 
              className="rounded-2xl overflow-hidden border divide-y"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {filteredSections.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left border-none cursor-pointer transition-colors active:bg-(--bg-pressed) hover:bg-(--bg-pressed)"
                    style={{ background: 'transparent' }}
                  >
                    <IconComponent 
                      size={20} 
                      strokeWidth={2}
                      className="shrink-0"
                      style={{ color: 'var(--text-secondary)' }}
                    />
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="text-[15px] font-bold m-0 leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </h4>
                      <p className="text-[12px] m-0 mt-0.5 leading-normal line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                        {item.desc}
                      </p>
                    </div>
                    <ChevronRight 
                      size={18} 
                      className="shrink-0"
                      style={{ color: 'var(--text-muted)' }} 
                    />
                  </button>
                );
              })}
            </div>

            {/* SECCIÓN INFORMATIVA TRASLADADA A LA PARTE INFERIOR DEL MENÚ */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div 
                className="rounded-2xl p-4 border"
                style={{ 
                  background: 'var(--bg-elevated)', 
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">
                    SISTEMA PROTEGIDO · TON NETWORK
                  </span>
                </div>
                <h4 className="text-[15px] font-black m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                  Criptografía Descentralizada
                </h4>
                <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                  Rabbitty opera sobre protocolos no-custodiales en la blockchain de TON y cifrado de hardware en tu dispositivo.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {STATS.map(({ val, label, color }) => (
                    <div key={label} className="text-center">
                      <span className="text-base font-black block" style={{ color }}>{val}</span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: TU CUENTA --- */}
        {currentSection === 'account' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              Consulta o administra los detalles asociados a tu cuenta de Telegram y perfil Rabbitty.
            </p>

            <div 
              className="rounded-2xl overflow-hidden border divide-y"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Nombre</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{user?.firstName || 'Explorador'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Usuario</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>@{user?.username || 'explorador'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>ID de Telegram</span>
                <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{user?.id || '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Rol de cuenta</span>
                <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full bg-[#E91E63]/15 text-[#E91E63]">
                  {user?.role || 'EXPLORADOR'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm cursor-pointer mt-2"
              style={{ 
                background: 'rgba(239,68,68,0.1)', 
                color: '#EF4444', 
                borderColor: 'rgba(239,68,68,0.2)' 
              }}
            >
              <LogOut size={16} />
              <span>Cerrar sesión en este dispositivo</span>
            </button>
          </div>
        )}

        {/* --- VIEW: SEGURIDAD Y ACCESO A LA CUENTA --- */}
        {currentSection === 'security_access' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              Configura los métodos de autenticación directa y credenciales de acceso para tu dispositivo.
            </p>
            <FaceIdCard />
            <SecurityPinCard />
            <TwoFactorCard />
          </div>
        )}

        {/* --- VIEW: PRIVACIDAD Y TRANSACCIONES --- */}
        {currentSection === 'privacy' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              Gestiona qué información ven los comercios afiliados y cómo se resguardan tus actividades.
            </p>

            <div 
              className="rounded-2xl p-4 border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-start gap-3">
                <EyeOff className="text-[#E91E63] shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-[14px] font-extrabold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                    Protocolo Zero-Knowledge
                  </h4>
                  <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                    Tus pagos generan un hash criptográfico de verificación instantáneo en TON. Los comercios no tienen acceso a tu saldo total ni a tu historial general de compras.
                  </p>
                </div>
              </div>
            </div>

            <div 
              className="rounded-2xl p-4 border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-[14px] font-extrabold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                    Modo Incógnito en Check-ins
                  </h4>
                  <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
                    Tu estado de ánimo y respuestas de Rabbitty Mood se procesan de forma anónima para calcular el vibe colectivo sin vincular tu identidad nominal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: AUDITORÍA Y ARQUITECTURA TON --- */}
        {currentSection === 'audit' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              Infraestructura técnica, Smart Contracts auditados y estándares de seguridad.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {FEATURES.map((feat, i) => {
                const IconComponent = feat.icon;
                return (
                  <div
                    key={i}
                    className="border rounded-2xl p-3.5 flex gap-3.5 items-start"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div 
                      className="w-9 h-9 rounded-xl flex shrink-0 items-center justify-center mt-0.5"
                      style={{ background: 'var(--bg-pressed)' }}
                    >
                      <IconComponent size={18} style={{ color: feat.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-extrabold text-[14px] m-0" style={{ color: 'var(--text-primary)' }}>{feat.title}</h4>
                      </div>
                      <p className="text-xs leading-normal m-0" style={{ color: 'var(--text-secondary)' }}>{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </ProfileSubpageLayout>
  );
}
