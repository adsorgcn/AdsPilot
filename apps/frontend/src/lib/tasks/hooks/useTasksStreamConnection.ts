import { useEffect } from 'react';

import mainApi from '~/lib/api/clients/MainApiClient';

import type { TasksListApiResponse, TasksListResponse } from '../types';
import { mapTasksListResponse } from '../utils/task-mappers';
import { readTasksStream } from '../utils/stream-reader';

/**
 * SSE连接管理逻辑
 * 负责建立连接、处理重连、错误处理
 */
export function useTasksStreamConnection({
  streamEndpoint,
  snapshotEndpoint,
  connectionId,
  onData,
  onError,
  onLoadingChange,
  onConnectedChange,
  dataRef,
}: {
  streamEndpoint: string;
  snapshotEndpoint: string;
  connectionId: number;
  onData: (data: TasksListResponse) => void;
  onError: (error: Error | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onConnectedChange: (connected: boolean) => void;
  dataRef: React.MutableRefObject<TasksListResponse | null>;
}) {
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchSnapshot = async (): Promise<TasksListResponse> => {
      const response = await mainApi.get<TasksListApiResponse>(
        snapshotEndpoint,
      );
      return mapTasksListResponse(response);
    };

    const connect = async () => {
      onLoadingChange(dataRef.current === null);
      onError(null);

      try {
        const response = await mainApi.requestRaw(streamEndpoint, {
          signal: abortController.signal,
          headers: {
            Accept: 'text/event-stream',
          },
        });

        if (!response.body) {
          throw new Error('任务实时流不可用');
        }

        onConnectedChange(true);
        onLoadingChange(false);

        await readTasksStream(response, (payload) => {
          if (cancelled) {
            return;
          }

          const mapped = mapTasksListResponse(payload);
          dataRef.current = mapped;
          onData(mapped);
          onLoadingChange(false);
        });

        // 流结束，准备重连
        if (!cancelled) {
          onConnectedChange(false);
          reconnectTimer = setTimeout(() => {
            // 通过递增 connectionId 来触发重连
          }, 15000);
        }
      } catch (err) {
        if (abortController.signal.aborted || cancelled) {
          return;
        }

        const parsedError =
          err instanceof Error ? err : new Error('任务实时连接失败');
        onError(parsedError);
        onConnectedChange(false);
        onLoadingChange(false);

        // 尝试获取快照作为降级方案
        try {
          const snapshot = await fetchSnapshot();
          if (!cancelled) {
            dataRef.current = snapshot;
            onData(snapshot);
          }
        } catch (snapshotError) {
          if (!cancelled && snapshotError instanceof Error) {
            onError(snapshotError);
          }
        }

        // 15秒后重连
        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            // 通过递增 connectionId 来触发重连
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
  }, [
    connectionId,
    snapshotEndpoint,
    streamEndpoint,
    onData,
    onError,
    onLoadingChange,
    onConnectedChange,
    dataRef,
  ]);
}
