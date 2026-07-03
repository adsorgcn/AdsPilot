import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  /**
   * Refresh interval in milliseconds
   * @default 30000 (30 seconds)
   */
  interval?: number;
  /**
   * Whether to enable auto-refresh
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether to pause refresh when tab is not visible
   * @default true
   */
  pauseWhenHidden?: boolean;
}

/**
 * Hook for automatic data refresh with configurable interval
 *
 * Features:
 * - Configurable refresh interval
 * - Automatically pauses when tab is hidden (optional)
 * - Cleans up on unmount
 * - Supports enabling/disabling
 *
 * @example
 * ```tsx
 * const loadData = useCallback(async () => {
 *   const data = await api.getData();
 *   setData(data);
 * }, []);
 *
 * useAutoRefresh(loadData, { interval: 30000 });
 * ```
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  options: UseAutoRefreshOptions = {},
) {
  const {
    interval = 30000,
    enabled = true,
    pauseWhenHidden = true,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);
  }, [interval]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle visibility change
  useEffect(() => {
    if (!pauseWhenHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        startInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseWhenHidden, startInterval, stopInterval]);

  // Start/stop interval based on enabled state
  useEffect(() => {
    if (enabled) {
      startInterval();
    } else {
      stopInterval();
    }

    return () => {
      stopInterval();
    };
  }, [enabled, startInterval, stopInterval]);
}
