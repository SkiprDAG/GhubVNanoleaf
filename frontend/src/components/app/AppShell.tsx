import React, { useState } from 'react';
import { TopBar } from './TopBar';
import { AppSidebar, NavTab } from './AppSidebar';
import { ConnectionState } from '@/api/types';

export interface AppShellProps {
  activeTab: NavTab;
  onTabSelect: (tab: NavTab) => void;
  activeMode?: string;
  connectionState: ConnectionState;
  onReconnect: () => void;
  onRefresh: () => void;
  onReapply: () => void;
  isReapplying: boolean;
  deviceCount?: number;
  configRevision?: number;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabSelect,
  activeMode,
  connectionState,
  onReconnect,
  onRefresh,
  onReapply,
  isReapplying,
  deviceCount,
  configRevision,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopBar
        activeMode={activeMode}
        connectionState={connectionState}
        onReconnect={onReconnect}
        onRefresh={onRefresh}
        onReapply={onReapply}
        isReapplying={isReapplying}
        onMenuToggle={() => setSidebarOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar
          activeTab={activeTab}
          onTabSelect={onTabSelect}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          deviceCount={deviceCount}
          configRevision={configRevision}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
