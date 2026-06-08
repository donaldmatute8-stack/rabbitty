'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isOnline?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-lg',
};

export function Avatar({
  src,
  alt = 'Avatar',
  fallback = '?',
  size = 'md',
  className,
  isOnline = false,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  const initials = fallback
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn('relative inline-flex', className)}>
      <div
        className={cn(
          'relative inline-flex items-center justify-center rounded-full',
          'bg-[var(--bg-pressed)] text-[var(--text-secondary)] font-semibold',
          'overflow-hidden select-none',
          sizeClasses[size]
        )}
      >
        {src && !hasError ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <span className="flex items-center justify-center h-full w-full">
            {initials}
          </span>
        )}
      </div>
      {isOnline && (
        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--bg-elevated)]" />
      )}
    </div>
  );
}
