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
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export default function ProfileSubpageLayout({ title, children, showBack = true, centerTitle = false, left, right }: LayoutProps) {
  const router = useRouter();

  return (
    <div className="page-wrap" style={{ background: 'var(--bg-primary)', fontFamily: 'var(--font-family-base)', paddingBottom: 100, minHeight: '100dvh' }}>
      <main style={{ width: '100%', maxWidth: 600, margin: '0 auto', paddingLeft: 16, paddingRight: 16 }}>

        {/* Header estilo burbuja (sin fondo sólido): back a la izquierda, título en píldora central, acciones a la derecha */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 -16px 16px',
          height: 'calc(56px + var(--safe-top, 0px))',
          padding: 'calc(var(--safe-top, 0px) + 8px) 16px 8px',
          background: 'transparent',
          zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2 }}>
            {showBack && (
              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  router.back();
                }}
                aria-label="Volver"
                className="active:scale-90 transition-transform flex items-center justify-center"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  cursor: 'pointer',
                  padding: 0,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                }}
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                  <path d="M9 1L1 9L9 17" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {left}
            {!centerTitle && (typeof title === 'string' ? (
              <BubbleTitle>{title}</BubbleTitle>
            ) : (
              title
            ))}
          </div>

          {/* Título centrado en píldora flotante (estilo Telegram) */}
          {centerTitle && (
            <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
              {typeof title === 'string' ? (
                <BubbleTitle>{title}</BubbleTitle>
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

function BubbleTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontSize: 17,
        fontWeight: 900,
        color: 'var(--text-primary)',
        letterSpacing: '-0.3px',
        margin: 0,
        lineHeight: 1.15,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 999,
        padding: '7px 16px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        maxWidth: '58vw',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}
    >
      {children}
    </h1>
  );
}
