import React, { useState } from 'react';
import { AppConfig } from '@/api/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { Copy, Check, RefreshCw, FileCode } from 'lucide-react';

export interface ConfigViewerProps {
  config?: AppConfig;
  onReload: () => void;
  isLoading?: boolean;
}

export const ConfigViewer: React.FC<ConfigViewerProps> = ({
  config,
  onReload,
  isLoading = false,
}) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const formattedJson = config ? JSON.stringify(config, null, 2) : '{}';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      toast.info('Copied to Clipboard', 'Configuration JSON copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy Failed', 'Unable to write to clipboard');
    }
  };

  return (
    <Card className="space-y-4">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-secondary/80 text-primary border border-border">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Raw Configuration Snapshot</CardTitle>
              {config && (
                <Badge variant="purple" className="font-mono">
                  Revision {config.revision}
                </Badge>
              )}
            </div>
            <CardDescription>
              Inspected live from backend storage with revision tracking
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReload}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reload
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleCopy}
            leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </div>
      </CardHeader>

      <div className="relative rounded-xl bg-black/60 border border-border/80 overflow-hidden">
        <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-[500px] leading-relaxed select-all">
          <code>{formattedJson}</code>
        </pre>
      </div>
    </Card>
  );
};
