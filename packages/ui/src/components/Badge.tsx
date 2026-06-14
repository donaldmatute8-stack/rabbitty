import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../cn";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "info";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
          variant === "default" && "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
          variant === "secondary" && "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
          variant === "success" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
          variant === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
          variant === "danger" && "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
          variant === "info" && "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
