import React from 'react';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Layers, Sliders, Settings, X, ShieldCheck, Wand2 } from 'lucide-react';

export type NavTab = 'dashboard' | 'setup' | 'devices' | 'modes' | 'config';

export interface AppSidebarProps {
  activeTab: NavTab;
  onTabSelect: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  deviceCount?: number;
  configRevision?: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onTabSelect,
  isOpen,
  onClose,
  deviceCount = 0,
  configRevision = 1,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Live Dashboard',
      description: 'Real-time battery & render',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: deviceCount > 0 ? `${deviceCount} devs` : undefined,
    },
    {
      id: 'setup' as NavTab,
      label: 'Setup Wizard',
      description: 'Discover devices & map panels',
      icon: <Wand2 className="w-4 h-4 text-cyan-400" />,
      badge: 'New',
    },
    {
      id: 'devices' as NavTab,
      label: 'Devices & Layout',
      description: 'Panel mapping & base colors',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'modes' as NavTab,
      label: 'Lighting Modes',
      description: 'Battery, Ambient, Solid control',
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: 'config' as NavTab,
      label: 'Configuration',
      description: 'Effects, thresholds & raw JSON',
      icon: <Settings className="w-4 h-4" />,
      badge: `r${configRevision}`,
    },
  ];


  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-40 w-64 glass-panel border-r border-border/80 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="space-y-6">
          {/* Mobile close button */}
          <div className="flex items-center justify-between md:hidden pb-2 border-b border-border/60">
            <span className="font-bold text-sm text-foreground">Navigation</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabSelect(item.id);
                    onClose();
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150 group select-none min-h-[48px]',
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        'p-2 rounded-lg transition-colors shrink-0',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                          : 'bg-secondary/80 text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight truncate">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground/80 leading-tight truncate hidden sm:block">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-mono shrink-0',
                        isActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 text-[11px] text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Local Control Engine</span>
          </div>
          <p className="text-[10px] opacity-75">
            Logitech G HUB + Nanoleaf OpenAPI v2.0
          </p>
        </div>
      </aside>
    </>
  );
};
