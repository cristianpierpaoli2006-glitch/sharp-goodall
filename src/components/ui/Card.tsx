import React from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
    const variants = {
      default:  'bg-surface-100 border border-surface-300/50',
      elevated: 'bg-surface-100 border border-surface-300/30 shadow-xl shadow-black/20',
      glass:    'bg-surface-100/60 backdrop-blur-xl border border-white/10',
      outlined: 'bg-transparent border border-surface-300/60',
    };

    const paddings = {
      none: '',
      sm:   'p-3',
      md:   'p-4',
      lg:   'p-5',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-3xl', variants[variant], paddings[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
