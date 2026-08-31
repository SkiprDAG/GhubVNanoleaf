import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Zap, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

export interface DeviceStateBadgeProps {
  charging: boolean;
  critical: boolean;
  fullyCharged?: boolean;
  isMapped?: boolean;
  className?: string;
}

export const DeviceStateBadge: React.FC<DeviceStateBadgeProps> = ({
  charging,
  critical,
  fullyCharged,
  isMapped = true,
  className,
}) => {
  if (!isMapped) {
    return (
      <Badge variant="outline" className={className}>
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
        <span>No Mapping</span>
      </Badge>
    );
  }

  if (charging && fullyCharged) {
    return (
      <Badge variant="success" className={className}>
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>Full Charged</span>
      </Badge>
    );
  }

  if (charging) {
    return (
      <Badge variant="info" className={className}>
        <Zap className="w-3 h-3 text-sky-400 animate-pulse fill-sky-400/20" />
        <span>Charging</span>
      </Badge>
    );
  }

  if (critical) {
    return (
      <Badge variant="danger" dot className={className}>
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        <span>Critical</span>
      </Badge>
    );
  }

  return (
    <Badge variant="default" dot className={className}>
      <ShieldCheck className="w-3 h-3 text-emerald-400" />
      <span>Normal</span>
    </Badge>
  );
};
