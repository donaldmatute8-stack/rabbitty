'use client';

import { useEffect, useState, useRef } from 'react';
import BusinessSetupForm from '@/features/business/BusinessSetupForm';
import { BusinessWebGate } from '@/features/business/BusinessWebGate';
import MobileAffiliateDashboard from '@/features/business/MobileAffiliateDashboard';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { clearAffiliateIntent } from '@/lib/affiliateIntent';

export default function BusinessPage() {
  const { user, logout } = useAuth();
  const initDataRef = useRef('');
  const [business, setBusiness] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<'session' | 'network' | null>(null);

  const fetchBusiness = async () => {
    setLoadError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/business`, { headers });
      if (res.status === 401 || res.status === 403) {
        // Sesión caducada: NO es un negocio nuevo. Evita mandar a alguien con
        // cuenta al alta web por error.
        setLoadError('session');
        return;
      }
      if (!res.ok) {
        setLoadError('network');
        return;
      }
      const data = await res.json();
      if (data.success && data.business) {
        setBusiness(data.business);
      } else if (data.success === false) {
        setLoadError('network');
      }
    } catch (e) {
      console.error(e);
      setLoadError('network');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (business) clearAffiliateIntent();
  }, [business]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchBusiness();
    }
    import('@twa-dev/sdk').then(mod => {
      initDataRef.current = mod.default.initData || '';
    });
  }, [user]);

  const handleCreateBusiness = async (formData: Record<string, unknown>) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initDataRef.current,
          ...formData
        })
      });
      const data = await res.json();
      if (data.success) {
        setBusiness(data.business);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-7 h-7 border-2 border-[#E91E63]/30 border-t-[#E91E63] rounded-full animate-spin" />
      </div>
    );
  }

  // Si la carga falló o la sesión caducó, no asumimos que es un negocio nuevo.
  if (business === null && loadError) {
    const isSession = loadError === 'session';
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#111',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 32,
          textAlign: 'center',
          fontFamily: 'var(--font-family-base)',
        }}
      >
        <div style={{ fontSize: 40 }}>{isSession ? '🔒' : '📡'}</div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
          {isSession ? 'Tu sesión expiró' : 'No pudimos cargar tu negocio'}
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', maxWidth: 320 }}>
          {isSession
            ? 'Vuelve a iniciar sesión con tu teléfono o correo. Tu negocio y tu panel siguen intactos.'
            : 'Revisa tu conexión y vuelve a intentarlo. No te mandamos al alta para no duplicar tu negocio.'}
        </p>
        <button
          onClick={() => {
            if (isSession) {
              void logout();
              return;
            }
            setLoading(true);
            void fetchBusiness();
          }}
          style={{
            marginTop: 6,
            width: '100%',
            maxWidth: 320,
            padding: '16px',
            border: 'none',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #E91E63 0%, #FF6B9D 100%)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {isSession ? 'Iniciar sesión de nuevo' : 'Reintentar'}
        </button>
      </div>
    );
  }

  // Flow 1: alta de negocio. La web es el canal oficial; el formulario local
  // queda como alternativa secundaria (showLocalForm).
  if (business === null) {
    if (showLocalForm) {
      return <BusinessSetupForm onSubmit={handleCreateBusiness} isLoading={submitting} />;
    }
    return (
      <BusinessWebGate
        onLocal={() => setShowLocalForm(true)}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await fetchBusiness();
          setRefreshing(false);
        }}
      />
    );
  }

  // Flow 2: Active Business Dashboard (Airbnb-Style Mobile View)
  return <MobileAffiliateDashboard business={business} telegramId={user?.telegramId || ''} />;
}
