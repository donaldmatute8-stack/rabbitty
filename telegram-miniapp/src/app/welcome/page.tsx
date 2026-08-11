'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleChooseRole = async (role: "RABBITTER" | "AFFILIATE") => {
    setLoading(role);
    try {
      const mod = await import('@twa-dev/sdk');
      const app = mod.default;
      const initData = typeof window !== 'undefined' ? app.initData : '';
      const targetRole = role === "RABBITTER" ? "USER" : "AFFILIATE";

      await fetch('/api/auth/set-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole, initData }),
      });

      if (role === "AFFILIATE") {
        router.push('/business');
      } else {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
      router.push(role === "AFFILIATE" ? '/business' : '/');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col overflow-hidden"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-subtle)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center pt-14 px-6">
        <img
          src="/Ra.png"
          alt="Rabbitty"
          className="w-[160px] h-[160px] object-contain"
        />
      </div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 px-6 text-center"
      >
        <h1
          className="text-[38px] font-extrabold tracking-[-0.5px] leading-[1.15]"
          style={{ color: "var(--text-primary)" }}
        >
          Welcome to Rabbitty.
        </h1>
        <p
          className="mt-4 text-[15px] leading-[1.55] px-4"
          style={{ color: "var(--text-muted)" }}
        >
          Share experiences, earn bunz, live better.<br />
          First, tell us how you want to participate.
        </p>
      </motion.div>

      {/* Role Cards */}
      <div className="mt-8 px-6 flex flex-col gap-4">

        {/* Rabbitter */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => !loading && handleChooseRole("RABBITTER")}
          className="active:scale-[0.98] transition-transform transition-opacity duration-200 rounded-[14px] px-6 pt-6 pb-5"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading && loading !== "RABBITTER" ? 0.5 : 1,
          }}
        >
          <p className="text-[15px] font-bold m-0 mb-1" style={{ color: "var(--text-primary)" }}>
            Become a member.
          </p>
          <p className="text-xs m-0 mb-[14px]" style={{ color: "var(--text-muted)" }}>
            Enter the Rabbitty experience — visit places, earn bunz, enjoy rewards.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold" style={{ color: "var(--rabbitty-pink)" }}>→</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--rabbitty-pink)" }}>
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
          className="active:scale-[0.98] transition-transform transition-opacity duration-200 rounded-[14px] px-6 pt-6 pb-5"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading && loading !== "AFFILIATE" ? 0.5 : 1,
          }}
        >
          <p className="text-[15px] font-bold m-0 mb-1" style={{ color: "var(--text-primary)" }}>
            Own a Business? Affiliate now.
          </p>
          <p className="text-xs m-0 mb-[14px]" style={{ color: "var(--text-muted)" }}>
            List your business, configure rewards, and attract Rabbitters near you.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold" style={{ color: "var(--rabbitty-pink)" }}>→</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--rabbitty-pink)" }}>
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
        className="mt-10 text-center"
      >
        <p
          className="text-sm font-semibold cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onClick={() => router.push('/login')}
        >
          Already have an account?{" "}
          <span style={{ color: "var(--rabbitty-pink)" }}>Login</span>
        </p>
      </motion.div>

      <div className="mt-auto pb-8 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>© Rabbitty</p>
      </div>
    </div>
  );
}
