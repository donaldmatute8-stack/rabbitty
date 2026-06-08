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
          variant === "default" && "bg-gray-100 text-gray-700",
          variant === "secondary" && "bg-purple-100 text-purple-700",
          variant === "success" && "bg-emerald-100 text-emerald-700",
          variant === "warning" && "bg-amber-100 text-amber-700",
          variant === "danger" && "bg-red-100 text-red-700",
          variant === "info" && "bg-blue-100 text-blue-700",
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
