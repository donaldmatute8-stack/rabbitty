import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all duration-300",
          "placeholder:text-gray-500",
          "hover:bg-white/10 hover:border-white/20",
          "focus:bg-white/10 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:shadow-[0_4px_14px_rgba(236,72,153,0.15)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          error && "border-red-500/70 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

export { Input };
