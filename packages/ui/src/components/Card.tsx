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
          "rounded-2xl transition-all duration-300",
          variant === "default" && "bg-[var(--bg-elevated)] shadow-sm border border-[var(--border-subtle)]",
          variant === "bordered" && "bg-[var(--bg-elevated)] border-2 border-[var(--border-subtle)]",
          variant === "ghost" && "bg-[var(--bg-subtle)]",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
