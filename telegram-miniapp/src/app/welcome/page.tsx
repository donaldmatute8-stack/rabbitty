'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

export default function WelcomePage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [loading, setLoading] = useState<string | null>(null);

  const handleChooseRole = async (role: "RABBITTER" | "AFFILIATE") => {
    setLoading(role);
    try {
      const walletAddress = account?.address;
      if (walletAddress) {
        await fetch('/api/auth/set-role', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smart_wallet_address: walletAddress, role }),
        });
      }
      if (role === "AFFILIATE") {
        router.push('/business');
      } else {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
      // Navigate anyway even if the DB call fails; role can be set later
      router.push(role === "AFFILIATE" ? '/business' : '/');
    } finally {
      setLoading(null);
    }
  };

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
      {/* Logo */}
      <div style={{ paddingTop: 56, paddingLeft: 24, paddingRight: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src="/Ra.png"
          alt="Rabbitty"
          style={{ width: 160, height: 160, objectFit: 'contain' }}
        />
      </div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginTop: 24, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}
      >
        <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1.15 }}>
          Welcome to Rabbitty.
        </h1>
        <p style={{ marginTop: 16, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.55, paddingLeft: 16, paddingRight: 16 }}>
          Share experiences, earn bunz, live better.<br />
          First, tell us how you want to participate.
        </p>
      </motion.div>

      {/* Role Cards */}
      <div style={{ marginTop: 32, paddingLeft: 24, paddingRight: 24, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Rabbitter */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => !loading && handleChooseRole("RABBITTER")}
          className="active:scale-[0.98] transition-transform"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderRadius: 14,
            border: "1px solid var(--border-default)",
            padding: "24px 24px 20px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading && loading !== "RABBITTER" ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: 4 }}>
            Become a member.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginBottom: 14 }}>
            Enter the Rabbitty experience — visit places, earn bunz, enjoy rewards.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--rabbitty-pink)", fontSize: 16, fontWeight: 600 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rabbitty-pink)" }}>
              {loading === "RABBITTER" ? "Setting up…" : "Start as Rabbitter"}
            </span>
          </div>
        </motion.div>

        {/* Affiliate */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => !loading && handleChooseRole("AFFILIATE")}
          className="active:scale-[0.98] transition-transform"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderRadius: 14,
            border: "1px solid var(--border-default)",
            padding: "24px 24px 20px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading && loading !== "AFFILIATE" ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: 4 }}>
            Own a Business? Affiliate now.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginBottom: 14 }}>
            List your business, configure rewards, and attract Rabbitters near you.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--rabbitty-pink)", fontSize: 16, fontWeight: 600 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rabbitty-pink)" }}>
              {loading === "AFFILIATE" ? "Setting up…" : "Start as Affiliate"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Already have account */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ marginTop: 40, textAlign: "center" }}
      >
        <p
          style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
          onClick={() => router.push('/login')}
        >
          Already have an account?{" "}
          <span style={{ color: "var(--rabbitty-pink)" }}>Login</span>
        </p>
      </motion.div>

      <div style={{ marginTop: "auto", paddingBottom: 32, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>© Rabbitty</p>
      </div>
    </div>
  );
}
