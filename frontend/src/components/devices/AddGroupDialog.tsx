import React, { useState } from 'react';
import { DeviceMappingCreatePayload, RGBColor } from '@/api/types';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ColorPickerField } from './ColorPickerField';
import { Plus } from 'lucide-react';

export interface AddGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newGroup: DeviceMappingCreatePayload) => Promise<void>;
  isLoading?: boolean;
}

export const AddGroupDialog: React.FC<AddGroupDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  isLoading = false,
}) => {
  const [match, setMatch] = useState('');
  const [label, setLabel] = useState('');
  const [panelIdsInput, setPanelIdsInput] = useState('');
  const [baseColor, setBaseColor] = useState<RGBColor>([0, 200, 255]);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setMatch('');
    setLabel('');
    setPanelIdsInput('');
    setBaseColor([0, 200, 255]);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!match.trim()) {
      setError('Match filter is required (e.g. G733, PRO X 2).');
      return;
    }
    if (!label.trim()) {
      setError('Label is required (e.g. secondary_headset).');
      return;
    }

    const parsedIds = panelIdsInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s));

    if (parsedIds.some((n) => isNaN(n) || n < 0)) {
      setError('Panel IDs must be positive integers separated by commas.');
      return;
    }

    try {
      await onAdd({
        match: match.trim(),
        label: label.trim(),
        panel_ids: parsedIds,
        base_color: baseColor,
      });
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add device group');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Device Layout Group"
      description="Map a Logitech device substring to specific Nanoleaf panels and a base color"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Device Match Substring"
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            placeholder="e.g. G733, PRO X 2, G915"
            required
          />

          <Input
            label="Group Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. headset, desk_strip"
            required
          />
        </div>

        <Input
          label="Nanoleaf Panel IDs"
          value={panelIdsInput}
          onChange={(e) => setPanelIdsInput(e.target.value)}
          placeholder="e.g. 101, 102, 103"
          helperText="Comma-separated IDs of the panels assigned to this device"
        />

        <ColorPickerField
          label="Base Lighting Color"
          color={baseColor}
          onChange={setBaseColor}
        />

        {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Group
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
