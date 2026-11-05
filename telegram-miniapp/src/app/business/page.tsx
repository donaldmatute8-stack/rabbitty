'use client';

import { useEffect, useState, useRef } from 'react';
import BusinessSetupForm from '@/features/business/BusinessSetupForm';
import { BusinessWebGate } from '@/features/business/BusinessWebGate';
import MobileAffiliateDashboard from '@/features/business/MobileAffiliateDashboard';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { clearAffiliateIntent } from '@/lib/affiliateIntent';

export default function BusinessPage() {
  const { user } = useAuth();
  const initDataRef = useRef('');
  const [business, setBusiness] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBusiness = async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/business`, { headers });
      const data = await res.json();
      if (data.success && data.business) {
        setBusiness(data.business);
      }
    } catch (e) {
      console.error(e);
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
