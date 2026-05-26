'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        padding: "56px 28px 40px",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <button 
          onClick={() => router.push('/onboarding')}
          style={{ padding: 4, background: "none", border: "none", cursor: "pointer" }}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <motion.h1 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: 36,
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
          lineHeight: 1.15,
          marginBottom: 52,
        }}
      >
        Welcome back
      </motion.h1>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ flex: 1 }}
      >
        <div style={{ marginBottom: 32 }}>
          <input
            type="email"
            placeholder="Email address"
            style={{
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid #DCDCDC",
              padding: "12px 0",
              fontSize: 17,
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "var(--font-family-base)",
            }}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Password"
            style={{
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid #DCDCDC",
              padding: "12px 0",
              fontSize: 17,
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "var(--font-family-base)",
            }}
          />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}
      >
        <button 
          onClick={() => router.push('/')}
          className="active:scale-[0.98] transition-transform"
          style={{
            width: "100%",
            backgroundColor: "var(--bg-subtle)",
            color: "#555",
            fontSize: 16,
            fontWeight: 500,
            padding: "17px 0",
            borderRadius: 100,
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-family-base)",
          }}
        >
          Login
        </button>
        <button 
          style={{
            background: "none",
            border: "none",
            color: "var(--rabbitty-pink)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-family-base)",
          }}
        >
          Forgot password?
        </button>
      </motion.div>
    </div>
  );
}
