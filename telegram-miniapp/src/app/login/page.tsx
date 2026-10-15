'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PhoneAuthFlow from '@/features/auth/PhoneAuthFlow';

function LoginInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  return <PhoneAuthFlow mode={mode} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0A0A0A]">
          <div className="w-10 h-10 rounded-full border-3 border-neutral-800 border-t-[#E91E63] animate-spin" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
