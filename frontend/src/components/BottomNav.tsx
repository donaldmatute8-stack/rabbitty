"use client";

import React from "react";
import { Search, ScanLine, ShoppingBag } from "lucide-react";

export type NavKey = "home" | "search" | "scan" | "bag";

interface BottomNavProps {
  active: NavKey;
  onChange: (key: NavKey) => void;
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around h-16 bg-[#ffffff]/90 backdrop-blur-md border-t border-[#f0f0f0]">
      <NavItem
        label="Ra"
        isActive={active === "home"}
        onClick={() => onChange("home")}
      >
        <RaLogo active={active === "home"} />
      </NavItem>

      <NavItem
        label="Search"
        isActive={active === "search"}
        onClick={() => onChange("search")}
      >
        <Search size={22} strokeWidth={1.6} />
      </NavItem>

      <NavItem
        label="Scan"
        isActive={active === "scan"}
        onClick={() => onChange("scan")}
      >
        <ScanLine size={22} strokeWidth={1.6} />
      </NavItem>

      <NavItem
        label="Bag"
        isActive={active === "bag"}
        onClick={() => onChange("bag")}
      >
        <ShoppingBag size={22} strokeWidth={1.6} />
      </NavItem>
    </nav>
  );
}

function NavItem({
  label,
  isActive,
  onClick,
  children,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-[3px] w-16 h-full active:scale-95 transition-transform"
    >
      <span
        style={{
          color: isActive ? "#e91e63" : "#8a8a8a",
          transition: "color 0.2s ease",
        }}
      >
        {children}
      </span>
      <span
        className="text-[10px] font-normal tracking-[-0.01em]"
        style={{
          color: isActive ? "#e91e63" : "#8a8a8a",
          transition: "color 0.2s ease",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* Custom “Ra” logomark for the active home tab */
function RaLogo({ active, size = 20 }: { active: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stylised “R” shape fused with rabbit ears */}
      <path
        d="M4 26V6h10c4 0 7 2 7 6 0 3-2 5-5 6l7 8h-5l-6-7H9v7H4zm5-11h5c2 0 3-1 3-3s-1-3-3-3H9v6z"
        fill={active ? "#e91e63" : "#8a8a8a"}
      />
      {/* Ear hint */}
      <path
        d="M22 4l3 6h-2l-2-4-2 4h-2l3-6h2z"
        fill={active ? "#e91e63" : "#8a8a8a"}
        opacity="0.8"
      />
    </svg>
  );
}
