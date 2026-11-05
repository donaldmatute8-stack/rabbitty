'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/features/auth/AuthProvider";
import PhoneAuthFlow from "@/features/auth/PhoneAuthFlow";
import { BunzyVideoStage } from "@/components/onboarding/BunzyVideoStage";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [flow, setFlow] = useState<'register' | 'login' | null>(null);

  // Active session opens the app directly (unless they logged out)
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.firstName) {
        router.replace('/signup?setup=1');
      } else if (user.role === 'AFFILIATE') {
        router.replace('/business');
      } else {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  // Phone-first onboarding: the celular step lives inside the onboarding route
  if (flow) {
    return <PhoneAuthFlow mode={flow} onBack={() => setFlow(null)} />;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col justify-between overflow-x-hidden overflow-y-auto px-5 pt-8 pb-10"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary, #0B0B0E)",
      }}
    >
      {/* Header sutil Rabbitty */}
      <div className="flex items-center justify-between w-full max-w-md mx-auto pt-2">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-400">
          RABBITTY 2026
        </span>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/25">
          Ecosistema Bunz
        </span>
      </div>

      {/* Hero central con video de Bunzy saludando */}
      <div className="flex-1 flex items-center justify-center py-6">
        <BunzyVideoStage
          videoSrc="/videos/bunzy/bunzy-1-hi.mp4"
          poster="/videos/bunzy/bunzy-1-hi.jpg"
          stepLabel="¡Hola, Rabbitter!"
          title="Awake 'n' bunz it"
          description="Gana Bunz en cada consumo, desbloquea recompensas reales y accede a beneficios exclusivos en tus lugares favoritos."
          videoHeightClass="h-52 sm:h-60"
        />
      </div>

      {/* Controles de Entrada */}
      <div className="w-full max-w-md mx-auto space-y-4">
        <motion.button
          onClick={() => setFlow('register')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={{ delay: 0.3 }}
          className="relative overflow-hidden group w-full text-white text-[16px] font-black py-[18px] rounded-full border-none cursor-pointer shadow-[0_6px_25px_rgba(233,30,99,0.35)] flex items-center justify-center tracking-wide"
          style={{
            background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
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
          <span className="relative z-10">Comenzar Ahora</span>
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-[14px] text-zinc-400"
        >
          ¿Ya tienes cuenta activa?{" "}
          <button
            type="button"
            onClick={() => setFlow('login')}
            className="text-pink-400 font-bold hover:underline cursor-pointer bg-transparent border-none p-0 inline"
          >
            Inicia sesión
          </button>
        </motion.p>
      </div>
    </div>
  );
}
