import React, { useState } from 'react';
import { AppConfig, DeviceMappingConfig, DeviceMappingCreatePayload } from '@/api/types';
import { DeviceGroupCard } from '@/components/devices/DeviceGroupCard';
import { AddGroupDialog } from '@/components/devices/AddGroupDialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Plus, Layers } from 'lucide-react';

export interface DevicesPageProps {
  config?: AppConfig;
  isLoading: boolean;
  onSaveMapping: (payload: DeviceMappingCreatePayload) => Promise<unknown>;
  onDeleteMapping: (match: string) => Promise<unknown>;
  isSaving: boolean;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  config,
  isLoading,
  onSaveMapping,
  onDeleteMapping,
  isSaving,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const mappings = config?.mapping?.devices || [];

  const handleSaveItem = async (updated: DeviceMappingConfig) => {
    await onSaveMapping(updated);
  };

  const handleDeleteItem = async (match: string) => {
    await onDeleteMapping(match);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Device Layout &amp; Panel Mapping</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure how Logitech device names map to specific Nanoleaf panel IDs and RGB base colors
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0"
        >
          Add Layout Group
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : mappings.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto text-muted-foreground">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-foreground">No Layout Groups Configured</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your first device group mapping to assign Nanoleaf panels to Logitech headsets, keyboards, or mice.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mappings.map((mapping) => (
            <DeviceGroupCard
              key={mapping.match}
              mapping={mapping}
              onSave={handleSaveItem}
              onDelete={handleDeleteItem}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}

      <AddGroupDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={async (newGroup) => {
          await onSaveMapping(newGroup);
        }}
        isLoading={isSaving}
      />
    </div>
  );
};
