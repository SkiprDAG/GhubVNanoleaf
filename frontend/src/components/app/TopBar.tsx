import React from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import { ConnectionState } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, RefreshCw, Zap, Moon, BatteryCharging } from 'lucide-react';

export interface TopBarProps {
  activeMode?: string;
  connectionState: ConnectionState;
  onReconnect: () => void;
  onRefresh: () => void;
  onReapply: () => void;
  isReapplying: boolean;
  onMenuToggle?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeMode = 'battery',
  connectionState,
  onReconnect,
  onRefresh,
  onReapply,
  isReapplying,
  onMenuToggle,
}) => {
  const getModeIcon = () => {
    switch (activeMode.toLowerCase()) {
      case 'battery':
        return <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />;
      case 'solid':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'off':
        return <Moon className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getModeBadgeVariant = () => {
    switch (activeMode.toLowerCase()) {
      case 'battery':
        return 'success';
      case 'solid':
        return 'warning';
      case 'off':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full h-16 border-b border-border/80 bg-background/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
              Ghub<span className="text-primary">V</span>Nanoleaf
            </h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Logitech & Nanoleaf Lighting Bridge</p>
          </div>
        </div>

        {/* Active Mode Badge */}
        <div className="hidden sm:flex items-center gap-1.5 ml-3 pl-3 border-l border-border/60">
          <span className="text-xs text-muted-foreground font-medium">Mode:</span>
          <Badge variant={getModeBadgeVariant()} className="uppercase tracking-wider flex items-center gap-1.5">
            {getModeIcon()}
            <span>{activeMode}</span>
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ConnectionStatus state={connectionState} onReconnect={onReconnect} />

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="hidden sm:inline-flex"
          title="Reload Status from Server"
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
        >
          <span>Sync</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onReapply}
          isLoading={isReapplying}
          leftIcon={<Sparkles className="w-3.5 h-3.5" />}
          className="shadow-sm font-semibold"
        >
          <span className="hidden sm:inline">Apply Render</span>
          <span className="sm:hidden">Apply</span>
        </Button>
      </div>
    </header>
  );
};
