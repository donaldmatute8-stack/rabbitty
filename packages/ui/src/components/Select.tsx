import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <select
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-gray-200/60 bg-white/50 backdrop-blur-md px-4 py-3 text-sm font-medium transition-all duration-300",
          "hover:bg-white/80 hover:border-gray-300",
          "focus:bg-white focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-500/10 focus:shadow-[0_4px_14px_rgba(236,72,153,0.1)]",
          "disabled:cursor-not-allowed disabled:bg-gray-50/50 disabled:text-gray-400",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);
Select.displayName = "Select";

export { Select };
