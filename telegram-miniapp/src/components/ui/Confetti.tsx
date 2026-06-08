'use client';

import { useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  trigger?: boolean;
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  duration?: number;
}

export function Confetti({
  trigger = false,
  particleCount = 60,
  spread = 70,
  origin = { x: 0.5, y: 0.6 },
  colors = ['#E91E63', '#FF4081', '#C2185B', '#FFD700', '#FF6B6B', '#4ECDC4'],
  duration = 2000,
}: ConfettiProps) {
  const hasFired = useRef(false);

  const fire = useCallback(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: particleCount / 3,
        spread,
        origin,
        colors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, [particleCount, spread, origin, colors, duration]);

  useEffect(() => {
    if (trigger) {
      fire();
    }
  }, [trigger, fire]);

  return null;
}

// Manual trigger helper
export function triggerConfetti(options?: Omit<ConfettiProps, 'trigger'>) {
  const defaults = {
    particleCount: 60,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#E91E63', '#FF4081', '#C2185B', '#FFD700', '#FF6B6B', '#4ECDC4'],
    duration: 2000,
  };

  const config = { ...defaults, ...options };
  const end = Date.now() + config.duration;

  const frame = () => {
    confetti({
      particleCount: config.particleCount / 3,
      spread: config.spread,
      origin: config.origin,
      colors: config.colors,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}
