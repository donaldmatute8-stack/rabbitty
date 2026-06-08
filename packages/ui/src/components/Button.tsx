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
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" && "bg-pink-600 text-white hover:bg-pink-700 shadow-sm",
          variant === "secondary" && "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200",
          variant === "ghost" && "text-gray-600 hover:bg-gray-100",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
          size === "sm" && "h-9 px-3 text-sm gap-1.5",
          size === "md" && "h-11 px-5 text-base gap-2",
          size === "lg" && "h-13 px-7 text-lg gap-2.5",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
