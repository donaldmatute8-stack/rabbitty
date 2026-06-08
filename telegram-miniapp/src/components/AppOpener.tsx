'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppOpener() {
  const [showOpener, setShowOpener] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const hasSeenOpener = sessionStorage.getItem('rabbitty_opener_shown');
    if (!hasSeenOpener) {
      setShowOpener(true);
      // Allow animation to play, then remove from DOM
      setTimeout(() => {
        setIsRemoving(true);
        setTimeout(() => {
          setShowOpener(false);
          sessionStorage.setItem('rabbitty_opener_shown', 'true');
        }, 1200); // Wait for exit animation
      }, 3500); // Duration of the hold
    }
  }, []);

  useEffect(() => {
    // Config and request fullscreen for Telegram WebApp
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();

        const updateSafeInsets = () => {
          const topInset = tg.safeAreaInsets?.top || 0;
          const isFs = tg.isFullscreen || false;
          // The Telegram native Close (X) and Menu (...) buttons float at the top.
          // They take up about 44-50px. We must add this to the device notch (topInset) to clear them completely.
          const finalTop = topInset + 50;
          document.documentElement.style.setProperty('--tg-safe-top-adjusted', `${finalTop}px`);
        };

        if (tg.setHeaderColor) tg.setHeaderColor('#FFFFFF');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#FFFFFF');

        if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && typeof tg.requestFullscreen === 'function') {
          try {
            tg.requestFullscreen();
            console.log("Telegram fullscreen requested successfully");
          } catch (e) {
            console.error("Failed to request Telegram fullscreen:", e);
          }
        }

        // Run immediately and setup event listeners
        updateSafeInsets();
        
        // Small timeouts to let Telegram Webview state propagate
        setTimeout(updateSafeInsets, 200);
        setTimeout(updateSafeInsets, 1000);

        tg.onEvent('fullscreenChanged', updateSafeInsets);
        tg.onEvent('safeAreaChanged', updateSafeInsets);
        
        // Fallback interval just in case
        const interval = setInterval(updateSafeInsets, 1000);
        return () => {
          tg.offEvent('fullscreenChanged', updateSafeInsets);
          tg.offEvent('safeAreaChanged', updateSafeInsets);
          clearInterval(interval);
        };
      }
    }
  }, []);

  if (!showOpener) return null;

  return (
    <AnimatePresence>
      {!isRemoving && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#0A0A0A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(5px)' }}
            transition={{ duration: 2, ease: "easeOut" }}
            style={{ position: 'relative', width: 220, height: 220 }}
          >
            <img
              src="/logo_conejo.png"
              alt="Rabbitty"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 25px rgba(255, 64, 129, 0.4))'
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
