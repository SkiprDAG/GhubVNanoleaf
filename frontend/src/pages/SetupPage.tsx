import React, { useState } from 'react';
import { useSetupWizard } from '@/hooks/useSetupWizard';
import { DiscoveredDeviceItem, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { NanoleafWallVisualizer } from '@/components/visualizer/NanoleafWallVisualizer';
import {
  Wand2,
  Headphones,
  Keyboard,
  Mouse,
  Tv,
  Check,
  Zap,
  Play,
  Square,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  RotateCcw,
  Sparkles,
  LayoutGrid,
  Map as MapIcon,
} from 'lucide-react';
import { rgbToCss, rgbToHex, cn } from '@/lib/utils';


export interface SetupPageProps {
  onFinish?: () => void;
}


export const SetupPage: React.FC<SetupPageProps> = ({ onFinish }) => {
  const {
    devices,
    isLoadingDevices,
    refetchDevices,
    panels,
    isLoadingPanels,
    refetchPanels,
    session,
    identifyingPanelId,
    identifyPanel,
    startCycle,


    isStartingCycle,
    stopCycle,
    isStoppingCycle,
    previewGroup,
    isPreviewing,
    clearPreview,
    isClearingPreview,
    saveMapping,
    isSavingMapping,
  } = useSetupWizard();

  // Wizard Step: 1 = Select Device, 2 = Identify Panels, 3 = Config Group, 4 = Confirm
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [panelViewMode, setPanelViewMode] = useState<'wall' | 'grid'>('wall');

  // Draft State
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDeviceItem | null>(null);
  const [draftLabel, setDraftLabel] = useState<string>('');
  const [draftMatch, setDraftMatch] = useState<string>('');
  const [draftBaseColor, setDraftBaseColor] = useState<RGBColor>([0, 213, 255]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [testColor] = useState<RGBColor>([255, 255, 255]);
  const [validationError, setValidationError] = useState<string | null>(null);



  // Auto-fill draft when device is selected
  const handleSelectDevice = (dev: DiscoveredDeviceItem) => {
    setSelectedDevice(dev);
    setValidationError(null);

    // Heuristics for label and match
    let suggestedMatch = dev.name;
    let suggestedLabel = 'device';

    if (dev.name.includes('PRO X')) {
      suggestedMatch = 'PRO X';
      suggestedLabel = 'headset';
    } else if (dev.name.includes('G915')) {
      suggestedMatch = 'G915';
      suggestedLabel = 'keyboard';
    } else if (dev.name.includes('G502')) {
      suggestedMatch = 'G502';
      suggestedLabel = 'mouse';
    } else if (dev.name.includes('G733')) {
      suggestedMatch = 'G733';
      suggestedLabel = 'headset';
    } else if (dev.name.includes('G305') || dev.name.includes('PRO Wireless')) {
      suggestedMatch = dev.name.split(' ')[0];
      suggestedLabel = 'mouse';
    }

    if (dev.is_mapped) {
      setDraftLabel(dev.mapped_label || suggestedLabel);
      setDraftMatch(dev.mapped_match || suggestedMatch);
      if (dev.mapped_base_color) {
        setDraftBaseColor(dev.mapped_base_color);
      }
      setSelectedPanelIds(dev.mapped_panel_ids || []);
    } else {
      setDraftLabel(suggestedLabel);
      setDraftMatch(suggestedMatch);
      setSelectedPanelIds([]);
    }
  };

  const handleTogglePanel = (panelId: number) => {
    if (selectedPanelIds.includes(panelId)) {
      setSelectedPanelIds(selectedPanelIds.filter((id) => id !== panelId));
    } else {
      setSelectedPanelIds([...selectedPanelIds, panelId]);
    }
  };

  const handleMovePanel = (index: number, direction: 'up' | 'down') => {
    const next = [...selectedPanelIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) return;

    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setSelectedPanelIds(next);
  };

  const handleRemovePanel = (panelId: number) => {
    setSelectedPanelIds(selectedPanelIds.filter((id) => id !== panelId));
  };

  const handleIdentifySingle = async (panelId: number) => {
    try {
      await identifyPanel({ panelId, color: testColor, duration_ms: 1500 });
    } catch {
      // Toast handles error
    }
  };

  const handleToggleCycle = async () => {
    if (session?.cycle_running) {
      await stopCycle();
    } else {
      const targetPanels = panels.map((p) => p.panel_id);
      await startCycle({ panelIds: targetPanels, color: testColor, step_duration_ms: 1000, repeat: true });
    }
  };

  const handlePreviewSelected = async () => {
    if (selectedPanelIds.length === 0) return;
    await previewGroup({ panelIds: selectedPanelIds, color: draftBaseColor });
  };

  const handleSave = async () => {
    setValidationError(null);
    if (!draftLabel.trim()) {
      setValidationError('Group label is required.');
      return;
    }
    if (!draftMatch.trim()) {
      setValidationError('Device match pattern is required.');
      return;
    }
    if (selectedPanelIds.length === 0) {
      setValidationError('Please select at least one Nanoleaf panel.');
      return;
    }

    try {
      await saveMapping({
        label: draftLabel.trim(),
        match: draftMatch.trim(),
        panel_ids: selectedPanelIds,
        base_color: draftBaseColor,
      });

      if (onFinish) {
        onFinish();
      }
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save mapping');
    }
  };

  const getDeviceIcon = (type: string, name: string) => {
    const t = (type || '').toUpperCase();
    const n = (name || '').toLowerCase();
    if (t === 'HEADSET' || n.includes('headset') || n.includes('pro x')) {
      return <Headphones className="w-5 h-5 text-indigo-400" />;
    }
    if (t === 'KEYBOARD' || n.includes('keyboard') || n.includes('g915') || n.includes('g513')) {
      return <Keyboard className="w-5 h-5 text-amber-400" />;
    }
    if (t === 'MOUSE' || n.includes('mouse') || n.includes('g502') || n.includes('pro wireless')) {
      return <Mouse className="w-5 h-5 text-cyan-400" />;
    }
    return <Tv className="w-5 h-5 text-slate-400" />;
  };

  // Check conflicts for selected panels
  const conflictingPanels = selectedPanelIds
    .map((pid) => panels.find((p) => p.panel_id === pid))
    .filter((p) => p && p.is_assigned && p.assigned_group_match?.toLowerCase() !== draftMatch.toLowerCase());

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Wizard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Wand2 className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-foreground">Setup &amp; Mapping Wizard</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover Logitech devices, flash physical Nanoleaf panels, and configure groups with live preview
          </p>
        </div>

        {/* Step Indicator Bar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-secondary/50 border border-border/60 self-start">
          {[
            { step: 1, label: 'Device' },
            { step: 2, label: 'Panels' },
            { step: 3, label: 'Config' },
            { step: 4, label: 'Confirm' },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => {
                if (item.step < currentStep || (item.step === 2 && selectedDevice)) {
                  setCurrentStep(item.step as 1 | 2 | 3 | 4);
                }
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                currentStep === item.step
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                  : currentStep > item.step
                  ? 'bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer'
                  : 'text-muted-foreground opacity-60 cursor-not-allowed'
              )}
            >
              <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
                {currentStep > item.step ? <Check className="w-2.5 h-2.5" /> : item.step}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: Select Logitech Device */}
      {currentStep === 1 && (
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Step 1: Choose Logitech G HUB Device</CardTitle>
            <CardDescription>
              Select an actively discovered peripheral to create or edit its Nanoleaf illumination mapping
            </CardDescription>
          </CardHeader>

          {isLoadingDevices ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-secondary/20 space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="text-sm font-semibold text-foreground">No Devices Discovered</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Make sure Logitech G HUB is running in the background and connected to the local WebSocket server.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchDevices()} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
                Refresh Devices
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((dev) => {
                const isSelected = selectedDevice?.device_id === dev.device_id;
                return (
                  <div
                    key={dev.device_id}
                    onClick={() => handleSelectDevice(dev)}
                    className={cn(
                      'relative p-4 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-3 select-none',
                      isSelected
                        ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md'
                        : 'bg-secondary/40 border-border/70 hover:border-border hover:bg-secondary/60'
                    )}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="p-2 rounded-xl bg-secondary border border-border">
                          {getDeviceIcon(dev.device_type, dev.name)}
                        </div>

                        {dev.is_mapped ? (
                          <Badge variant="success" className="text-[10px]">
                            Mapped ({dev.mapped_label})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Unmapped
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-foreground line-clamp-1">{dev.name}</h4>
                        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          ID: {dev.device_id}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Battery:</span>
                      <span className="font-semibold text-foreground">
                        {dev.has_battery && dev.battery ? `${dev.battery.percentage}%` : 'N/A (Wired)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <Button variant="ghost" size="sm" onClick={() => refetchDevices()} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
              Refresh G HUB Devices
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={!selectedDevice}
              onClick={() => setCurrentStep(2)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Proceed to Panel Selection
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Identify Panels & Assign */}
      {currentStep === 2 && (
        <Card className="space-y-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Step 2: Identify &amp; Select Nanoleaf Panels</CardTitle>
                <CardDescription>
                  Flash panels to identify them physically on your wall, then add them in left-to-right or charging sequence
                </CardDescription>
              </div>

              {/* Identification Tools */}
              <div className="flex items-center gap-2 self-start">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchPanels()}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Refresh Panels
                </Button>

                <Button
                  variant={session?.cycle_running ? 'danger' : 'outline'}
                  size="sm"
                  onClick={handleToggleCycle}
                  isLoading={isStartingCycle || isStoppingCycle}
                  leftIcon={session?.cycle_running ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                >
                  {session?.cycle_running ? 'Stop Auto-Walk' : 'Auto-Walk All Panels'}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Panels Selection Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Discovered Panels ({panels.length} total)</span>
              
              {/* View Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/60 border border-border/80">
                <button
                  type="button"
                  onClick={() => setPanelViewMode('wall')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                    panelViewMode === 'wall'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Wall Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelViewMode('grid')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                    panelViewMode === 'grid'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid Cards</span>
                </button>
              </div>
            </div>

            {isLoadingPanels ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : panels.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-border bg-secondary/20">
                <p className="text-xs text-muted-foreground">No Nanoleaf panels discovered. Check controller IP.</p>
              </div>
            ) : panelViewMode === 'wall' ? (
              <NanoleafWallVisualizer
                panels={panels}
                selectedPanelIds={selectedPanelIds}
                onTogglePanel={handleTogglePanel}
                onIdentifyPanel={handleIdentifySingle}
                identifyingPanelId={identifyingPanelId}
                mode="interactive"
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {panels.map((p) => {
                  const isSelected = selectedPanelIds.includes(p.panel_id);
                  const selectedIndex = selectedPanelIds.indexOf(p.panel_id);
                  const isIdentifyingThis = identifyingPanelId === p.panel_id;


                  return (
                    <div
                      key={p.panel_id}
                      onClick={() => handleTogglePanel(p.panel_id)}
                      className={cn(
                        'relative p-3 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-2 select-none',
                        isIdentifyingThis
                          ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 animate-pulse'
                          : isSelected
                          ? 'bg-primary/20 border-primary ring-2 ring-primary/30'
                          : 'bg-secondary/40 border-border/70 hover:border-border hover:bg-secondary/60'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-foreground">#{p.panel_id}</span>
                        {isSelected ? (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                            {selectedIndex + 1}
                          </span>
                        ) : p.is_assigned ? (
                          <span className="text-[9px] font-semibold text-muted-foreground truncate max-w-[60px]">
                            {p.assigned_group_label}
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        )}
                      </div>

                      <div className="pt-1 border-t border-border/30 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIdentifySingle(p.panel_id);
                          }}
                          className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Flash</span>
                        </button>

                        <span className="text-[10px] text-muted-foreground">
                          {isSelected ? 'Remove' : '+ Add'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Ordered Selected Panels Bar */}
          {selectedPanelIds.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/70">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Assigned Sequence ({selectedPanelIds.length} panels)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Panels light up sequentially from left (low charge) to right (full charge)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (session?.preview_active) {
                        clearPreview();
                      } else {
                        handlePreviewSelected();
                      }
                    }}
                    isLoading={isPreviewing || isClearingPreview}
                    leftIcon={session?.preview_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    {session?.preview_active ? 'Clear Preview' : 'Preview on Panels'}
                  </Button>
                </div>
              </div>


              {/* Panel Order Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedPanelIds.map((pid, idx) => (
                  <div
                    key={pid}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/90 border border-border font-mono text-xs shadow-sm"
                  >
                    <span className="text-muted-foreground text-[10px]">#{idx + 1}</span>
                    <span className="font-bold text-foreground">Panel {pid}</span>

                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMovePanel(idx, 'up')}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                        title="Move earlier"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === selectedPanelIds.length - 1}
                        onClick={() => handleMovePanel(idx, 'down')}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                        title="Move later"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePanel(pid)}
                        className="p-0.5 text-muted-foreground hover:text-rose-400 rounded ml-1"
                        title="Remove panel"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(1)}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Devices
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={selectedPanelIds.length === 0}
              onClick={() => setCurrentStep(3)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Next: Configure Group ({selectedPanelIds.length} panels)
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Configure Group Details */}
      {currentStep === 3 && (
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Step 3: Configure Device Group &amp; Base Color</CardTitle>
            <CardDescription>
              Assign a human-readable label, fine-tune the G HUB matching substring, and set the group base color
            </CardDescription>
          </CardHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input
                label="Group Label (e.g. Headset, Keyboard, Mouse)"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="e.g. Headset"
              />

              <Input
                label="Name Match Substring"
                value={draftMatch}
                onChange={(e) => setDraftMatch(e.target.value)}
                placeholder="e.g. PRO X 2"
                helperText="Matches when Logitech G HUB device name contains this substring"
              />

              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 space-y-1.5 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Selected Peripheral</span>
                </div>
                <div>{selectedDevice?.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">ID: {selectedDevice?.device_id}</div>
              </div>
            </div>

            <div className="space-y-4">
              <ColorPickerField
                label="Group Base Illumination Color"
                color={draftBaseColor}
                onChange={setDraftBaseColor}
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(2)}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Panels
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={!draftLabel.trim() || !draftMatch.trim()}
              onClick={() => setCurrentStep(4)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Next: Review &amp; Confirm
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Confirm & Save */}
      {currentStep === 4 && (
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Step 4: Review &amp; Save Mapping</CardTitle>
            <CardDescription>
              Review all mapping details before committing changes atomically to the controller configuration
            </CardDescription>
          </CardHeader>

          {/* Review Card */}
          <div className="p-5 rounded-2xl bg-secondary/30 border border-border/70 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Target Device</span>
                <div className="text-sm font-bold text-foreground mt-0.5 truncate">{selectedDevice?.name}</div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Match Substring</span>
                <div className="text-sm font-mono font-semibold text-foreground mt-0.5">"{draftMatch}"</div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Group Label</span>
                <div className="text-sm font-bold text-foreground mt-0.5">{draftLabel}</div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Base Color</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="w-4 h-4 rounded border border-white/20"
                    style={{ backgroundColor: rgbToCss(draftBaseColor) }}
                  />
                  <span className="font-mono text-xs font-semibold">{rgbToHex(draftBaseColor)}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/40">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                Assigned Panel Sequence ({selectedPanelIds.length} panels)
              </span>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 font-mono text-xs">
                {selectedPanelIds.map((pid, idx) => (
                  <span key={pid} className="px-2 py-1 rounded bg-secondary border border-border/60">
                    #{idx + 1}: {pid}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Conflict Warning */}
          {conflictingPanels.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Panel Assignment Conflict Detected</div>
                <p className="mt-0.5 opacity-90">
                  Panel(s) {conflictingPanels.map((p) => `#${p?.panel_id}`).join(', ')} are currently assigned to another
                  group. Saving will reassign them to "{draftLabel}".
                </p>
              </div>
            </div>
          )}

          {validationError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              {validationError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(3)}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Config
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewSelected}
                isLoading={isPreviewing}
                leftIcon={<Eye className="w-3.5 h-3.5" />}
              >
                Test Preview
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={isSavingMapping}
                leftIcon={<Save className="w-3.5 h-3.5" />}
                className="font-bold shadow-md shadow-primary/20"
              >
                Save &amp; Apply Mapping
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
