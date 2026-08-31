import React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  valueDisplay?: string | number;
}

export const Slider: React.FC<SliderProps> = ({
  className,
  label,
  valueDisplay,
  id,
  min = 0,
  max = 100,
  step = 1,
  value,
  ...props
}) => {
  const sliderId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs">
        {label && (
          <label htmlFor={sliderId} className="font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </label>
        )}
        {valueDisplay !== undefined && (
          <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
            {valueDisplay}
          </span>
        )}
      </div>
      <input
        type="range"
        id={sliderId}
        min={min}
        max={max}
        step={step}
        value={value}
        className={cn(
          'w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/40',
          className
        )}
        {...props}
      />
    </div>
  );
};
