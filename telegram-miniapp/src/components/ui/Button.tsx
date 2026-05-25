'use client';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export default function Button({ 
  variant = 'primary', 
  size = 'md',
  isLoading,
  fullWidth,
  children,
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-md transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-[#111111] text-white hover:bg-[#333333]',
    secondary: 'bg-white text-[#111111] border border-gray-200 hover:bg-gray-50',
    ghost: 'bg-transparent text-[#E91E63] hover:bg-[#E91E63]/5',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-[15px]',
    lg: 'px-8 py-4 text-base',
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}
