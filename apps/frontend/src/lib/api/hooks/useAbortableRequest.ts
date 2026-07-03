/**
 * useAbortableRequest Hook
 *
 * 自动管理 AbortController 的 React Hook
 * 在组件卸载或依赖变化时自动取消请求，防止内存泄漏
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { signal, abort } = useAbortableRequest();
 *
 *   const handleFetch = async () => {
 *     try {
 *       const data = await apiGet('/some-endpoint', { signal });
 *       // 处理数据
 *     } catch (error) {
 *       if (error.code === 'REQUEST_CANCELLED') {
 *         // 请求被取消，忽略
 *         return;
 *       }
 *       // 处理其他错误
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleFetch}>Fetch</button>
 *       <button onClick={abort}>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useRef } from 'react';

export interface AbortableRequest {
  /**
   * AbortSignal for passing to fetch/apiGet/apiPost
   */
  signal: AbortSignal;

  /**
   * Manually abort the request
   */
  abort: () => void;

  /**
   * Check if the request has been aborted
   */
  isAborted: () => boolean;
}

/**
 * Hook for managing abortable HTTP requests
 * Automatically aborts on unmount or when dependencies change
 *
 * @param deps - Optional dependencies array. When deps change, previous request is aborted.
 * @returns AbortableRequest object with signal, abort, and isAborted
 */
export function useAbortableRequest(deps: React.DependencyList = []): AbortableRequest {
  const controllerRef = useRef<AbortController | null>(null);

  // Create new controller on mount or when deps change
  useEffect(() => {
    // Abort previous request if exists
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Create new controller
    controllerRef.current = new AbortController();

    // Cleanup: abort on unmount or deps change
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const abort = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  };

  const isAborted = () => {
    return controllerRef.current?.signal.aborted ?? true;
  };

  return {
    signal: controllerRef.current?.signal ?? new AbortController().signal,
    abort,
    isAborted,
  };
}

/**
 * Hook for managing multiple abortable requests
 * Useful when you need to track multiple concurrent requests
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { createRequest, abortAll } = useAbortableRequests();
 *
 *   const handleMultipleFetches = async () => {
 *     const req1 = createRequest('users');
 *     const req2 = createRequest('posts');
 *
 *     try {
 *       const [users, posts] = await Promise.all([
 *         apiGet('/users', { signal: req1.signal }),
 *         apiGet('/posts', { signal: req2.signal }),
 *       ]);
 *       // 处理数据
 *     } catch (error) {
 *       // 处理错误
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleMultipleFetches}>Fetch All</button>
 *       <button onClick={abortAll}>Cancel All</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAbortableRequests() {
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    // Cleanup: abort all requests on unmount
    return () => {
      controllersRef.current.forEach((controller) => {
        controller.abort();
      });
      controllersRef.current.clear();
    };
  }, []);

  const createRequest = (key: string): AbortableRequest => {
    // Abort existing request with same key
    const existing = controllersRef.current.get(key);
    if (existing) {
      existing.abort();
    }

    // Create new controller
    const controller = new AbortController();
    controllersRef.current.set(key, controller);

    return {
      signal: controller.signal,
      abort: () => {
        controller.abort();
        controllersRef.current.delete(key);
      },
      isAborted: () => controller.signal.aborted,
    };
  };

  const abortRequest = (key: string) => {
    const controller = controllersRef.current.get(key);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(key);
    }
  };

  const abortAll = () => {
    controllersRef.current.forEach((controller) => {
      controller.abort();
    });
    controllersRef.current.clear();
  };

  const isAborted = (key: string) => {
    return controllersRef.current.get(key)?.signal.aborted ?? true;
  };

  return {
    createRequest,
    abortRequest,
    abortAll,
    isAborted,
  };
}
