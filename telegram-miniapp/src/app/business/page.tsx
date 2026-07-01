'use client';

import { useEffect, useState, useRef } from 'react';
import BusinessSetupForm from '@/features/business/BusinessSetupForm';
import MobileAffiliateDashboard from '@/features/business/MobileAffiliateDashboard';
import { useAuth } from '@/features/auth/AuthProvider';

export default function BusinessPage() {
  const { user } = useAuth();
  const initDataRef = useRef('');
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBusiness();
    }
    import('@twa-dev/sdk').then(mod => {
      initDataRef.current = mod.default.initData || '';
    });
  }, [user]);

  const fetchBusiness = async () => {
    try {
      const res = await fetch(`/api/business?telegramId=${user.telegramId}`);
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

  const handleCreateBusiness = async (formData: any) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Flow 1: Create Business (Onboarding)
  if (business === null) {
    return <BusinessSetupForm onSubmit={handleCreateBusiness} isLoading={submitting} />;
  }

  // Flow 2: Active Business Dashboard (Airbnb-Style Mobile View)
  return <MobileAffiliateDashboard business={business} telegramId={user?.telegramId || ''} />;
}
