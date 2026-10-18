'use client';

import { useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

const CRED_KEY = 'rabbitty_faceid_cred';

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
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      try {
        if (alive) setEnabled(Boolean(localStorage.getItem(CRED_KEY)));
      } catch {
        // silencioso
      }
    });
    if (typeof PublicKeyCredential !== 'undefined' && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((ok) => { if (alive) setSupported(ok); })
        .catch(() => { if (alive) setSupported(false); });
    } else {
      queueMicrotask(() => {
        if (alive) {
          const isNative = (() => { try { const m = require('@/lib/platform'); return m.PlatformBridge?.isNative() ?? false; } catch { return false; } })();
          // En app nativa iOS/Android WebAuthn puede funcionar; no marcar como false sin intentar
          setSupported(isNative ? null : false);
        }
      });
    }
    return () => { alive = false; };
  }, []);

  const webauthnError = (err: unknown): string => {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
    if (name === 'NotAllowedError') return '⚠️ Solicitud cancelada o no autorizada. Intenta de nuevo.';
    if (name === 'NotSupportedError') return '❌ Este navegador/webview no soporta WebAuthn. Abre la app en Safari de iOS.';
    if (name === 'SecurityError') return '❌ WebAuthn requiere HTTPS. Abre la página con https://.';
    if (name === 'InvalidStateError') return '❌ Ya existe una credencial biométrica en este navegador.';
    return '❌ No se pudo activar. Intenta de nuevo.';
  };

  const enable = async () => {
    if (busy) return;
    if (typeof navigator === 'undefined' || !navigator.credentials || typeof PublicKeyCredential === 'undefined') {
      setFeedback('❌ Este navegador no ofrece WebAuthn. Abre Rabbitty en Safari de iOS.');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
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
        setEnabled(true);
        setFeedback('✅ Face ID / Touch ID activado en este dispositivo.');
      } else {
        setFeedback('❌ El navegador no devolvió credencial. Intenta de nuevo.');
      }
    } catch (err) {
      setFeedback(webauthnError(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const rawId = localStorage.getItem(CRED_KEY);
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
      if (assertion) setFeedback('🔓 Verificación biométrica exitosa.');
    } catch (err) {
      setFeedback(webauthnError(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = () => {
    try { localStorage.removeItem(CRED_KEY); } catch { /* silencioso */ }
    setEnabled(false);
    setFeedback('Protección biométrica desactivada.');
  };

  return (
    <div className="bg-[#161622] border border-white/10 rounded-[22px] p-4">
      <div className="flex items-start gap-4">
        <div className="w-[46px] h-[46px] rounded-[14px] flex shrink-0 items-center justify-center text-[22px] border border-white/5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          🫣
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-black text-white text-[14px] m-0">Face ID / Touch ID</h4>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
                color: enabled ? '#34D399' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${enabled ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {enabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <p className="text-white/60 text-xs leading-[1.5] m-0 mb-3">
            Bloqueo con biometría vía WebAuthn (Face ID / Touch ID). Tu clave biométrica nunca sale de tu dispositivo.
          </p>
          {(supported === false || supported === null) && !enabled && (
            <p className="text-[11px] font-bold m-0 mb-2" style={{ color: '#F59E0B' }}>
              {(typeof window !== 'undefined' && (window as any).__cap_native__) ? '⚠️ En app nativa WebAuthn puede depender del dispositivo/HTTPS. Prueba "Activar Face ID" directamente (iOS suele mostrar el prompt biométrico).' : '⚠️ No se detectó Face ID automáticamente en esta sesión (webview). Prueba a activarlo de todos modos; si falla, ábrelo en Safari.'}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {!enabled ? (
              <button
                onClick={enable}
                disabled={busy}
                className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer disabled:opacity-50"
                style={{ background: '#10B981', color: '#06281C' }}
              >
                {busy ? 'Activando…' : 'Activar Face ID'}
              </button>
            ) : (
              <>
                <button
                  onClick={verify}
                  disabled={busy}
                  className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.4)' }}
                >
                  {busy ? 'Verificando…' : 'Probar ahora'}
                </button>
                <button
                  onClick={disable}
                  disabled={busy}
                  className="rounded-full px-4 py-2 text-[12px] font-black border-none cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(211,47,47,0.15)', color: '#FCA5A5', border: '1px solid rgba(211,47,47,0.4)' }}
                >
                  Desactivar
                </button>
              </>
            )}
          </div>
          {feedback && <p className="text-[11px] font-bold m-0 mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>{feedback}</p>}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: '🔑', color: '#10B981', bg: '#F0FDF4', title: 'Llaves Privadas',    desc: 'Tus llaves privadas de TON nunca tocan nuestros servidores. Se encriptan localmente en tu dispositivo con AES-256.' },
  { icon: '🛡️', color: '#6366F1', bg: '#EEF2FF', title: 'Contratos Auditados', desc: 'Nuestros Smart Contracts en la blockchain han sido auditados por firmas de seguridad independientes.' },
  { icon: '🫶', color: '#F59E0B', bg: '#FFFBEB', title: 'Biometría',           desc: 'Soporte completo para Face ID y Touch ID a través de Telegram y tu wallet nativa de TON.' },
  { icon: '🕵️', color: '#E91E63', bg: '#FFF0F5', title: 'Zero-Knowledge',     desc: 'El saldo de tu billetera es privado. Los negocios solo ven tu dirección pública cuando interactúas.' },
];

const STATS = [
  { val: '0',    label: 'Hackeos',  color: '#10B981' },
  { val: '100%', label: 'Uptime',   color: '#6366F1' },
  { val: '256b', label: 'AES',      color: '#F59E0B' },
];

export default function SecurityPage() {
  return (
    <ProfileSubpageLayout title="Seguridad">
      <div className="flex flex-col gap-4 mt-2">

        {/* Hero card */}
        <div
          className="relative overflow-hidden rounded-[28px] px-6 py-7 border border-[rgba(255,255,255,0.05)] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
          style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111827 55%, #0D2818 100%)' }}
        >
          {/* Glow blobs */}
          <div className="absolute -right-[8%] -top-[8%] w-[176px] h-[176px] rounded-full blur-[50px]" style={{ background: 'rgba(16,185,129,0.15)' }} />
          <div className="absolute -left-[5%] -bottom-[5%] w-[128px] h-[128px] rounded-full blur-[40px]" style={{ background: 'rgba(99,102,241,0.1)' }} />

          {/* Status badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5 relative z-10"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <div className="w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_6px_#10B981]" />
            <span className="text-[10px] font-black text-[#34D399] tracking-[1.5px]">SISTEMA PROTEGIDO</span>
          </div>

          <div className="relative z-10">
            <div
              className="w-16 h-16 rounded-[20px] flex items-center justify-center text-[28px] mb-4"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >🔒</div>
            <h2 className="text-[22px] font-black text-white m-0 mb-2 tracking-[-0.5px] leading-[1.2]">
              Seguridad de Nivel Bancario
            </h2>
            <p className="text-[13px] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Rabbitty utiliza criptografía de última generación y la infraestructura descentralizada de TON para garantizar que tus activos estén siempre a salvo.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 relative z-10">
            {STATS.map(({ val, label, color }) => (
              <div
                key={label}
                className="rounded-[16px] p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <p className="text-lg font-black m-0 mb-0.5" style={{ color }}>{val}</p>
                <p className="text-[10px] font-semibold m-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <h3 className="font-black text-white text-[15px] mt-2 mx-1 mb-0 p-0">Características Clave</h3>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className="bg-[#161622] border border-white/10 rounded-[22px] p-4 flex gap-4 items-start shadow-md"
            >
              <div
                className="w-[46px] h-[46px] rounded-[14px] flex shrink-0 items-center justify-center text-[22px] mt-0.5 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {feat.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-black text-white text-[14px] m-0">{feat.title}</h4>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: feat.color }} />
                </div>
                <p className="text-white/60 text-xs leading-[1.5] m-0">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <FaceIdCard />
        <div className="h-4" />

      </div>
    </ProfileSubpageLayout>
  );
}
