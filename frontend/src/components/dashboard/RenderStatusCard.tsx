import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RenderAppliedEvent } from '@/api/types';
import { formatTimeAgo } from '@/lib/utils';
import { Sparkles, Hash, Activity, CheckCircle2, Clock } from 'lucide-react';

export interface RenderStatusCardProps {
  activeMode?: string;
  fingerprint?: string | null;
  configRevision?: number;
  lastRenderEvent?: RenderAppliedEvent['data'] | null;
  lastEventTime?: number | null;
  className?: string;
}

export const RenderStatusCard: React.FC<RenderStatusCardProps> = ({
  activeMode = 'battery',
  fingerprint,
  configRevision = 1,
  lastRenderEvent,
  lastEventTime,
  className,
}) => {
  const currentFingerprint = lastRenderEvent?.fingerprint || fingerprint;
  const animType = lastRenderEvent?.anim_type || 'static';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <CardTitle>Nanoleaf Render Pipeline</CardTitle>
        </div>

        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Synced with Panels</span>
        </Badge>
      </CardHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Activity className="w-3 h-3" />
            <span>Active Mode</span>
          </div>
          <div className="text-sm font-bold text-foreground uppercase tracking-wider">
            {activeMode}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Effect Type</span>
          </div>
          <div className="text-sm font-bold text-foreground capitalize">
            {animType}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Hash className="w-3 h-3" />
            <span>Config Revision</span>
          </div>
          <div className="text-sm font-bold font-mono text-primary">
            rev {configRevision}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Clock className="w-3 h-3" />
            <span>Last Render</span>
          </div>
          <div className="text-sm font-bold text-foreground">
            {formatTimeAgo(lastEventTime ?? null)}
          </div>
        </div>
      </div>

      {currentFingerprint && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Fingerprint:</span>
          <span className="font-mono text-[11px] text-primary/90 bg-primary/10 px-2 py-0.5 rounded border border-primary/20 truncate max-w-[280px]">
            {currentFingerprint}
          </span>
        </div>
      )}
    </Card>
  );
};
