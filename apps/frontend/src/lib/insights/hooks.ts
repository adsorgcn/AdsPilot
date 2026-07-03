'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchInsights } from '~/lib/api/console/insights';
import { consoleApi } from '~/lib/api';
import type { Insight, InsightsResponse } from '~/lib/api/types/console';

interface UseAIInsightsState {
  insights: Insight[];
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  reconnect: () => void;
}

export function useAIInsights(): UseAIInsightsState {
  const [insights, setInsights] = useState<Insight[]>([]);
  const insightsRef = useRef<Insight[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionId, setConnectionId] = useState<number>(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await fetchInsights();
      insightsRef.current = snapshot.items;
      setInsights(snapshot.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取 Insights 失败'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    setConnectionId((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      setIsLoading(insightsRef.current.length === 0);
      setError(null);

      try {
        const response = await consoleApi.streamInsights({
          signal: abortController.signal,
        });

        if (!response.body) {
          throw new Error('Insights 实时流不可用');
        }

        setIsConnected(true);
        setIsLoading(false);

        await readInsightsStream(response, (payload) => {
          if (cancelled) {
            return;
          }

          insightsRef.current = payload.items;
          setInsights(payload.items);
          setIsLoading(false);
        });

        if (!cancelled) {
          setIsConnected(false);
          reconnectTimer = setTimeout(() => {
            setConnectionId((prev) => prev + 1);
          }, 15000);
        }
      } catch (err) {
        if (abortController.signal.aborted || cancelled) {
          return;
        }

        const parsedError = err instanceof Error ? err : new Error('Insights 实时连接失败');
        setError(parsedError);
        setIsConnected(false);
        setIsLoading(false);

        try {
          const snapshot = await fetchInsights();
          if (!cancelled) {
            insightsRef.current = snapshot.items;
            setInsights(snapshot.items);
          }
        } catch (snapshotError) {
          if (!cancelled && snapshotError instanceof Error) {
            setError(snapshotError);
          }
        }

        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            setConnectionId((prev) => prev + 1);
          }, 15000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      abortController.abort();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [connectionId]);

  return {
    insights,
    isLoading,
    error,
    isConnected,
    refresh,
    reconnect,
  };
}

async function readInsightsStream(
  response: Response,
  onMessage: (payload: InsightsResponse) => void,
): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('无法读取 Insights 实时流');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const parsed = parseSseEvent(rawEvent);
      if (parsed?.data) {
        try {
          const payload = JSON.parse(parsed.data) as InsightsResponse;
          onMessage(payload);
        } catch (error) {
          console.error('[insights] SSE 数据解析失败', error, parsed.data);
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }
}

function parseSseEvent(rawEvent: string): { event: string; data?: string } | null {
  if (!rawEvent.trim()) {
    return null;
  }

  const lines = rawEvent.split('\n');
  let eventType = 'message';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const value = line.slice(5).trimStart();
      data += value + '\n';
    }
  }

  if (data.endsWith('\n')) {
    data = data.slice(0, -1);
  }

  return {
    event: eventType,
    data: data || undefined,
  };
}
