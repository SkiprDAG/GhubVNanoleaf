import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWsBaseUrl } from '@/lib/env';
import {
  ConnectionState,
  LightingWebSocketEvent,
  SystemStatusResponse,
  RenderAppliedEvent,
} from '@/api/types';

export interface UseLightingWebSocketResult {
  connectionState: ConnectionState;
  lastRenderEvent: RenderAppliedEvent['data'] | null;
  lastEventTime: number | null;
  reconnect: () => void;
}

export function useLightingWebSocket(): UseLightingWebSocketResult {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastRenderEvent, setLastRenderEvent] = useState<RenderAppliedEvent['data'] | null>(null);
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUnmountedRef = useRef<boolean>(false);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (socketRef.current) {
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    const wsUrl = getWsBaseUrl();
    setConnectionState((prev) => (prev === 'connected' ? 'connected' : 'reconnecting'));

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setConnectionState('connected');

        // Start ping heartbeat every 5s to keep connection alive
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 5000);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isUnmountedRef.current) return;

        if (event.data === 'pong') {
          return;
        }

        try {
          const parsed = JSON.parse(event.data) as LightingWebSocketEvent;
          setLastEventTime(parsed.timestamp || Date.now() / 1000);

          switch (parsed.event) {
            case 'initial_snapshot': {
              queryClient.setQueryData(['status'], parsed.data.status);
              queryClient.setQueryData(['config'], parsed.data.config);
              break;
            }

            case 'battery_updated': {
              const battery = parsed.data;
              queryClient.setQueryData<SystemStatusResponse>(['status'], (old) => {
                if (!old) return old;
                const existingIndex = old.devices.findIndex((d) => d.device_id === battery.device_id);
                if (existingIndex >= 0) {
                  const newDevices = [...old.devices];
                  newDevices[existingIndex] = {
                    ...newDevices[existingIndex],
                    percentage: battery.percentage,
                    charging: battery.charging,
                    critical: battery.critical,
                  };
                  return { ...old, devices: newDevices };
                } else {
                  return {
                    ...old,
                    devices: [
                      ...old.devices,
                      {
                        device_id: battery.device_id,
                        name: battery.name,
                        percentage: battery.percentage,
                        charging: battery.charging,
                        critical: battery.critical,
                        fully_charged: false,
                        mileage: 0,
                      },
                    ],
                  };
                }
              });
              break;
            }

            case 'config_updated': {
              queryClient.invalidateQueries({ queryKey: ['config'] });
              queryClient.setQueryData<SystemStatusResponse>(['status'], (old) => {
                if (!old) return old;
                return {
                  ...old,
                  active_mode: parsed.data.active_mode,
                  config_revision: parsed.data.revision,
                };
              });
              break;
            }

            case 'render_applied': {
              setLastRenderEvent(parsed.data);
              queryClient.setQueryData<SystemStatusResponse>(['status'], (old) => {
                if (!old) return old;
                return {
                  ...old,
                  last_fingerprint: parsed.data.fingerprint,
                };
              });
              break;
            }
          }
        } catch {
          // Ignore non-JSON frame
        }
      };

      ws.onerror = () => {
        if (!isUnmountedRef.current) {
          setConnectionState('error');
        }
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (isUnmountedRef.current) return;

        setConnectionState('reconnecting');

        // Exponential backoff: 1s, 2s, 4s, 8s, capped at 15s
        const delay = Math.min(15000, Math.pow(2, reconnectAttemptRef.current) * 1000);
        reconnectAttemptRef.current += 1;

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      setConnectionState('error');
    }
  }, [queryClient]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const manualReconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  return {
    connectionState,
    lastRenderEvent,
    lastEventTime,
    reconnect: manualReconnect,
  };
}
