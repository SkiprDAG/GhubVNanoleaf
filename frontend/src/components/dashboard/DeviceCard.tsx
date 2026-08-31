import React from 'react';
import { DeviceStatus, DeviceMappingConfig } from '@/api/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { BatteryProgress } from './BatteryProgress';
import { DeviceStateBadge } from './DeviceStateBadge';
import { rgbToCss, rgbToHex } from '@/lib/utils';
import { Headphones, Keyboard, Mouse, Laptop, Layers } from 'lucide-react';

export interface DeviceCardProps {
  device: DeviceStatus;
  mapping?: DeviceMappingConfig;
  className?: string;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, mapping, className }) => {
  const getDeviceIcon = (name: string, label = '') => {
    const combined = `${name} ${label}`.toLowerCase();
    if (combined.includes('headset') || combined.includes('pro x') || combined.includes('g733')) {
      return <Headphones className="w-4 h-4 text-purple-400" />;
    }
    if (combined.includes('keyboard') || combined.includes('g915') || combined.includes('g512')) {
      return <Keyboard className="w-4 h-4 text-cyan-400" />;
    }
    if (combined.includes('mouse') || combined.includes('g502') || combined.includes('g305') || combined.includes('superlight')) {
      return <Mouse className="w-4 h-4 text-pink-400" />;
    }
    return <Laptop className="w-4 h-4 text-primary" />;
  };

  const baseColorCss = mapping ? rgbToCss(mapping.base_color, 1) : undefined;
  const glowColorCss = mapping ? rgbToCss(mapping.base_color, 0.25) : undefined;
  const hexColor = mapping ? rgbToHex(mapping.base_color) : '#ffffff';

  return (
    <Card glowColor={glowColorCss} className={className}>
      <CardHeader>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-secondary/80 border border-border/60 shrink-0">
            {getDeviceIcon(device.name, mapping?.label)}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-foreground truncate" title={device.name}>
              {device.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="capitalize">{mapping?.label || 'Unassigned'}</span>
              {mapping && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[10px] text-primary/90 font-medium">
                    match: &quot;{mapping.match}&quot;
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <DeviceStateBadge
          charging={device.charging}
          critical={device.critical}
          fullyCharged={device.fully_charged}
          isMapped={Boolean(mapping)}
        />
      </CardHeader>

      <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-border/40">
        {/* Battery Circle */}
        <div className="flex items-center gap-3">
          <BatteryProgress
            percentage={device.percentage}
            charging={device.charging}
            critical={device.critical}
            fullyCharged={device.fully_charged}
            accentColor={baseColorCss}
            size="md"
          />
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-foreground">Battery Level</div>
            <div className="text-[11px] text-muted-foreground">
              {device.charging ? 'Charging via USB' : 'On Battery Power'}
            </div>
            {device.mileage > 0 && (
              <div className="text-[10px] text-muted-foreground/75 font-mono">
                Mileage: {device.mileage}h
              </div>
            )}
          </div>
        </div>

        {/* Mapped Panel Color & Panels */}
        {mapping ? (
          <div className="flex flex-col items-end gap-1.5 text-right">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
                style={{ backgroundColor: baseColorCss }}
              />
              <span className="font-mono text-xs font-medium text-foreground uppercase">{hexColor}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span>{mapping.panel_ids.length} Panels</span>
            </div>

            <div className="text-[10px] font-mono text-muted-foreground/75 max-w-[120px] truncate" title={mapping.panel_ids.join(', ')}>
              IDs: [{mapping.panel_ids.join(', ')}]
            </div>
          </div>
        ) : (
          <div className="text-right text-[11px] text-amber-400/90 font-medium">
            Add mapping in Devices tab
          </div>
        )}
      </div>
    </Card>
  );
};
