'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/ui/Header';

export default function RoleSelectionPage() {
  const router = useRouter();

  const handleSelectMember = () => {
    // In the future this might call an API. For now, go to main feed
    router.push('/');
  };

  const handleSelectBusiness = () => {
    router.push('/business');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F4F4F4]" style={{ fontFamily: "var(--font-family-base)" }}>
      <div style={{ height: 'var(--safe-top)' }} />
      <Header showBack={true} isScrolled={false} />

      <main className="flex-1 flex flex-col w-full max-w-[600px] mx-auto mt-4" style={{ paddingLeft: 16, paddingRight: 16 }}>
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center", marginTop: 12 }}
        >
          <h1 style={{ fontSize: 38, fontWeight: 700, color: "var(--text-dark)", letterSpacing: "-0.5px", lineHeight: 1.15 }}>
            Welcome, Bruce.
          </h1>
          <p style={{ marginTop: 16, fontSize: 15, color: "#666", lineHeight: 1.55 }}>
            Rabbitty is about Sharing Experiences,<br/>
            simply and efficiently use your time and<br/>
            social life. Benefit yourself with bunz.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ marginTop: 32, textAlign: "center" }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>
            You don't have any accounts
          </p>
        </motion.div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <motion.button 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={handleSelectMember}
            className="active:scale-[0.98] transition-transform text-left"
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              border: "1px solid var(--border-light)",
              padding: "24px 24px 20px",
              cursor: "pointer",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>
              Become a member.
            </p>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
              Enter the Rabbitty Experience
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--primary-color)", fontSize: 16 }}>→</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--primary-color)" }}>Open an account</span>
            </div>
          </motion.button>

          <motion.button 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleSelectBusiness}
            className="active:scale-[0.98] transition-transform text-left"
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              border: "1px solid var(--border-light)",
              padding: "24px 24px 20px",
              cursor: "pointer",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 14 }}>
              Own a Business? Affiliate now.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--primary-color)", fontSize: 16 }}>→</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--primary-color)" }}>Open an account</span>
            </div>
          </motion.button>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ marginTop: 40, textAlign: "center" }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "#999" }}>No activity</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ marginTop: "auto", paddingBottom: 32, paddingTop: 32, textAlign: "center" }}
        >
          <p style={{ fontSize: 12, color: "#bbb" }}>© Rabbitty</p>
        </motion.div>
      </main>
    </div>
  );
}
