import React, { useState, useEffect } from 'react';
import { DeviceMappingConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ColorPickerField } from './ColorPickerField';
import { rgbToCss } from '@/lib/utils';
import { Layers, Save, RotateCcw, Trash2, Check } from 'lucide-react';

export interface DeviceGroupCardProps {
  mapping: DeviceMappingConfig;
  onSave: (updated: DeviceMappingConfig) => Promise<void>;
  onDelete?: (match: string) => Promise<void>;
  isSaving?: boolean;
}

export const DeviceGroupCard: React.FC<DeviceGroupCardProps> = ({
  mapping,
  onSave,
  onDelete,
  isSaving = false,
}) => {
  const [match, setMatch] = useState(mapping.match);
  const [label, setLabel] = useState(mapping.label);
  const [panelIdsInput, setPanelIdsInput] = useState(mapping.panel_ids.join(', '));
  const [baseColor, setBaseColor] = useState<RGBColor>(mapping.base_color);
  const [error, setError] = useState<string | null>(null);
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  useEffect(() => {
    setMatch(mapping.match);
    setLabel(mapping.label);
    setPanelIdsInput(mapping.panel_ids.join(', '));
    setBaseColor(mapping.base_color);
  }, [mapping]);

  // Check if modified
  const isDirty =
    match !== mapping.match ||
    label !== mapping.label ||
    panelIdsInput !== mapping.panel_ids.join(', ') ||
    baseColor[0] !== mapping.base_color[0] ||
    baseColor[1] !== mapping.base_color[1] ||
    baseColor[2] !== mapping.base_color[2];

  const handleReset = () => {
    setMatch(mapping.match);
    setLabel(mapping.label);
    setPanelIdsInput(mapping.panel_ids.join(', '));
    setBaseColor(mapping.base_color);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!match.trim()) {
      setError('Device match substring cannot be empty.');
      return;
    }
    if (!label.trim()) {
      setError('Label cannot be empty.');
      return;
    }

    // Parse panel IDs
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
      await onSave({
        match: match.trim(),
        label: label.trim(),
        panel_ids: parsedIds,
        base_color: baseColor,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping');
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete group mapping for "${mapping.label}"?`)) {
      if (onDelete) {
        await onDelete(mapping.match);
      }
    }
  };

  const glowColor = rgbToCss(baseColor, 0.2);

  return (
    <Card glowColor={glowColor} className="space-y-4">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-secondary/80 text-primary border border-border">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="capitalize">{label || 'Unnamed Group'}</CardTitle>
            <div className="text-xs text-muted-foreground font-mono">
              match: &quot;{mapping.match}&quot;
            </div>
          </div>
        </div>

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-rose-400"
            title="Delete this device group"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Device Match Filter"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          placeholder="e.g. PRO X 2, G915, G502"
          helperText="Substring matched against Logitech device name"
        />

        <Input
          label="Group Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. headset, keyboard, mouse"
          helperText="Human readable description"
        />
      </div>

      <Input
        label="Assigned Nanoleaf Panel IDs"
        value={panelIdsInput}
        onChange={(e) => setPanelIdsInput(e.target.value)}
        placeholder="e.g. 133, 13, 36, 132, 238, 105"
        helperText="Comma separated integer panel IDs"
      />

      <ColorPickerField
        label="Group Base Color"
        color={baseColor}
        onChange={setBaseColor}
      />

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
        {isDirty && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty && !isSavedRecently}
          isLoading={isSaving}
          leftIcon={
            isSavedRecently ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )
          }
          className={isSavedRecently ? 'bg-emerald-600 hover:bg-emerald-600' : undefined}
        >
          {isSavedRecently ? 'Applied' : isSaving ? 'Saving...' : 'Save & Apply'}
        </Button>
      </div>
    </Card>
  );
};
