"use client";

import React from "react";
import { ChevronLeft } from "lucide-react";

interface HeaderProps {
  showBack?: boolean;
  onBack?: () => void;
}

export default function Header({ showBack = false, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-center h-14 px-4 bg-[#ffffff]">
      {showBack && (
        <button
          onClick={onBack}
          className="absolute left-4 p-1 text-[#111111] active:opacity-60 transition-opacity"
          aria-label="Go back"
        >
          <ChevronLeft size={24} strokeWidth={1.5} />
        </button>
      )}

      {/* Rabbit Logo — centered, no text brand */}
      <div className="flex items-center gap-2">
        <RabbitLogo />
      </div>
    </header>
  );
}

/* Minimal rabbit-with-glasses brand mark */
function RabbitLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Ears */}
      <ellipse cx="11" cy="7" rx="3" ry="7" fill="#111111" />
      <ellipse cx="21" cy="7" rx="3" ry="7" fill="#111111" />
      {/* Head */}
      <circle cx="16" cy="18" r="10" fill="#111111" />
      {/* Glasses frame */}
      <rect x="9" y="15" width="14" height="6" rx="3" fill="none" stroke="#e91e63" strokeWidth="1.4" />
      {/* Lenses */}
      <circle cx="13" cy="18" r="2.2" fill="#e91e63" opacity="0.9" />
      <circle cx="19" cy="18" r="2.2" fill="#e91e63" opacity="0.9" />
    </svg>
  );
}
