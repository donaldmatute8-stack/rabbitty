'use client';

import { motion } from "framer-motion";
import { useRouter } from 'next/navigation';

const FLOATING_CARDS = [
  { x: "72%", y: "12%", rotate: 20, delay: 0 },
  { x: "15%", y: "18%", rotate: -15, delay: 0.3 },
  { x: "80%", y: "38%", rotate: 10, delay: 0.6 },
  { x: "8%", y: "42%", rotate: -20, delay: 0.2 },
  { x: "65%", y: "58%", rotate: 25, delay: 0.8 },
  { x: "20%", y: "62%", rotate: -10, delay: 0.5 },
];

function FloatingCard({ x, y, rotate, delay }: { x: string; y: string; rotate: number; delay: number }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `rotate(${rotate}deg)`,
        width: 32,
        height: 20,
        backgroundColor: "#4CAF50",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { delay, duration: 0.4 },
        y: { delay, duration: 3.5, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <div style={{ width: 18, height: 2, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
    </motion.div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/signup');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ paddingTop: 72, paddingLeft: 28 }}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "var(--text-primary)",
            lineHeight: 1.2,
            letterSpacing: "-0.5px",
          }}
        >
          Awake 'n'
          <br />
          bunz it
        </motion.h1>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {FLOATING_CARDS.map((c, i) => (
          <FloatingCard key={i} {...c} />
        ))}

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ position: "relative", width: 260, height: 240 }}
        >
          <svg width="260" height="240" viewBox="0 0 260 240" fill="none">
            <ellipse cx="90" cy="130" rx="40" ry="75" fill="#E8E0D4" transform="rotate(-8 90 130)"/>
            <ellipse cx="90" cy="100" rx="22" ry="28" fill="#F5EDE0"/>
            <rect x="68" y="84" width="44" height="6" rx="3" fill="#333" fillOpacity="0.12"/>
            <line x1="54" y1="73" x2="52" y2="58" stroke="#555" strokeWidth="3" strokeLinecap="round"/>
            <line x1="56" y1="73" x2="64" y2="60" stroke="#555" strokeWidth="3" strokeLinecap="round"/>
            <ellipse cx="143" cy="148" rx="38" ry="72" fill="#D0C5B0" transform="rotate(5 143 148)"/>
            <ellipse cx="143" cy="118" rx="21" ry="27" fill="#E8DBc8"/>
            <rect x="122" y="102" width="42" height="6" rx="3" fill="#333" fillOpacity="0.12"/>
            <ellipse cx="200" cy="138" rx="36" ry="68" fill="#C4A882" transform="rotate(-3 200 138)"/>
            <ellipse cx="200" cy="110" rx="20" ry="26" fill="#D4B896"/>
            <rect x="180" y="95" width="40" height="6" rx="3" fill="#555" fillOpacity="0.2"/>
            <rect x="76" y="118" width="28" height="8" rx="4" fill="#F0D8C0"/>
            <rect x="134" y="134" width="26" height="8" rx="4" fill="#DEC8A8"/>
          </svg>
        </motion.div>
      </div>

      <div style={{
        backgroundColor: "var(--bg-subtle)",
        borderRadius: "28px 28px 0 0",
        padding: "28px 24px 40px",
      }}>
        <motion.button
          onClick={handleStart}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="active:scale-[0.98] transition-transform"
          style={{
            width: "100%",
            backgroundColor: "var(--bg-primary)",
            color: "#444",
            fontSize: 16,
            fontWeight: 500,
            padding: "17px 0",
            borderRadius: 100,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            fontFamily: "var(--font-family-base)",
          }}
        >
          Start bunzing
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#888" }}
        >
          Already have an account?{" "}
          <span 
            onClick={handleLogin}
            style={{ color: "var(--rabbitty-pink)", fontWeight: 500, cursor: "pointer" }}
            className="active:opacity-70 transition-opacity"
          >
            Login.
          </span>
        </motion.p>
      </div>
    </div>
  );
}
