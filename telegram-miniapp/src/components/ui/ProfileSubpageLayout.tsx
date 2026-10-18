'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { PlatformBridge } from '@/lib/platform';

interface LayoutProps {
  title: React.ReactNode;
  children: React.ReactNode;
  showBack?: boolean;
  centerTitle?: boolean;
  right?: React.ReactNode;
}

export default function ProfileSubpageLayout({ title, children, showBack = true, centerTitle = false, right }: LayoutProps) {
  const router = useRouter();

  return (
    <div className="page-wrap" style={{ background: 'var(--bg-primary)', fontFamily: 'var(--font-family-base)', paddingBottom: 100, minHeight: '100dvh' }}>
      <main style={{ width: '100%', maxWidth: 600, margin: '0 auto', paddingLeft: 16, paddingRight: 16 }}>

        {/* Header */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 -16px 20px',
          height: 'calc(64px + var(--safe-top, 0px))',
          padding: 'calc(var(--safe-top, 0px) + 8px) 20px 12px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
            {showBack && (
              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  router.back();
                }}
                className="active:scale-90 transition-transform"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 8px 8px 0' }}
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                  <path d="M9 1L1 9L9 17" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {!centerTitle && (typeof title === 'string' ? (
              <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0, lineHeight: 1.1 }}>
                {title}
              </h1>
            ) : (
              title
            ))}
          </div>

          {/* Título centrado (estilo Telegram) */}
          {centerTitle && (
            <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
              {typeof title === 'string' ? (
                <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0, lineHeight: 1.1 }}>
                  {title}
                </h1>
              ) : (
                title
              )}
            </div>
          )}

          {/* Acciones a la derecha (opcional) */}
          {right && (
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {right}
            </div>
          )}

          {/* Rabbit watermark */}
          <div style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', opacity: 0.15, pointerEvents: 'none' }}>
            <img src="/logo_conejo.png" alt="Rabbitty Logo" style={{ width: 'auto', height: 180, objectFit: 'contain', filter: 'invert(1)' }} />
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
