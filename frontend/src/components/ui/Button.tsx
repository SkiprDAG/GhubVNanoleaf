import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 border border-primary/40',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
      outline:
        'border border-border/80 bg-background/50 hover:bg-secondary/60 text-foreground backdrop-blur-sm',
      danger:
        'bg-rose-600/90 text-white hover:bg-rose-600 shadow-lg shadow-rose-600/20 border border-rose-500/40',
      ghost:
        'hover:bg-secondary/60 text-muted-foreground hover:text-foreground',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5 min-h-[36px]',
      md: 'h-10 px-4 text-sm gap-2 min-h-[44px]',
      lg: 'h-12 px-6 text-base gap-2.5 min-h-[48px]',
      icon: 'h-10 w-10 min-h-[44px] min-w-[44px] p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
