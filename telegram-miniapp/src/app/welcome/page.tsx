'use client';

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ paddingTop: 56, paddingLeft: 24, paddingRight: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button style={{ padding: 4, background: "none", border: "none", cursor: "pointer", display: "none" }}>
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
            <rect width="24" height="2.5" rx="1.25" fill="#111111" />
            <rect y="7.5" width="24" height="2.5" rx="1.25" fill="#111111" />
            <rect y="15" width="24" height="2.5" rx="1.25" fill="#111111" />
          </svg>
        </button>
        <img src="/Ra.png" alt="Rabbitty" style={{ width: 200, height: 200, objectFit: 'contain', justifyContent: "center", margin: "0 auto", position: "absolute", left: "50%", top: 28, transform: "translateX(-50%)" }} />
        <div style={{ width: 32 }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginTop: 150, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}
      >
        <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1.15 }}>
          Welcome, Bruce.
        </h1>
        <p style={{ marginTop: 16, fontSize: 15, color: "#666", lineHeight: 1.55, paddingLeft: 16, paddingRight: 16 }}>
          Rabbitty is about Sharing Experiences,<br />
          simply and efficiently use your time and<br />
          social life. Benefit yourself with bunz.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ marginTop: 32, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}
      >
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          You don't have any accounts
        </p>
      </motion.div>

      <div style={{ marginTop: 16, paddingLeft: 24, paddingRight: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => router.push('/')}
          className="active:scale-[0.98] transition-transform"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderRadius: 14,
            border: "1px solid var(--border-default)",
            padding: "24px 24px 20px",
            cursor: "pointer"
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: 4 }}>
            Become a member.
          </p>
          <p style={{ fontSize: 12, color: "#888", margin: 0, marginBottom: 14 }}>
            Enter de Rabbitty Experience
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--rabbitty-pink)", fontSize: 16, fontWeight: 600 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rabbitty-pink)" }}>Open an account</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/business')}
          className="active:scale-[0.98] transition-transform"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderRadius: 14,
            border: "1px solid var(--border-default)",
            padding: "24px 24px 20px",
            cursor: "pointer"
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: 14 }}>
            Own a Business? Affiliate now.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--rabbitty-pink)", fontSize: 16, fontWeight: 600 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rabbitty-pink)" }}>Open an account</span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ marginTop: 40, textAlign: "center" }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "#999", cursor: "pointer" }} onClick={() => router.push('/login')}>Already have an account? <span style={{ color: "var(--rabbitty-pink)" }}>Login</span></p>
      </motion.div>

      <div style={{ marginTop: "auto", paddingBottom: 32, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#bbb" }}>© Rabbitty</p>
      </div>
    </div>
  );
}
