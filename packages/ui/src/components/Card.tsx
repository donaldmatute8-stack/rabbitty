"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "ghost";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl transition-all duration-300",
          variant === "default" && "bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 dark:border-white/10",
          variant === "bordered" && "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-2 border-pink-500/20 shadow-[0_0_20px_rgba(236,72,153,0.1)]",
          variant === "ghost" && "bg-neutral-50/50 dark:bg-neutral-800/50 backdrop-blur-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
