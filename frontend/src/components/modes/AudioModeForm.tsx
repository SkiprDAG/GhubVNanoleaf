import React, { useState, useEffect, useRef } from 'react';
import { AudioModeConfig, RGBColor } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ColorPickerField } from '@/components/devices/ColorPickerField';
import { MicOff, Volume2, Save, Check } from 'lucide-react';

import { rgbToCss, cn } from '@/lib/utils';

export interface AudioModeFormProps {
  audioConfig: AudioModeConfig;
  onSave: (payload: {
    preset?: string;
    sensitivity?: number;
    bass_color?: RGBColor;
    mid_color?: RGBColor;
    high_color?: RGBColor;
    decay_speed?: number;
    min_brightness?: number;
  }) => Promise<unknown>;
  isSaving?: boolean;
}

const AUDIO_PRESETS: {
  name: string;
  preset: string;
  bass: RGBColor;
  mid: RGBColor;
  high: RGBColor;
}[] = [
  {
    name: 'Cyberpunk Neon',
    preset: '3band_eq',
    bass: [255, 0, 80],
    mid: [0, 220, 255],
    high: [255, 230, 0],
  },
  {
    name: 'Synthwave Night',
    preset: '3band_eq',
    bass: [147, 0, 255],
    mid: [255, 0, 150],
    high: [0, 255, 200],
  },
  {
    name: 'Deep Pacific',
    preset: '3band_eq',
    bass: [0, 80, 255],
    mid: [0, 240, 220],
    high: [200, 255, 255],
  },
  {
    name: 'Solar Inferno',
    preset: '3band_eq',
    bass: [255, 30, 0],
    mid: [255, 140, 0],
    high: [255, 240, 50],
  },
];

