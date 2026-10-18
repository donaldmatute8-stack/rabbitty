'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BUNZY_LAUNCH_EVENT } from '@/lib/bunzyLaunch';
import RabbittyContourLoader from '@/components/ui/RabbittyContourLoader';

export default function BunzyLaunchOverlay() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    const onLaunch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const prefill = typeof detail?.prefill === 'string' ? detail.prefill : '';
      setPending(prefill);
      timer = window.setTimeout(() => {
        router.push(prefill ? `/chat/bot?prefill=${encodeURIComponent(prefill)}` : '/chat/bot');
        setPending(null);
      }, 900);
    };
    window.addEventListener(BUNZY_LAUNCH_EVENT, onLaunch as EventListener);
    return () => {
      window.removeEventListener(BUNZY_LAUNCH_EVENT, onLaunch as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, [router]);

  return (
    <AnimatePresence>
      {pending !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            background: 'rgba(4, 4, 8, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <motion.img
            src="/logo_conejo.png"
            alt="Bunzy"
            initial={{ scale: 0.6, y: 24, opacity: 0 }}
            animate={{ scale: [0.6, 1.12, 1], y: [24, -8, 0], opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.6, 1] }}
            style={{ width: 96, height: 96, objectFit: 'contain', filter: 'drop-shadow(0 8px 28px rgba(233,30,99,0.55))' }}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.2px' }}>Abriendo Bunzy…</span>
            <RabbittyContourLoader size={44} label="" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
