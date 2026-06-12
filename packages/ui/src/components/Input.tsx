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
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-gray-200/60 bg-white/50 backdrop-blur-md px-4 py-3 text-sm font-medium transition-all duration-300",
          "placeholder:text-gray-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]",
          "hover:bg-white/80 hover:border-gray-300",
          "focus:bg-white focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-500/10 focus:shadow-[0_4px_14px_rgba(236,72,153,0.1)]",
          "disabled:cursor-not-allowed disabled:bg-gray-50/50 disabled:text-gray-400",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
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
