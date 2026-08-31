import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glowColor, style, children, ...props }, ref) => {
    const combinedStyle = glowColor
      ? ({
          ...style,
          '--device-glow-color': glowColor,
        } as React.CSSProperties)
      : style;

    return (
      <div
        ref={ref}
        style={combinedStyle}
        className={cn(
          'glass-card rounded-2xl p-5 transition-all duration-200',
          glowColor && 'device-glow',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('flex items-center justify-between gap-3 mb-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3 className={cn('text-base font-semibold text-foreground tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => (
  <p className={cn('text-xs text-muted-foreground', className)} {...props}>
    {children}
  </p>
);
