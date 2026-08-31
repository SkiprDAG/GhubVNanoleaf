import React, { useMemo, useState, useEffect } from 'react';
import { DiscoveredPanelItem, RGBColor, DeviceMappingConfig } from '@/api/types';
import { rgbToCss, cn } from '@/lib/utils';
import {
  Zap,
  Check,
  Sparkles,
  Headphones,
  Keyboard,
  Mouse,
  Tv,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

export interface NanoleafWallVisualizerProps {
  panels: DiscoveredPanelItem[];
  selectedPanelIds?: number[];
  onTogglePanel?: (panelId: number) => void;
  onIdentifyPanel?: (panelId: number) => void;
  identifyingPanelId?: number | null;
  panelColorsMap?: Record<number, RGBColor>;
  mappings?: DeviceMappingConfig[];
  mode?: 'interactive' | 'live';
  className?: string;
}

interface Vertex {
  x: number;
  y: number;
}

const STORAGE_KEY_ROTATION = 'nanoleaf_wall_rotation_deg';
const STORAGE_KEY_FLIP_H = 'nanoleaf_wall_flip_h';
const STORAGE_KEY_FLIP_V = 'nanoleaf_wall_flip_v';

export const NanoleafWallVisualizer: React.FC<NanoleafWallVisualizerProps> = ({
  panels,
  selectedPanelIds = [],
  onTogglePanel,
  onIdentifyPanel,
  identifyingPanelId,
  panelColorsMap = {},
  mappings = [],
  mode = 'live',
  className,
}) => {
  const [hoveredPanelId, setHoveredPanelId] = useState<number | null>(null);
  const [inspectedPanelId, setInspectedPanelId] = useState<number | null>(() => {
    return selectedPanelIds.length > 0 ? selectedPanelIds[0] : (panels.length > 0 ? panels[0].panel_id : null);
  });

  // Rotation and Flip controls persisted in localStorage (default to 300° which matches physical wall layout)
  const [rotationDeg, setRotationDeg] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROTATION);
    return saved !== null ? parseInt(saved, 10) : 300;
  });


  const [flipH, setFlipH] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_FLIP_H) === 'true';
  });

  const [flipV, setFlipV] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_FLIP_V) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ROTATION, rotationDeg.toString());
  }, [rotationDeg]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FLIP_H, flipH.toString());
  }, [flipH]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FLIP_V, flipV.toString());
  }, [flipV]);

  // Map panelId to assigned group info
  const panelGroupMap = useMemo(() => {
    const map: Record<number, { label: string; match: string; baseColor: RGBColor }> = {};
    for (const m of mappings) {
      for (const pid of m.panel_ids) {
        map[pid] = {
          label: m.label,
          match: m.match,
          baseColor: m.base_color,
        };
      }
    }
    return map;
  }, [mappings]);

  // If selectedPanelIds or panels change and inspected is invalid, adjust
  useEffect(() => {
    if (!inspectedPanelId && panels.length > 0) {
      setInspectedPanelId(panels[0].panel_id);
    }
  }, [panels, inspectedPanelId]);

  // Calculate polygon vertices for each panel based on exact Nanoleaf OpenAPI coordinate specifications
  const calculatedPanels = useMemo(() => {
    if (panels.length === 0) return [];

    // 1. Calculate centroid of all panels in the layout for rotation origin
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      const hasRealCoords = p.x !== undefined && (p.x !== 0 || p.y !== 0 || panels.length <= 1);
      sumX += hasRealCoords && p.x !== undefined ? p.x : (i % 6) * 130 + 100;
      sumY += hasRealCoords && p.y !== undefined ? p.y : Math.floor(i / 6) * 120 + 100;
    }
    const centroidX = sumX / panels.length;
    const centroidY = sumY / panels.length;

    const rotRad = (rotationDeg * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    // Transform function from raw Cartesian (where +Y is UP) to rotated SVG (where +Y is DOWN)
    const transformPoint = (rawX: number, rawY: number): Vertex => {
      let dx = rawX - centroidX;
      let dy = rawY - centroidY;
      if (flipH) dx = -dx;
      if (flipV) dy = -dy;

      const rotatedX = dx * cosR - dy * sinR + centroidX;
      const rotatedY = dx * sinR + dy * cosR + centroidY;

      return {
        x: rotatedX,
        y: -rotatedY, // Invert Y for SVG coordinates
      };
    };

    return panels.map((p, idx) => {
      const hasRealCoords = p.x !== undefined && (p.x !== 0 || p.y !== 0 || panels.length <= 1);
      const rawCx = hasRealCoords && p.x !== undefined ? p.x : (idx % 6) * 130 + 100;
      const rawCy = hasRealCoords && p.y !== undefined ? p.y : Math.floor(idx / 6) * 120 + 100;
      const orientDeg = p.orientation || 0;
      const side = p.side_length && p.side_length > 20 ? p.side_length : 150;
      const shapeType = p.shape_type !== undefined ? p.shape_type : 0;

      const rawVertices: Vertex[] = [];

      if (shapeType === 0 || shapeType === 8 || shapeType === 9) {
        // Shapes Triangle / Light Panels / Mini Triangle
        // In Nanoleaf Cartesian coords: centroid to vertex radius R = side / sqrt(3)
        // Orientation 0 deg points with apex upwards at angle 90 deg.
        const radius = (side / Math.sqrt(3)) * (shapeType === 9 ? 0.6 : 1.0);
        for (let k = 0; k < 3; k++) {
          const angDeg = orientDeg + 90 + k * 120;
          const angRad = (angDeg * Math.PI) / 180;
          rawVertices.push({
            x: rawCx + radius * Math.cos(angRad),
            y: rawCy + radius * Math.sin(angRad),
          });
        }
      } else if (shapeType === 7) {
        // Shapes Hexagon
        const radius = side;
        for (let k = 0; k < 6; k++) {
          const angDeg = orientDeg + 30 + k * 60;
          const angRad = (angDeg * Math.PI) / 180;
          rawVertices.push({
            x: rawCx + radius * Math.cos(angRad),
            y: rawCy + radius * Math.sin(angRad),
          });
        }
      } else if (shapeType === 14) {
        // Canvas Square
        const radius = side / Math.SQRT2;
        for (let k = 0; k < 4; k++) {
          const angDeg = orientDeg + 45 + k * 90;
          const angRad = (angDeg * Math.PI) / 180;
          rawVertices.push({
            x: rawCx + radius * Math.cos(angRad),
            y: rawCy + radius * Math.sin(angRad),
          });
        }
      } else {
        // Lines shapeType=12
        const halfL = side * 0.5;
        const halfW = 12;
        const oRad = (orientDeg * Math.PI) / 180;
        const cos = Math.cos(oRad);
        const sin = Math.sin(oRad);
        rawVertices.push(
          { x: rawCx - halfL * cos - halfW * sin, y: rawCy - halfL * sin + halfW * cos },
          { x: rawCx + halfL * cos - halfW * sin, y: rawCy + halfL * sin + halfW * cos },
          { x: rawCx + halfL * cos + halfW * sin, y: rawCy + halfL * sin - halfW * cos },
          { x: rawCx - halfL * cos + halfW * sin, y: rawCy - halfL * sin - halfW * cos }
        );
      }

      // Transform all vertices and centroid
      const svgVertices = rawVertices.map((v) => transformPoint(v.x, v.y));
      const svgCenter = transformPoint(rawCx, rawCy);

      return {
        panel: p,
        cx: svgCenter.x,
        cy: svgCenter.y,
        vertices: svgVertices,
        pointsString: svgVertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' '),
      };
    });
  }, [panels, rotationDeg, flipH, flipV]);

  // Compute adaptive SVG ViewBox with auto-padding
  const viewBox = useMemo(() => {
    if (calculatedPanels.length === 0) {
      return '0 0 800 400';
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const cp of calculatedPanels) {
      for (const v of cp.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    }

    const padding = 50;
    const width = Math.max(maxX - minX + padding * 2, 200);
    const height = Math.max(maxY - minY + padding * 2, 160);
    const x = minX - padding;
    const y = minY - padding;

    return `${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
  }, [calculatedPanels]);

  const getDeviceIcon = (label: string = '') => {
    const l = label.toLowerCase();
    if (l.includes('headset') || l.includes('pro x')) return <Headphones className="w-3.5 h-3.5" />;
    if (l.includes('keyboard') || l.includes('g915')) return <Keyboard className="w-3.5 h-3.5" />;
    if (l.includes('mouse') || l.includes('g502')) return <Mouse className="w-3.5 h-3.5" />;
    return <Tv className="w-3.5 h-3.5" />;
  };

  const activeInspectedId = inspectedPanelId;
  const inspectedItem = calculatedPanels.find((cp) => cp.panel.panel_id === activeInspectedId);

  const handleRotateCw = (step: number = 15) => {
    setRotationDeg((prev) => (prev + step) % 360);
  };

  const handleRotateCcw = (step: number = 15) => {
    setRotationDeg((prev) => (prev - step + 360) % 360);
  };

  const handleDirectAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    val = ((val % 360) + 360) % 360;
    setRotationDeg(val);
  };

  const [showAdvancedOrientation, setShowAdvancedOrientation] = useState<boolean>(false);

  return (
    <div className={cn('relative w-full rounded-2xl bg-secondary/30 border border-border/80 p-4 select-none flex flex-col justify-between gap-4', className)}>
      {/* Visualizer Top Bar */}
      <div className="flex flex-col gap-2.5 pb-3 border-b border-border/50 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="font-bold text-foreground">
              {mode === 'interactive' ? 'Interactive Wall Map' : 'Real-Time Nanoleaf Wall'}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">({panels.length} panels)</span>
          </div>

          {/* Quick Rotation & Orientation Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-background/90 border border-border shadow-sm">
              <button
                type="button"
                onClick={() => handleRotateCcw(15)}
                title="Rotate -15°"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Direct Angle Number Input */}
              <div className="flex items-center gap-0.5 px-1 bg-secondary/50 rounded border border-border/60">
                <input
                  type="number"
                  min="0"
                  max="359"
                  value={rotationDeg}
                  onChange={handleDirectAngleChange}
                  title="Enter exact rotation angle (0°–359°)"
                  className="w-10 bg-transparent text-center font-mono font-bold text-cyan-400 text-xs outline-none focus:text-foreground"
                />
                <span className="text-[10px] text-cyan-400 font-mono">°</span>
              </div>

              <button
                type="button"
                onClick={() => handleRotateCw(15)}
                title="Rotate +15°"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedOrientation((prev) => !prev)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-semibold border transition-all',
                  showAdvancedOrientation
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/60'
                )}
              >
                Adjust
              </button>
            </div>

            {/* Quick Flips */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-background/90 border border-border">
              <button
                type="button"
                onClick={() => setFlipH((prev) => !prev)}
                title="Flip Horizontally"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  flipH ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setFlipV((prev) => !prev)}
                title="Flip Vertically"
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  flipV ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                <FlipVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Smooth Slider & Preset Angles Toolbar */}
        {showAdvancedOrientation && (
          <div className="pt-2.5 mt-1 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Smooth 0..359 Range Slider */}
            <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 max-w-md">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">Angle:</span>
              <input
                type="range"
                min="0"
                max="359"
                step="1"
                value={rotationDeg}
                onChange={handleDirectAngleChange}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[11px] font-mono text-cyan-400 font-bold shrink-0 min-w-[32px]">
                {rotationDeg}°
              </span>
            </div>

            {/* Quick Angle Presets */}
            <div className="flex items-center gap-1 self-end sm:self-center">
              <span className="text-[10px] text-muted-foreground mr-1">Presets:</span>
              {[0, 60, 90, 180, 270, 300].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRotationDeg(preset)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors border',
                    rotationDeg === preset
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                      : 'text-muted-foreground hover:text-foreground border-border/60 hover:bg-secondary/60'
                  )}
                >
                  {preset}°
                </button>
              ))}
            </div>
          </div>
        )}
      </div>



      {/* SVG Canvas */}
      <div className="relative w-full flex items-center justify-center min-h-[260px] max-h-[460px] my-auto">
        <svg
          viewBox={viewBox}
          className="w-full h-full max-h-[420px] transition-all duration-300 overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Soft Glow filter */}
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pulsing Identify Ring */}
            <filter id="identify-pulse" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Render all panel polygons */}
          {calculatedPanels.map(({ panel, cx, cy, pointsString }) => {
            const pid = panel.panel_id;
            const isSelected = selectedPanelIds.includes(pid);
            const selectedIndex = selectedPanelIds.indexOf(pid);
            const isIdentifying = identifyingPanelId === pid;
            const isInspected = activeInspectedId === pid;
            const isHovered = hoveredPanelId === pid;
            const groupInfo = panelGroupMap[pid];

            // Resolve color: panelColorsMap (live frame) -> group baseColor -> default idle color
            const liveColor = panelColorsMap[pid];
            const isExplicitlyProvided = liveColor !== undefined;
            const isLit = liveColor && (liveColor[0] > 0 || liveColor[1] > 0 || liveColor[2] > 0);

            let fillColor = 'rgba(15, 20, 32, 0.9)';
            let strokeColor = 'rgba(60, 75, 105, 0.35)';
            let strokeWidth = 1.5;
            let filter = 'none';

            if (isIdentifying) {
              fillColor = 'rgb(255, 255, 255)';
              strokeColor = '#38bdf8';
              strokeWidth = 4;
              filter = 'url(#identify-pulse)';
            } else if (isExplicitlyProvided) {
              if (isLit) {
                fillColor = rgbToCss(liveColor);
                strokeColor = 'rgba(255, 255, 255, 0.65)';
                strokeWidth = 2.5;
                filter = 'url(#neon-glow)';
              } else {
                // Completely unlit / dark panel (empty charge section)
                fillColor = 'rgba(10, 14, 22, 0.95)';
                strokeColor = 'rgba(40, 50, 70, 0.3)';
                strokeWidth = 1;
                filter = 'none';
              }
            } else if (isSelected && mode === 'interactive') {
              fillColor = 'rgba(6, 182, 212, 0.4)';
              strokeColor = '#06b6d4';
              strokeWidth = 3;
              filter = 'url(#neon-glow)';
            } else if (groupInfo && mode === 'interactive') {
              fillColor = `rgba(${groupInfo.baseColor[0]}, ${groupInfo.baseColor[1]}, ${groupInfo.baseColor[2]}, 0.25)`;
              strokeColor = rgbToCss(groupInfo.baseColor);
              strokeWidth = 2;
            }


            if (isInspected) {
              strokeWidth = Math.max(strokeWidth + 2.5, 4.5);
              strokeColor = '#38bdf8';
            } else if (isHovered) {
              strokeWidth = Math.max(strokeWidth + 1, 3);
              strokeColor = 'rgba(56, 189, 248, 0.7)';
            }

            return (
              <g
                key={pid}
                className="cursor-pointer transition-all duration-150 group"
                onClick={() => {
                  setInspectedPanelId(pid);
                }}
                onMouseEnter={() => {
                  setHoveredPanelId(pid);
                }}
                onMouseLeave={() => setHoveredPanelId(null)}
              >

                {/* Main Polygon Shape */}
                <polygon
                  points={pointsString}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  filter={filter}
                  className={cn(
                    'transition-all duration-200',
                    isIdentifying && 'animate-pulse'
                  )}
                />

                {/* Center Badge: Sequence number or Panel ID */}
                <g transform={`translate(${cx}, ${cy})`}>
                  {isSelected && mode === 'interactive' ? (
                    <>
                      <circle r="15" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#000000"
                        fontSize="12"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {selectedIndex + 1}
                      </text>
                    </>
                  ) : (
                    <>
                      <circle
                        r="12"
                        fill={isInspected ? 'rgba(14, 165, 233, 0.3)' : 'rgba(10, 14, 23, 0.75)'}
                        stroke={isInspected ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={isInspected ? '#38bdf8' : '#cbd5e1'}
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {pid}
                      </text>
                    </>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Docked Inspector & Actions Toolbar (Always visible and clickable) */}
      <div className="w-full p-3 rounded-xl bg-background/90 backdrop-blur-md border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        {inspectedItem ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs shrink-0">
                Panel #{inspectedItem.panel.panel_id}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground truncate">
                  {panelGroupMap[inspectedItem.panel.panel_id] ? (
                    <>
                      {getDeviceIcon(panelGroupMap[inspectedItem.panel.panel_id].label)}
                      <span>Assigned: {panelGroupMap[inspectedItem.panel.panel_id].label}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground font-normal">Available (Unassigned)</span>
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground font-mono">
                  X: {inspectedItem.panel.x ?? '0'} | Y: {inspectedItem.panel.y ?? '0'} | Rot: {inspectedItem.panel.orientation ?? '0'}°
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {onIdentifyPanel && (
                <button
                  type="button"
                  onClick={() => onIdentifyPanel(inspectedItem.panel.panel_id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all',
                    identifyingPanelId === inspectedItem.panel.panel_id
                      ? 'bg-amber-500 text-black border-amber-400 font-bold animate-pulse'
                      : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{identifyingPanelId === inspectedItem.panel.panel_id ? 'Flashing...' : 'Flash Panel'}</span>
                </button>
              )}

              {mode === 'interactive' && onTogglePanel && (
                <button
                  type="button"
                  onClick={() => onTogglePanel(inspectedItem.panel.panel_id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all',
                    selectedPanelIds.includes(inspectedItem.panel.panel_id)
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary'
                  )}
                >
                  {selectedPanelIds.includes(inspectedItem.panel.panel_id) ? (
                    <span>Remove from group</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Add to group</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground py-1">
            💡 Click or hover over any panel on the map to inspect, flash or assign it.
          </div>
        )}
      </div>
    </div>
  );
};

