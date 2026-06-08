'use client';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'pink';
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
  const baseStyles = 'font-medium rounded-xl transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 select-none';
  
  const variants = {
    primary: 'bg-[#111111] text-white hover:bg-neutral-900 border border-transparent',
    secondary: 'bg-white text-[#111111] border border-[#E0E0E0] hover:bg-neutral-50 focus:border-[#111111]',
    pink: 'bg-[#E91E63] text-white hover:bg-[#C2185B] border border-transparent shadow-sm shadow-[#E91E63]/10',
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
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}
