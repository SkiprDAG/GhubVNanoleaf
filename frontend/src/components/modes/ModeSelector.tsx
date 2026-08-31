import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BatteryCharging, Zap, Moon, Check, Sparkles, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModeSelectorProps {
  activeMode: string;
  onSelectMode: (mode: string) => Promise<void>;
  isLoading?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  onSelectMode,
  isLoading = false,
}) => {
  const modes = [
    {
      id: 'battery',
      title: 'Battery Mode',
      description:
        'Live Logitech device battery visualization with smooth brightness scaling, charging animations, and critical warnings.',
      icon: <BatteryCharging className="w-5 h-5 text-emerald-400" />,
      colorClass: 'from-emerald-500/10 to-transparent border-emerald-500/30',
      activeBorder: 'border-emerald-500/60 shadow-emerald-500/10',
    },
    {
      id: 'ambient',
      title: 'Ambient Flow',
      description:
        'Peaceful multi-color atmospheric wave across all panels with smooth phase shifts and continuous palette morphing.',
      icon: <Waves className="w-5 h-5 text-purple-400" />,
      colorClass: 'from-purple-500/10 to-transparent border-purple-500/30',
      activeBorder: 'border-purple-500/60 shadow-purple-500/10',
    },
    {
      id: 'vortex',
      title: 'Vortex Turbine',
      description:
        'Synchronized high-speed neon light rotation inside each of the 3 hexagonal clusters with trailing comet tails.',
      icon: <Sparkles className="w-5 h-5 text-cyan-400" />,
      colorClass: 'from-cyan-500/10 to-transparent border-cyan-500/30',
      activeBorder: 'border-cyan-500/60 shadow-cyan-500/10',
    },
    {
      id: 'wave',
      title: 'Neon Sweep Wave',
      description:
        'Horizontal neon pulse wave surging across your wall installation (Headset → Keyboard → Mouse) with customizable bounce.',
      icon: <Zap className="w-5 h-5 text-pink-400" />,
      colorClass: 'from-pink-500/10 to-transparent border-pink-500/30',
      activeBorder: 'border-pink-500/60 shadow-pink-500/10',
    },
    {
      id: 'pomodoro',
      title: 'Pomodoro Focus',
      description:
        '25-minute focus sprint progress visualizer across all 18 wall panels with relaxing break transitions.',
      icon: <Sparkles className="w-5 h-5 text-amber-400" />,
      colorClass: 'from-amber-500/10 to-transparent border-amber-500/30',
      activeBorder: 'border-amber-500/60 shadow-amber-500/10',
    },
    {
      id: 'circadian',
      title: 'Circadian Light',
      description:
        '24h dynamic natural sunlight color temperature matching real-world time of day (1800K night to 6500K noon).',
      icon: <Sparkles className="w-5 h-5 text-orange-400" />,
      colorClass: 'from-orange-500/10 to-transparent border-orange-500/30',
      activeBorder: 'border-orange-500/60 shadow-orange-500/10',
    },
    {
      id: 'audio',
      title: 'Audio Reactive',
      description:
        'Real-time music beat spectrograph: 3-band equalizer routing Sub-bass kicks to Left, Vocals to Center, Treble to Right.',
      icon: <Sparkles className="w-5 h-5 text-purple-400" />,
      colorClass: 'from-purple-500/10 to-transparent border-purple-500/30',
      activeBorder: 'border-purple-500/60 shadow-purple-500/10',
    },

    {
      id: 'solid',
      title: 'Solid Ambient',
      description:
        'Fill all mapped Nanoleaf panels with a static custom RGB color, customizable brightness multiplier, and smooth transition time.',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      colorClass: 'from-amber-500/10 to-transparent border-amber-500/30',
      activeBorder: 'border-amber-500/60 shadow-amber-500/10',
    },
    {
      id: 'off',
      title: 'Off / Blackout',
      description:
        'Turn off all assigned Nanoleaf panels smoothly with zero power drain.',
      icon: <Moon className="w-5 h-5 text-slate-400" />,
      colorClass: 'from-slate-500/10 to-transparent border-slate-500/30',
      activeBorder: 'border-slate-500/60 shadow-slate-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">



      {modes.map((mode) => {
        const isActive = activeMode.toLowerCase() === mode.id;

        return (
          <Card
            key={mode.id}
            className={cn(
              'relative flex flex-col justify-between p-5 border bg-gradient-to-b transition-all duration-200',
              mode.colorClass,
              isActive ? cn('border-2 shadow-lg', mode.activeBorder) : 'opacity-80 hover:opacity-100'
            )}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="p-2.5 rounded-xl bg-secondary/90 border border-border shrink-0">
                  {mode.icon}
                </div>

                {isActive ? (
                  <Badge variant="success" className="gap-1 font-bold">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Active Plan</span>
                  </Badge>
                ) : (
                  <Badge variant="outline">Available</Badge>
                )}
              </div>

              <div>
                <h4 className="text-base font-bold text-foreground">{mode.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {mode.description}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border/40">
              {isActive ? (
                <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>Currently Active</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectMode(mode.id)}
                  disabled={isLoading}
                  className="w-full font-semibold"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  Activate {mode.title.split(' ')[0]}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
