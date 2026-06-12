"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          variant === "primary" && "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-[0_4px_14px_0_rgba(236,72,153,0.39)] hover:shadow-[0_6px_20px_rgba(236,72,153,0.23)] border border-pink-400/20",
          variant === "secondary" && "bg-white/80 backdrop-blur-md text-gray-900 hover:bg-white border border-gray-200 shadow-sm hover:shadow-md",
          variant === "ghost" && "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          variant === "danger" && "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-[0_4px_14px_0_rgba(239,68,68,0.39)] border border-red-400/20",
          size === "sm" && "h-9 px-4 text-sm gap-1.5",
          size === "md" && "h-12 px-6 text-base gap-2",
          size === "lg" && "h-14 px-8 text-lg gap-2.5",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
