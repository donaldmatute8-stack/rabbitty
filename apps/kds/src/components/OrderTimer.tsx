"use client";

import { useState, useEffect } from "react";
import { cn } from "@rabbitty/ui";

interface OrderTimerProps {
  createdAt: string;
}

function getMinutesElapsed(createdAt: string): number {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diff / 60000);
}

export function OrderTimer({ createdAt }: OrderTimerProps) {
  const [minutes, setMinutes] = useState(() => getMinutesElapsed(createdAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutes(getMinutesElapsed(createdAt));
    }, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const color =
    minutes < 5
      ? "text-green-400"
      : minutes < 15
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <span className={cn("text-xs font-semibold", color)}>
      {minutes} min
    </span>
  );
}
