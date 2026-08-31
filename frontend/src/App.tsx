import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/hooks/useToast';
import { useLightingWebSocket } from '@/hooks/useLightingWebSocket';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useModes } from '@/hooks/useModes';
import { AppShell } from '@/components/app/AppShell';
import { NavTab } from '@/components/app/AppSidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { SetupPage } from '@/pages/SetupPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { ModesPage } from '@/pages/ModesPage';
import { ConfigPage } from '@/pages/ConfigPage';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MainDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // WebSocket Live Stream
  const {
    connectionState,
    lastRenderEvent,
    lastEventTime,
    reconnect: handleReconnect,
  } = useLightingWebSocket();

  // Status & Reapply
  const {
    status,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
    reapply,
    isReapplying,
  } = useSystemStatus();

  // Config State & Mutations
  const {
    config,
    isLoading: isConfigLoading,
    refetch: refetchConfig,
    saveFullConfig,
    isSavingFullConfig,
    saveMapping,
    isSavingMapping,
    deleteMapping,
    isDeletingMapping,
  } = useAppConfig();

  // Mode Switching
  const {
    setMode,
    isSettingMode,
    updateSolidMode,
    isUpdatingSolidMode,
    updateAmbientMode,
    isUpdatingAmbientMode,
    updateVortexMode,
    isUpdatingVortexMode,
    updateWaveMode,
    isUpdatingWaveMode,
    updatePomodoroMode,
    isUpdatingPomodoroMode,
    updateCircadianMode,
    isUpdatingCircadianMode,
    updateAudioMode,
    isUpdatingAudioMode,
  } = useModes();

  const handleGlobalRefresh = () => {
    refetchStatus();
    refetchConfig();
  };

  const activeMode = status?.active_mode || config?.mode?.active || 'battery';

  return (
    <AppShell
      activeTab={activeTab}
      onTabSelect={setActiveTab}
      activeMode={activeMode}
      connectionState={connectionState}
      onReconnect={handleReconnect}
      onRefresh={handleGlobalRefresh}
      onReapply={() => reapply()}
      isReapplying={isReapplying}
      deviceCount={status?.devices?.length || 0}
      configRevision={status?.config_revision || config?.revision || 1}
    >
      {activeTab === 'dashboard' && (
        <DashboardPage
          status={status}
          config={config}
          isLoading={isStatusLoading || isConfigLoading}
          lastRenderEvent={lastRenderEvent}
          lastEventTime={lastEventTime}
        />
      )}

      {activeTab === 'setup' && (
        <SetupPage
          onFinish={() => setActiveTab('devices')}
        />
      )}

      {activeTab === 'devices' && (
        <DevicesPage
          config={config}
          isLoading={isConfigLoading}
          onSaveMapping={saveMapping}
          onDeleteMapping={deleteMapping}
          isSaving={isSavingMapping || isDeletingMapping}
        />
      )}

      {activeTab === 'modes' && (
        <ModesPage
          config={config}
          activeMode={activeMode}
          isLoading={isConfigLoading}
          onSetMode={(mode: string) => setMode({ mode })}
          onSaveFullConfig={saveFullConfig}
          onUpdateSolidMode={updateSolidMode}
          onUpdateAmbientMode={updateAmbientMode}
          onUpdateVortexMode={updateVortexMode}
          onUpdateWaveMode={updateWaveMode}
          onUpdatePomodoroMode={updatePomodoroMode}
          onUpdateCircadianMode={updateCircadianMode}
          onUpdateAudioMode={updateAudioMode}
          isSettingMode={isSettingMode}
          isSavingConfig={
            isSavingFullConfig ||
            isUpdatingSolidMode ||
            isUpdatingAmbientMode ||
            isUpdatingVortexMode ||
            isUpdatingWaveMode ||
            isUpdatingPomodoroMode ||
            isUpdatingCircadianMode ||
            isUpdatingAudioMode
          }
        />
      )}




      {activeTab === 'config' && (
        <ConfigPage
          config={config}
          isLoading={isConfigLoading}
          onReload={refetchConfig}
          onSaveFullConfig={saveFullConfig}
          isSaving={isSavingFullConfig}
        />
      )}
    </AppShell>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MainDashboard />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
