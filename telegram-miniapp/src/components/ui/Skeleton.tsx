'use client';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  className?: string;
}

export default function Skeleton({ 
  variant = 'text',
  width,
  height,
  className = ''
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-gray-200 rounded';
  
  const variants = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

// Preset skeletons
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-[16px] overflow-hidden mx-4 mb-4 p-0">
      <Skeleton variant="rectangular" height="200px" className="rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
}

export function BusinessCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-md mx-4 mb-3">
      <Skeleton variant="circular" width="56px" height="56px" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
}
