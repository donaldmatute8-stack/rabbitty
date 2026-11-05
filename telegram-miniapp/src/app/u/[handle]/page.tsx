'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowUpRight, Download } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

interface PublicUser {
  id: string;
  username?: string | null;
  name: string;
  handle: string;
}

/**
 * Perfil público del Rabbitty Code Simple (`/u/<handle>`).
 *
 * Es lo que abre una cámara externa al leer el QR. Dentro de la app se puede
 * transferir Bunz; fuera, se ofrece abrir Rabbitty o descargarla.
 */
export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const handleParam =
    typeof params?.handle === 'string'
      ? params.handle
      : Array.isArray(params?.handle)
        ? params.handle[0]
        : '';

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/rabbitty-code/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `@${decodeURIComponent(handleParam || '')}` }),
        });
        const data = await res.json();
        if (!alive) return;
        if (data?.success && data?.type === 'user' && data?.user) {
          setProfile(data.user as PublicUser);
        } else {
          setNotFound(true);
        }
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleParam]);

  const openInApp = () => {
    if (!profile) return;
    PlatformBridge.hapticFeedback('light');
    if (PlatformBridge.isNative() || PlatformBridge.isTelegram()) {
      router.push(`/profile/wallet?to=${encodeURIComponent(profile.handle)}`);
      return;
    }
    // Visitante externo: intenta abrir la app; si no está, cae a descarga.
    const deepLink = `rabbitty://pay?to=${encodeURIComponent(profile.handle)}`;
    let left = false;
    const markLeft = () => {
      left = true;
    };
    window.addEventListener('blur', markLeft, { once: true });
    document.addEventListener('visibilitychange', markLeft, { once: true });
    window.location.href = deepLink;
    window.setTimeout(() => {
      window.removeEventListener('blur', markLeft);
      if (left || document.visibilityState === 'hidden') return;
      window.location.href = 'https://rabbitty.me/download';
    }, 1500);
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, rgba(233,30,99,0.10) 0%, #09090D 55%, #050507 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div
          style={{
            width: 84,
            height: 84,
            margin: '0 auto -20px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '4px solid #fff',
            background: '#fff',
            position: 'relative',
            zIndex: 2,
            boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Rabbitty_vector.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div
          style={{
            borderRadius: 28,
            background: '#fff',
            color: '#111',
            padding: '34px 22px 22px',
            boxShadow: '0 18px 50px -12px rgba(0,0,0,0.55)',
          }}
        >
          {loading && <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Cargando perfil…</p>}

          {!loading && notFound && (
            <>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Perfil no encontrado</p>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#666' }}>
                Este código no corresponde a un Rabbitter activo.
              </p>
              <a
                href="https://rabbitty.me"
                style={{
                  display: 'inline-block',
                  marginTop: 16,
                  borderRadius: 999,
                  background: '#4C1D95',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  padding: '11px 18px',
                  textDecoration: 'none',
                }}
              >
                Conocer Rabbitty
              </a>
            </>
          )}

          {profile && (
            <>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>{profile.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#4C1D95' }}>
                {profile.handle}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#777', lineHeight: 1.5 }}>
                Código oficial de Rabbitty. Pide o envía Bunz de forma segura.
              </p>

              <button
                type="button"
                onClick={openInApp}
                style={{
                  marginTop: 18,
                  width: '100%',
                  border: 'none',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #FF2E93, #8B5CF6)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 900,
                  padding: '13px 16px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Abrir en Rabbitty <ArrowUpRight size={16} />
              </button>

              <a
                href="https://rabbitty.me/download"
                style={{
                  marginTop: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid #E5E7EB',
                  color: '#374151',
                  fontSize: 13,
                  fontWeight: 800,
                  padding: '12px 16px',
                  textDecoration: 'none',
                }}
              >
                <Download size={15} /> Descargar la app
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
