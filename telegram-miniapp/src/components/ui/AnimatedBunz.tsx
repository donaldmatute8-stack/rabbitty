"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/**
 * Número de Bunz que anima incrementos/decrementos y destella verde/rojo.
 * Solo re-renderiza durante la animación (~0.7s), no de forma continua.
 */
export default function AnimatedBunz({
  value,
  className,
  style,
  suffix,
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
  suffix?: string;
}) {
  const previous = useRef(Number.isFinite(value) ? value : 0);
  const [display, setDisplay] = useState(Number.isFinite(value) ? value : 0);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const from = previous.current;
    const to = Number.isFinite(value) ? value : 0;
    previous.current = to;
    if (from === to) return;

    setTrend(to > from ? "up" : "down");
    const controls = animate(from, to, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => setTrend(null),
    });
    return () => controls.stop();
  }, [value]);

  return (
    <span
      className={className}
      style={{
        ...style,
        color: trend === "up" ? "#4ADE80" : trend === "down" ? "#F87171" : style?.color,
        transition: "color 250ms ease",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {display.toLocaleString("es-MX")}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}
