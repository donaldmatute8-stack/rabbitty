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
      className="min-h-[100dvh] flex flex-col overflow-hidden"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      <div className="pt-[72px] pl-[28px]">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[40px] font-extrabold leading-[1.2] tracking-[-0.5px]"
          style={{ color: "var(--text-primary)" }}
        >
          Awake 'n'
          <br />
          bunz it
        </motion.h1>
      </div>

      <div className="flex-1 relative flex items-center justify-center w-full overflow-hidden">
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
          className="relative z-20 w-[220px] h-[220px]"
        >
          <img
            src="/logo_conejo.png"
            alt="Rabbitty Logo"
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          />
        </motion.div>
      </div>

      <div
        className="rounded-t-[28px] pt-[28px] px-6 pb-10"
        style={{ backgroundColor: "var(--bg-subtle)" }}
      >
        <motion.button
          onClick={handleStart}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          transition={{ delay: 0.5 }}
          className="relative overflow-hidden group w-full transition-transform text-white text-[16px] font-semibold py-[17px] rounded-full border-none cursor-pointer shadow-[0_4px_15px_rgba(233,30,99,0.3)]"
          style={{
            background: 'linear-gradient(135deg, var(--rabbitty-pink) 0%, #E91E63 100%)',
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
          className="text-center mt-5 text-[14px] text-[#888]"
        >
          Already have an account?{" "}
          <span
            onClick={handleLogin}
            className="active:opacity-70 transition-opacity font-medium cursor-pointer"
            style={{ color: "var(--rabbitty-pink)" }}
          >
            Login.
          </span>
        </motion.p>
      </div>
    </div>
  );
}
