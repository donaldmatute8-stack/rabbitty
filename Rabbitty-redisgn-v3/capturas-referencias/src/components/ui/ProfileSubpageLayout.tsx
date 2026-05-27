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
    <div className="page-wrap bg-[#F8F8F8]" style={{ fontFamily: "var(--font-family-base)", paddingBottom: 100 }}>
      <div style={{ height: 'max(env(safe-area-inset-top), 16px)' }} />

      <main className="flex-1 w-full max-w-[600px] mx-auto" style={{ paddingLeft: 16, paddingRight: 16 }}>

        {/* Header */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 8, marginBottom: 24, background: "#fff", margin: "0 -16px 24px", padding: "16px 20px 20px", borderBottom: "1px solid #F0F0F0", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
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
            <div>
              {typeof title === 'string' ? (
                <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.1 }}>
                  {title}
                </h1>
              ) : title}
            </div>
          </div>

          {/* Rabbit watermark */}
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.07, pointerEvents: "none" }}>
            <svg width="80" height="96" viewBox="0 0 38 48" fill="none">
              <path d="M11 1C11 1 7 4 7 14C7 20 9.5 23 13 23C16.5 23 18 19 18 14C18 6.5 14 1 11 1Z" fill="#111"/>
              <path d="M27 1C27 1 31 4 31 14C31 20 28.5 23 25 23C21.5 23 20 19 20 14C20 6.5 24 1 27 1Z" fill="#111"/>
              <ellipse cx="19" cy="33" rx="14" ry="12" fill="#111"/>
            </svg>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ paddingLeft: 0, paddingRight: 0 }}
        >
          {children}
        </motion.div>

        <div style={{ height: 40 }} />
      </main>

      <BottomNav />
    </div>
  );
}
