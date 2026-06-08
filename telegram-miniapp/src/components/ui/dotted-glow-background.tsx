'use client';

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DottedGlowBackground = ({
  className,
  opacity = 1,
  gap = 10,
  radius = 1.6,
  colorLightVar = "--rabbitty-pink",
  glowColorLightVar = "--rabbitty-pink",
  colorDarkVar = "--rabbitty-pink-muted",
  glowColorDarkVar = "--rabbitty-pink",
  backgroundOpacity = 0,
  speedMin = 0.3,
  speedMax = 1.6,
  speedScale = 1,
}: {
  className?: string;
  opacity?: number;
  gap?: number;
  radius?: number;
  colorLightVar?: string;
  glowColorLightVar?: string;
  colorDarkVar?: string;
  glowColorDarkVar?: string;
  backgroundOpacity?: number;
  speedMin?: number;
  speedMax?: number;
  speedScale?: number;
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      className={cn("absolute inset-0 z-0 h-full w-full overflow-hidden", className)}
      style={{
        opacity,
        WebkitMaskImage: "radial-gradient(circle at center, white 0%, transparent 90%)",
        maskImage: "radial-gradient(circle at center, white 0%, transparent 90%)",
      }}
    >
      <div
        className="absolute inset-0 bg-transparent"
        style={
          {
            backgroundImage: `radial-gradient(var(--dot-color) var(--dot-radius), transparent var(--dot-radius))`,
            backgroundSize: `var(--dot-gap) var(--dot-gap)`,
            "--dot-gap": `${gap}px`,
            "--dot-radius": `${radius}px`,
            "--dot-color": "rgba(255, 64, 129, 0.15)",
          } as React.CSSProperties
        }
      />
      {/* Animated Shimmering Dots Layer */}
      <motion.div
        className="absolute inset-0 bg-transparent"
        animate={{
          backgroundPosition: [`0px 0px`, `${gap * 2}px ${gap * 2}px`],
        }}
        transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
        style={
          {
            backgroundImage: `radial-gradient(var(--dot-color-2) var(--dot-radius), transparent var(--dot-radius))`,
            backgroundSize: `var(--dot-gap) var(--dot-gap)`,
            "--dot-gap": `${gap}px`,
            "--dot-radius": `${radius}px`,
            "--dot-color-2": "rgba(233, 30, 99, 0.4)",
            opacity: 0.7,
            mixBlendMode: "screen",
          } as React.CSSProperties
        }
      />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, var(--glow-color) 0%, transparent 60%)`,
        }}
        transition={{ type: "tween", ease: "backOut", duration: speedMax * speedScale }}
        style={
          {
            "--glow-color": "rgba(255, 64, 129, 0.4)",
            opacity: 0.15,
          } as React.CSSProperties
        }
      />
      
      {/* Fallback glow if no mouse movement */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,var(--glow-color)_0%,transparent_70%)] opacity-20"
        style={{ "--glow-color": "rgba(255, 64, 129, 0.3)" } as React.CSSProperties}
      />
    </div>
  );
};
