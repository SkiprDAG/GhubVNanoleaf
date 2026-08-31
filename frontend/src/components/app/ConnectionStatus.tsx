import React from 'react';
import { ConnectionState } from '@/api/types';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConnectionStatusProps {
  state: ConnectionState;
  onReconnect?: () => void;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  onReconnect,
  className,
}) => {
  const configs = {
    connected: {
      label: 'Live Connected',
      icon: <Wifi className="w-3.5 h-3.5 text-emerald-400" />,
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    },
    reconnecting: {
      label: 'Reconnecting...',
      icon: <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-400 animate-ping',
    },
    disconnected: {
      label: 'Disconnected',
      icon: <WifiOff className="w-3.5 h-3.5 text-rose-400" />,
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-400',
    },
    error: {
      label: 'Connection Error',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
      dotClass: 'bg-rose-400',
    },
  };

  const current = configs[state];

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200',
          current.badgeClass
        )}
      >
        <span className={cn('w-2 h-2 rounded-full shrink-0', current.dotClass)} />
        {current.icon}
        <span className="hidden sm:inline">{current.label}</span>
      </div>

      {(state === 'disconnected' || state === 'error') && onReconnect && (
        <button
          onClick={onReconnect}
          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Retry WebSocket connection"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
