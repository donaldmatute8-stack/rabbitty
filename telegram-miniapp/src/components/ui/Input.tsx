'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  helperText?: string;
  isLoading?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, iconPosition = 'left', helperText, isLoading, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[var(--text-caption)] font-medium text-[var(--text-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-[var(--radius-md)] border bg-[var(--bg-elevated)] text-[var(--text-primary)]',
              'text-[var(--text-body)] placeholder:text-[var(--text-muted)]',
              'transition-all duration-[var(--duration-fast)]',
              'focus:border-[var(--rabbitty-pink)] focus:ring-2 focus:ring-[var(--rabbitty-pink-20)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error-10)]'
                : 'border-[var(--border-default)]',
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              'px-4 py-3',
              className
            )}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {icon}
            </div>
          )}
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--rabbitty-pink)] border-t-transparent" />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-[var(--text-small)] text-[var(--error)] animate-shake">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-[var(--text-small)] text-[var(--text-muted)]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
