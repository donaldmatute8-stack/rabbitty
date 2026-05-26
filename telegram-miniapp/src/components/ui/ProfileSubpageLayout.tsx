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
    <div className="page-wrap bg-white" style={{ fontFamily: "var(--font-family-base)", paddingBottom: 100 }}>
      {/* Top spacing to account for iOS/Android status bar (Telegram safe area) */}
      <div style={{ height: 'max(env(safe-area-inset-top), 16px)' }} />

      <main className="flex-1 w-full max-w-[600px] mx-auto" style={{ backgroundColor: '#FFFFFF', paddingLeft: 16, paddingRight: 16 }}>

        {/* Custom Header Row */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 8, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {showBack && (
              <button
                onClick={() => router.back()}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 8px 8px 0" }}
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                  <path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {/* Title or Avatar Block */}
            <div>
              {typeof title === 'string' ? (
                <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.1 }}>
                  {title}
                </h1>
              ) : (
                title
              )}
            </div>
          </div>

          <div style={{ position: "absolute", right: -8, top: typeof title === 'string' ? -24 : -16, zIndex: 5, pointerEvents: "none" }}>
            <img src="/Ra.png" alt="Rabbitty" style={{ width: 100, height: 100, objectFit: 'contain' }} />
          </div>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>

        <div style={{ height: 40 }} />
      </main>

      <BottomNav />
    </div>
  );
}
