'use client';

import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'clickable' | 'elevated';
  className?: string;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({
  children,
  variant = 'default',
  className,
  onClick,
  padding = 'md',
}: CardProps) {
  const isClickable = variant === 'clickable' || !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        // Base
        'rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] border border-[var(--border-default)]',
        'transition-all duration-[var(--duration-normal)]',
        paddingMap[padding],
        // Variants
        variant === 'default' && 'shadow-[var(--shadow-sm)]',
        variant === 'elevated' && 'shadow-[var(--shadow-md)]',
        // Clickable states
        isClickable && 'cursor-pointer active:scale-[0.98] active:shadow-[var(--shadow-sm)]',
        className
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {children}
    </div>
  );
}
