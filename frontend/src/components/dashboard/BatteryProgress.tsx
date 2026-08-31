import React from 'react';
import { cn, clamp } from '@/lib/utils';
import { Zap, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface BatteryProgressProps {
  percentage: number;
  charging: boolean;
  critical: boolean;
  fullyCharged?: boolean;
  accentColor?: string; // CSS color string (e.g. rgb(213, 0, 255))
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BatteryProgress: React.FC<BatteryProgressProps> = ({
  percentage,
  charging,
  critical,
  fullyCharged,
  accentColor,
  size = 'md',
  className,
}) => {
  const clampedPct = clamp(percentage, 0, 100);

  // Color logic
  const getFillColor = () => {
    if (critical) return '#ef4444'; // Red
    if (charging && fullyCharged) return '#10b981'; // Emerald
    if (charging) return '#3b82f6'; // Blue
    if (clampedPct <= 20) return '#f59e0b'; // Amber
    return accentColor || '#10b981'; // Device accent or emerald
  };

  const fillColor = getFillColor();

  // Circular progress calculations
  const strokeWidth = size === 'lg' ? 8 : size === 'sm' ? 4 : 6;
  const radius = size === 'lg' ? 42 : size === 'sm' ? 24 : 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;
  const dimension = (radius + strokeWidth) * 2;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={dimension}
        height={dimension}
        className="transform -rotate-90 origin-center"
      >
        {/* Background track */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-secondary/80"
        />

        {/* Progress indicator */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className={cn(
            'transition-all duration-700 ease-out',
            charging && 'animate-battery-pulse'
          )}
          style={{
            filter: critical
              ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))'
              : charging
              ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))'
              : undefined,
          }}
        />
      </svg>

      {/* Center readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <div className="flex items-center gap-0.5 font-mono font-bold leading-none">
          <span
            className={cn(
              size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-lg',
              critical ? 'text-rose-400' : 'text-foreground'
            )}
          >
            {clampedPct}
          </span>
          <span className="text-[10px] text-muted-foreground font-normal">%</span>
        </div>

        {charging && (
          <div className="flex items-center gap-0.5 text-[10px] font-semibold text-primary mt-0.5">
            {fullyCharged ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <Zap className="w-3 h-3 animate-pulse text-primary fill-primary/30" />
            )}
          </div>
        )}

        {!charging && critical && (
          <AlertCircle className="w-3 h-3 text-rose-400 mt-0.5 animate-bounce" />
        )}
      </div>
    </div>
  );
};
