'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';

interface LayoutProps {
  title: React.ReactNode;
  children: React.ReactNode;
  showBack?: boolean;
}

export default function ProfileSubpageLayout({ title, children, showBack = true }: LayoutProps) {
  const router = useRouter();

  return (
    <div className="page-wrap" style={{ background: '#F8F8F8', fontFamily: 'var(--font-family-base)', paddingBottom: 100 }}>
      <div style={{ height: 'var(--safe-top)' }} />

      <main style={{ width: '100%', maxWidth: 600, margin: '0 auto', paddingLeft: 16, paddingRight: 16 }}>

        {/* Header */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 -16px 24px',
          height: 'calc(100px + var(--safe-top))',
          padding: 'var(--safe-top) 20px 0',
          background: '#fff',
          borderBottom: '1px solid #F0F0F0',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
            {showBack && (
              <button
                onClick={() => router.back()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 8px 8px 0' }}
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                  <path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {typeof title === 'string' ? (
              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: '-0.5px', margin: 0, lineHeight: 1.1 }}>
                {title}
              </h1>
            ) : (
              title
            )}
          </div>

          {/* Rabbit watermark */}
          <div style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', opacity: 1, pointerEvents: 'none' }}>
            <img src="/logo_conejo.png" alt="Rabbitty Logo" style={{ width: 'auto', height: 180, objectFit: 'contain', filter: 'brightness(0) invert(0.9)' }} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>

        <div style={{ height: 40 }} />
      </main>

      <BottomNav />
    </div>
  );
}
