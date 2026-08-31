import React from 'react';
import { RGBColor } from '@/api/types';
import { rgbToHex, hexToRgb, rgbToCss } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';
import { Pipette } from 'lucide-react';

export interface ColorPickerFieldProps {
  color: RGBColor;
  onChange: (newColor: RGBColor) => void;
  label?: string;
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  color,
  onChange,
  label = 'Base Color (RGB)',
}) => {
  const hex = rgbToHex(color);
  const cssColor = rgbToCss(color);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
      onChange(hexToRgb(val));
    }
  };

  const handleChannelChange = (channelIndex: 0 | 1 | 2, val: number) => {
    const next: RGBColor = [...color] as RGBColor;
    next[channelIndex] = Math.max(0, Math.min(255, Math.round(val)));
    onChange(next);
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/60">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </label>

        <div className="flex items-center gap-2">
          {/* Color Preview & Native Picker */}
          <label
            className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-white/20 shadow-md cursor-pointer hover:scale-105 transition-transform"
            style={{ backgroundColor: cssColor }}
            title="Click to open color palette"
          >
            <Pipette className="w-3.5 h-3.5 text-white/80 drop-shadow" />
            <input
              type="color"
              value={hex}
              onChange={(e) => onChange(hexToRgb(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>

          {/* Hex Input */}
          <input
            type="text"
            value={hex}
            onChange={handleHexChange}
            maxLength={7}
            className="w-24 h-8 px-2 rounded-lg bg-secondary border border-border text-xs font-mono font-bold text-center text-foreground uppercase focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Precise RGB Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <Slider
          label="Red"
          min={0}
          max={255}
          step={1}
          value={color[0]}
          valueDisplay={color[0]}
          onChange={(e) => handleChannelChange(0, Number(e.target.value))}
          className="accent-rose-500"
        />
        <Slider
          label="Green"
          min={0}
          max={255}
          step={1}
          value={color[1]}
          valueDisplay={color[1]}
          onChange={(e) => handleChannelChange(1, Number(e.target.value))}
          className="accent-emerald-500"
        />
        <Slider
          label="Blue"
          min={0}
          max={255}
          step={1}
          value={color[2]}
          valueDisplay={color[2]}
          onChange={(e) => handleChannelChange(2, Number(e.target.value))}
          className="accent-sky-500"
        />
      </div>
    </div>
  );
};
