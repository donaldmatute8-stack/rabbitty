"use client";

import type { SVGAttributes } from "react";

export interface LogoProps extends SVGAttributes<SVGSVGElement> {
  size?: number;
  variant?: "default" | "icon" | "full";
}

export function Logo({ size = 32, variant = "full", className, ...props }: LogoProps) {
  if (variant === "icon") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} {...props}>
        <rect width="32" height="32" rx="8" fill="#E91E63"/>
        <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" fontFamily="Outfit, sans-serif">R</text>
      </svg>
    );
  }
  return (
    <svg width={size * 4} height={size} viewBox="0 0 128 32" fill="none" className={className} {...props}>
      <rect width="32" height="32" rx="8" fill="#E91E63"/>
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" fontFamily="Outfit, sans-serif">R</text>
      <text x="42" y="22" fill="#111111" fontSize="16" fontWeight="700" fontFamily="Outfit, sans-serif">Rabbitty</text>
    </svg>
  );
}
