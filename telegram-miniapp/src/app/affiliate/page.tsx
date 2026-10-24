'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AffiliateIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/business');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-7 h-7 border-2 border-[#E91E63]/30 border-t-[#E91E63] rounded-full animate-spin" />
    </div>
  );
}
