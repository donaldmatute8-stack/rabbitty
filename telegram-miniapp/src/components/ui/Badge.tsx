'use client';

interface BadgeProps {
  variant: 'bunz' | 'rating' | 'distance' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

const variants = {
  bunz: 'bg-[#E91E63]/10 text-[#E91E63]',
  rating: 'bg-gray-50 text-gray-600 border border-gray-100',
  distance: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-orange-50 text-orange-600',
  error: 'bg-red-50 text-red-600',
};

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
