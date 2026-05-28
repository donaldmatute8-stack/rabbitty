'use client';

import { motion } from "framer-motion";
import { useRouter } from 'next/navigation';

import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";

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

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", overflow: "hidden" }}>
        <DottedGlowBackground
          className="pointer-events-none mask-radial-to-90% mask-radial-at-center"
          opacity={1}
          gap={10}
          radius={2}
          colorLightVar="--rabbitty-pink"
          glowColorLightVar="--rabbitty-pink"
          colorDarkVar="--rabbitty-pink-muted"
          glowColorDarkVar="--rabbitty-pink"
          backgroundOpacity={0}
          speedMin={0.3}
          speedMax={1.6}
          speedScale={1}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ position: "relative", zIndex: 20, width: 220, height: 220 }}
        >
          <img
            src="/logo_conejo.png"
            alt="Rabbitty Logo"
            style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 20px rgba(255,255,255,0.15))" }}
          />
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
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          transition={{ delay: 0.5 }}
          className="relative overflow-hidden group w-full transition-transform"
          style={{
            background: 'linear-gradient(135deg, var(--rabbitty-pink) 0%, #E91E63 100%)',
            color: "#FFF",
            fontSize: 16,
            fontWeight: 600,
            padding: "17px 0",
            borderRadius: 100,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(233,30,99,0.3)",
            fontFamily: "var(--font-family-base)",
          }}
        >
          {/* Subtle shine effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 1 }}
          />
          <span className="relative z-10">Start bunz'in</span>
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
