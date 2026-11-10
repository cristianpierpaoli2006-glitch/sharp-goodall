import React from 'react';
import { cn } from '@/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, fullWidth = false, className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-2xl transition-all duration-200 active:scale-95 select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent';

    const variants = {
      primary:   'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white focus:ring-brand-400 shadow-lg shadow-brand-500/25',
      secondary: 'bg-surface-200 hover:bg-surface-300 text-slate-200 focus:ring-slate-500 dark:bg-surface-200 dark:text-slate-200',
      ghost:     'bg-transparent hover:bg-surface-200 text-slate-300 focus:ring-slate-500',
      danger:    'bg-red-500/20 hover:bg-red-500/30 text-red-400 focus:ring-red-500 border border-red-500/30',
      success:   'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 focus:ring-emerald-500',
    };

    const sizes = {
      sm:   'text-sm px-3 py-1.5',
      md:   'text-sm px-4 py-2.5',
      lg:   'text-base px-6 py-3.5',
      icon: 'p-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
