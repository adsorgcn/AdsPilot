import { useCallback, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type {
  RawTask,
  Task,
  TasksListApiResponse,
  TasksListParams,
  TasksListResponse,
} from '../types';
import { mapTask, mapTasksListResponse } from '../utils/task-mappers';
import { buildTasksEndpoint } from '../utils/task-helpers';
import { useTasksStreamConnection } from './useTasksStreamConnection';

/**
 * 查询任务列表 - 使用智能轮询
 */
export function useTasks(params: TasksListParams = {}) {
  const endpoint = buildTasksEndpoint(params);

  const query = useQuery<TasksListResponse>({
    queryKey: ['tasks', endpoint],
    queryFn: async () => {
      const data = await apiGet<TasksListApiResponse>(endpoint);
      return mapTasksListResponse(data);
    },
    // ✅ 智能轮询：只有当有运行中/等待中的任务时才轮询
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false; // 首次加载不轮询
      const hasActiveTasks = data.tasks.some(
        (t) => t.status === 'running' || t.status === 'pending',
      );
      return hasActiveTasks ? 10000 : false; // 10 秒轮询，否则停止
    },
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false, // ✅ 页面不可见时停止轮询
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    tasks: query.data?.tasks ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    limit: query.data?.limit ?? 20,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 查询任务列表 - 使用SSE实时流
 */
export function useTasksStream(params: TasksListParams = {}) {
  const streamEndpoint = buildTasksEndpoint(
    params,
    API_ENDPOINTS.CONSOLE.TASKS_STREAM,
  );
  const snapshotEndpoint = buildTasksEndpoint(params);

  const [data, setData] = useState<TasksListResponse | null>(null);
  const dataRef = useRef<TasksListResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionId, setConnectionId] = useState(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await fetchTasksSnapshot(snapshotEndpoint);
      dataRef.current = snapshot;
      setData(snapshot);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('刷新任务列表失败'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [snapshotEndpoint]);

  const reconnect = useCallback(() => {
    setConnectionId((prev) => prev + 1);
  }, []);

  // 使用提取的连接逻辑
  useTasksStreamConnection({
    streamEndpoint,
    snapshotEndpoint,
    connectionId,
    onData: setData,
    onError: setError,
    onLoadingChange: setIsLoading,
    onConnectedChange: setIsConnected,
    dataRef,
  });

  return {
    tasks: data?.tasks ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? params.limit ?? 20,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    error,
    mutate: refresh,
    reconnect,
    isConnected,
  };
}

/**
 * 查询单个任务详情 - 使用智能轮询
 */
export function useTask(taskId?: string) {
  const endpoint = taskId ? `/api/v1/tasks/${taskId}` : null;

  const query = useQuery<Task | null>({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!endpoint) throw new Error('Task ID is required');
      return apiGet<RawTask>(endpoint).then(mapTask);
    },
    enabled: !!taskId,
    // ✅ 智能轮询：只有当任务在运行时才轮询
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false; // 首次加载不轮询
      const isActive =
        data.status === 'running' || data.status === 'pending';
      return isActive ? 5000 : false; // 5 秒轮询，否则停止
    },
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false, // ✅ 页面不可见时停止轮询
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    task: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

async function fetchTasksSnapshot(
  endpoint: string,
): Promise<TasksListResponse> {
  const data = await apiGet<TasksListApiResponse>(endpoint);
  return mapTasksListResponse(data);
}
