import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from './core/errors';

type ResourceKey = string | string[] | null;

const defaultIsPaused = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

const DEFAULT_QUERY_CONFIG = {
  retry: 2,
  retryDelay: 3000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  networkMode: 'online' as const,
};

function shouldRetryByDefault(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  if (error instanceof ApiError) {
    if (error.code === 'REQUEST_CANCELLED') {
      return false;
    }

    if (error.status === 0) {
      return true;
    }

    if (error.status >= 500) {
      return true;
    }

    return false;
  }

  return true;
}

function logErrorByDefault(error: unknown, key: ResourceKey) {
  if (error instanceof ApiError && error.code === 'REQUEST_CANCELLED') {
    return;
  }

  const message =
    error instanceof Error ? error.message : JSON.stringify(error);

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Query] 资源 ${String(key)} 加载失败: ${message}`, error);
  }
}

function mergeQueryConfig<Data>(
  baseConfig?: UseQueryOptions<Data>,
  override?: UseQueryOptions<Data>,
): UseQueryOptions<Data> {
  const merged: UseQueryOptions<Data> = {
    ...(DEFAULT_QUERY_CONFIG as UseQueryOptions<Data>),
    ...baseConfig,
    ...override,
  };

  const customRetry =
    override?.retry ?? baseConfig?.retry;

  merged.retry = (failureCount, error) => {
    const defaultDecision = shouldRetryByDefault(error);
    if (!defaultDecision) {
      return false;
    }

    if (typeof customRetry === 'function') {
      return customRetry(failureCount, error);
    }

    return customRetry !== undefined ? customRetry : DEFAULT_QUERY_CONFIG.retry!;
  };

  const customOnError = override?.onError ?? baseConfig?.onError;

  merged.onError = (error) => {
    logErrorByDefault(error, null);
    customOnError?.(error);
  };

  const customIsPaused = override?.networkMode ?? baseConfig?.networkMode;

  if (customIsPaused) {
    merged.networkMode = customIsPaused;
  }

  return merged;
}

/**
 * 创建无需参数的 TanStack Query Hook
 *
 * 用于创建静态资源(不依赖动态参数)的TanStack Query Hook,自动处理AbortSignal、重试和错误日志。
 *
 * @template Data - 资源数据类型
 * @param key - Query缓存键,通常为字符串或数组(如 `['tasks', 'stats']`)
 * @param request - 数据获取函数,接收AbortSignal用于取消请求
 * @param baseConfig - TanStack Query基础配置,会与默认配置合并
 *
 * @returns createStaticResource Hook,返回 `{ data, error, isLoading, refetch }`
 *
 * @example
 * ```tsx
 * // 定义资源
 * const useTaskStats = createStaticResource(
 *   ['tasks', 'stats'],
 *   async (signal) => {
 *     const response = await fetch('/api/tasks/stats', { signal });
 *     return response.json();
 *   },
 *   { refetchInterval: 30000 } // 可选配置
 * );
 *
 * // 在组件中使用
 * function TaskDashboard() {
 *   const { data, error, isLoading, refetch } = useTaskStats();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return <div>Total: {data.total}</div>;
 * }
 * ```
 *
 * @remarks
 * - 自动处理AbortSignal,组件卸载时取消请求
 * - 默认离线时暂停请求
 * - 失败时自动重试2次,间隔3秒
 * - 5xx错误会重试,4xx错误不重试
 */
export function createStaticResource<Data>(
  key: ResourceKey,
  request: (signal: AbortSignal) => Promise<Data>,
  baseConfig?: UseQueryOptions<Data>,
) {
  return function useStaticResource(config?: UseQueryOptions<Data>) {
    const resolvedConfig = mergeQueryConfig<Data>(baseConfig, config);

    return useQuery<Data>({
      queryKey: Array.isArray(key) ? key : [key],
      queryFn: () => {
        const controller = new AbortController();
        const signal = controller.signal;

        return request(signal).finally(() => {
          controller.abort();
        });
      },
      ...resolvedConfig,
    });
  };
}

/**
 * 创建带参数的 TanStack Query Hook
 *
 * 用于创建动态资源(依赖参数)的TanStack Query Hook,支持参数变化时自动重新请求。
 *
 * @template Params - 参数类型
 * @template Data - 资源数据类型
 * @param keyBuilder - 根据参数生成缓存键的函数
 * @param request - 数据获取函数,接收参数和AbortSignal
 * @param baseConfig - TanStack Query基础配置
 *
 * @returns createParamResource Hook,接受参数并返回 `{ data, error, isLoading, refetch }`
 *
 * @example
 * ```tsx
 * // 定义资源
 * interface TaskDetailParams {
 *   taskId: string;
 * }
 *
 * const useTaskDetail = createParamResource(
 *   (params: TaskDetailParams) => ['tasks', params.taskId],
 *   async (params, signal) => {
 *     const response = await fetch(`/api/tasks/${params.taskId}`, { signal });
 *     return response.json();
 *   }
 * );
 *
 * // 在组件中使用
 * function TaskDetailPage({ taskId }: { taskId: string }) {
 *   const { data, error, isLoading } = useTaskDetail({ taskId });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error />;
 *
 *   return <div>{data.name}</div>;
 * }
 * ```
 *
 * @remarks
 * - 参数变化时自动触发重新请求
 * - 支持条件请求: 返回 `null` 键时暂停请求
 * - 继承 createStaticResource 的所有特性(重试、错误处理等)
 */
export function createParamResource<Params, Data>(
  keyBuilder: (params: Params) => ResourceKey,
  request: (params: Params, signal: AbortSignal) => Promise<Data>,
  baseConfig?: UseQueryOptions<Data>,
) {
  return function useParamResource(params: Params, config?: UseQueryOptions<Data>) {
    const key = keyBuilder(params);
    const resolvedConfig = mergeQueryConfig<Data>(baseConfig, config);

    return useQuery<Data>({
      queryKey: Array.isArray(key) ? key : [key],
      queryFn: () => {
        const controller = new AbortController();
        const signal = controller.signal;

        return request(params, signal).finally(() => {
          controller.abort();
        });
      },
      enabled: key !== null,
      ...resolvedConfig,
    });
  };
}