export const AudioModeForm: React.FC<AudioModeFormProps> = ({
  audioConfig,
  onSave,
  isSaving = false,
}) => {
  const [preset, setPreset] = useState(audioConfig.preset || '3band_eq');
  const [sensitivity, setSensitivity] = useState(audioConfig.sensitivity ?? 1.0);
  const [bassColor, setBassColor] = useState<RGBColor>(audioConfig.bass_color || [255, 0, 80]);
  const [midColor, setMidColor] = useState<RGBColor>(audioConfig.mid_color || [0, 220, 255]);
  const [highColor, setHighColor] = useState<RGBColor>(audioConfig.high_color || [255, 230, 0]);
  const [decaySpeed, setDecaySpeed] = useState(audioConfig.decay_speed ?? 0.85);
  const [minBrightness, setMinBrightness] = useState(audioConfig.min_brightness ?? 0.08);

  const [isListening, setIsListening] = useState(false);
  const [bassEnergy, setBassEnergy] = useState(0);
  const [midEnergy, setMidEnergy] = useState(0);
  const [highEnergy, setHighEnergy] = useState(0);

  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setPreset(audioConfig.preset || '3band_eq');
    setSensitivity(audioConfig.sensitivity ?? 1.0);
    setBassColor(audioConfig.bass_color || [255, 0, 80]);
    setMidColor(audioConfig.mid_color || [0, 220, 255]);
    setHighColor(audioConfig.high_color || [255, 230, 0]);
    setDecaySpeed(audioConfig.decay_speed ?? 0.85);
    setMinBrightness(audioConfig.min_brightness ?? 0.08);
  }, [audioConfig]);

  // Clean up Web Audio on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
    };
  }, []);

  const startAudioCapture = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = decaySpeed;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setIsListening(true);
      drawSpectrum();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Microphone access denied or unavailable');
      setIsListening(false);
    }
  };

  const stopAudioCapture = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsListening(false);
    setBassEnergy(0);
    setMidEnergy(0);
    setHighEnergy(0);
  };

  const drawSpectrum = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      // Group into Bass (bins 0..4), Mids (bins 5..18), Highs (bins 19..31)
      let bassSum = 0;
      for (let i = 0; i < 5; i++) bassSum += dataArray[i];
      const bassAvg = (bassSum / 5 / 255.0) * sensitivity;

      let midSum = 0;
      for (let i = 5; i < 18; i++) midSum += dataArray[i];
      const midAvg = (midSum / 13 / 255.0) * sensitivity;

      let highSum = 0;
      for (let i = 18; i < bufferLength; i++) highSum += dataArray[i];
      const highAvg = (highSum / Math.max(1, bufferLength - 18) / 255.0) * sensitivity;

      setBassEnergy(Math.min(1.0, bassAvg));
      setMidEnergy(Math.min(1.0, midAvg));
      setHighEnergy(Math.min(1.0, highAvg));

      // Draw canvas bars
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 0.8;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255.0) * canvas.height * Math.min(2.0, sensitivity);
        const hue = (i / bufferLength) * 280 + 160;
        ctx.fillStyle = `hsl(${hue}, 90%, 55%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const handleSave = async () => {
    setError(null);
    try {
      await onSave({
        preset,
        sensitivity,
        bass_color: bassColor,
        mid_color: midColor,
        high_color: highColor,
        decay_speed: decaySpeed,
        min_brightness: minBrightness,
      });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Audio mode');
    }
  };

  return (
    <Card className="glass-card border-border/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Audio Reactive Spectrograph &amp; Desktop Music Visualizer</CardTitle>
            <CardDescription>
              Captures real-time PC sound via Windows WASAPI Loopback (Spotify, YouTube, Games, Discord): Sub-bass kicks on Left, Vocals on Center, Treble on Right
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="p-6 space-y-6 pt-0">
        {/* Real-time System Audio Status Banner */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <div className="text-xs font-bold text-foreground">
                Windows WASAPI Desktop Audio Loopback Enabled
              </div>
              <div className="text-[11px] text-muted-foreground">
                Nanoleaf directly visualizes sound coming through your PC (Speakers / PRO X 2 Lightspeed)
              </div>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-mono font-bold border border-purple-500/30">
            48 kHz / 3-Band FFT
          </span>
        </div>

        {/* Live Audio Spectrum Tester */}
        <div className="p-5 rounded-2xl bg-secondary/30 border border-border space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant={isListening ? 'outline' : 'primary'}
                onClick={isListening ? stopAudioCapture : startAudioCapture}
                className={cn('gap-2 shadow-lg', isListening ? 'border-rose-500 text-rose-400' : 'shadow-purple-500/20')}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    Stop Spectrum Visualizer
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Preview Live Web Spectrum / Audio
                  </>
                )}
              </Button>

              <span className="text-xs text-muted-foreground font-mono">
                {isListening ? '🔴 Analyzing Audio Streams (FFT 64)' : '⚡ Desktop Audio is Streamed by Python Backend'}
              </span>
            </div>
          </div>


          {/* Canvas Spectrum visualizer */}
          <div className="h-20 w-full rounded-xl bg-black/50 border border-border/70 p-2 overflow-hidden flex items-end justify-center">
            <canvas ref={canvasRef} width={400} height={70} className="w-full h-full" />
          </div>

          {/* 3-Band Energy Meters */}
          <div className="grid grid-cols-3 gap-3">
            {/* Bass */}
            <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Left (Headset): BASS
              </span>
              <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden border border-border/40">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.round(bassEnergy * 100)}%`,
                    backgroundColor: rgbToCss(bassColor),
                  }}
                />
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: rgbToCss(bassColor) }}>
                {Math.round(bassEnergy * 100)}%
              </span>
            </div>

            {/* Mids */}
            <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Center (Keyboard): MIDS
              </span>
              <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden border border-border/40">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.round(midEnergy * 100)}%`,
                    backgroundColor: rgbToCss(midColor),
                  }}
                />
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: rgbToCss(midColor) }}>
                {Math.round(midEnergy * 100)}%
              </span>
            </div>

            {/* Highs */}
            <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Right (Mouse): HIGHS
              </span>
              <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden border border-border/40">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.round(highEnergy * 100)}%`,
                    backgroundColor: rgbToCss(highColor),
                  }}
                />
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: rgbToCss(highColor) }}>
                {Math.round(highEnergy * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Quick Color Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Audio Theme Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AUDIO_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setBassColor(p.bass);
                  setMidColor(p.mid);
                  setHighColor(p.high);
                }}
                className="p-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 transition-all flex flex-col items-start gap-1.5 text-left"
              >
                <div className="flex items-center gap-1 w-full">
                  <span className="h-3 flex-1 rounded-full shadow-sm" style={{ backgroundColor: rgbToCss(p.bass) }} />
                  <span className="h-3 flex-1 rounded-full shadow-sm" style={{ backgroundColor: rgbToCss(p.mid) }} />
                  <span className="h-3 flex-1 rounded-full shadow-sm" style={{ backgroundColor: rgbToCss(p.high) }} />
                </div>
                <span className="text-[11px] font-medium text-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sliders: Sensitivity & Idle Brightness */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Audio Sensitivity
              </span>
              <span className="font-mono text-purple-400 font-bold">{sensitivity.toFixed(1)}x</span>
            </div>
            <Slider
              min={0.2}
              max={3.0}
              step={0.1}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                Idle Baseline Brightness
              </span>
              <span className="font-mono text-purple-400 font-bold">{Math.round(minBrightness * 100)}%</span>
            </div>
            <Slider
              min={0.02}
              max={0.30}
              step={0.02}
              value={minBrightness}
              onChange={(e) => setMinBrightness(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Band Color Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/60">
            <ColorPickerField color={bassColor} onChange={setBassColor} label="Bass Kick Color" />
          </div>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/60">
            <ColorPickerField color={midColor} onChange={setMidColor} label="Mid Vocals Color" />
          </div>
          <div className="p-4 rounded-xl bg-secondary/20 border border-border/60">
            <ColorPickerField color={highColor} onChange={setHighColor} label="Treble Claps Color" />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Save Settings */}
        <div className="flex justify-end pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs gap-1.5 shadow-lg shadow-purple-500/20"
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Audio Visualizer Config
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
