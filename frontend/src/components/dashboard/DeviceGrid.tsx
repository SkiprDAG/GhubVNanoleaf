import React from 'react';
import { DeviceStatus, DeviceMappingConfig } from '@/api/types';
import { DeviceCard } from './DeviceCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Laptop } from 'lucide-react';

export interface DeviceGridProps {
  devices?: DeviceStatus[];
  mappings?: DeviceMappingConfig[];
  isLoading?: boolean;
}

export const DeviceGrid: React.FC<DeviceGridProps> = ({
  devices = [],
  mappings = [],
  isLoading = false,
}) => {
  const findMappingForDevice = (deviceName: string): DeviceMappingConfig | undefined => {
    const nameLower = deviceName.toLowerCase();
    return mappings.find((m) => nameLower.includes(m.match.toLowerCase()));
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto text-muted-foreground">
          <Laptop className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-foreground">No Logitech Devices Detected</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Ensure Logitech G HUB is running in the background and devices are connected. The bridge listens to G HUB WebSocket events automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.device_id || device.name}
          device={device}
          mapping={findMappingForDevice(device.name)}
        />
      ))}
    </div>
  );
};
