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
          "rounded-2xl",
          variant === "default" && "bg-white shadow-sm border border-gray-100",
          variant === "bordered" && "bg-white border-2 border-gray-100",
          variant === "ghost" && "bg-gray-50",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
