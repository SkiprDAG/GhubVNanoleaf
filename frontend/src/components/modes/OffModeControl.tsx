import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Moon, Power, Check } from 'lucide-react';

export interface OffModeControlProps {
  isActive: boolean;
  onTurnOff: () => Promise<void>;
  isLoading?: boolean;
}

export const OffModeControl: React.FC<OffModeControlProps> = ({
  isActive,
  onTurnOff,
  isLoading = false,
}) => {
  const handleTurnOff = async () => {
    if (isActive) return;
    await onTurnOff();
  };

  return (
    <Card className="border-slate-800 bg-gradient-to-r from-slate-950/90 to-slate-900/60 p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Blackout / Panels Off</CardTitle>
              {isActive && (
                <Badge variant="outline" className="text-slate-400 border-slate-700">
                  Panels Powered Off
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              Smoothly transition all assigned Nanoleaf panels to zero brightness.
            </CardDescription>
          </div>
        </div>

        <Button
          variant={isActive ? 'outline' : 'danger'}
          size="md"
          onClick={handleTurnOff}
          disabled={isActive || isLoading}
          isLoading={isLoading}
          leftIcon={isActive ? <Check className="w-4 h-4 text-emerald-400" /> : <Power className="w-4 h-4" />}
          className="shrink-0 font-semibold"
        >
          {isActive ? 'Panels Off' : 'Turn Off Panels'}
        </Button>
      </div>
    </Card>
  );
};
