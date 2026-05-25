"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface Tab {
  id: string;
  label: string;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function AnimatedTabs({ tabs, activeId, onChange }: AnimatedTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measureActive = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-tab="${activeId}"]`) as HTMLElement | null;
    if (!activeBtn) return;
    setIndicator({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
    });
  }, [activeId]);

  useEffect(() => {
    measureActive();
    window.addEventListener("resize", measureActive);
    return () => window.removeEventListener("resize", measureActive);
  }, [measureActive]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center gap-8 px-4 border-b border-transparent"
      style={{ paddingBottom: 0 }}
    >
      {tabs.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            data-tab={t.id}
            onClick={() => onChange(t.id)}
            className="relative pb-3 text-[15px] font-normal tracking-[-0.01em] transition-colors duration-200 select-none"
            style={{ color: isActive ? "#111111" : "#8a8a8a" }}
          >
            {t.label}
          </button>
        );
      })}

      {/* Sliding pink indicator */}
      <span
        className="tab-indicator"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  );
}
