import { useEffect, useState } from 'react';

/**
 * useDebounce Hook
 *
 * 对值进行防抖处理，延迟更新直到用户停止输入指定时间。
 * 常用于搜索输入框、过滤器等场景，避免频繁触发 API 请求。
 *
 * @param value - 需要防抖的值
 * @param delay - 延迟时间（毫秒），默认 500ms
 * @returns 防抖后的值
 *
 * @example
 * ```typescript
 * function SearchComponent() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 *   useEffect(() => {
 *     if (debouncedSearchTerm) {
 *       // 仅在用户停止输入 300ms 后才发送请求
 *       fetchSearchResults(debouncedSearchTerm);
 *     }
 *   }, [debouncedSearchTerm]);
 *
 *   return (
 *     <input
 *       value={searchTerm}
 *       onChange={(e) => setSearchTerm(e.target.value)}
 *       placeholder="搜索..."
 *     />
 *   );
 * }
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 设置定时器，在延迟后更新防抖值
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清理函数：当 value 或 delay 改变时，清除上一个定时器
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback Hook
 *
 * 对回调函数进行防抖处理，确保函数在指定延迟内只执行一次。
 *
 * @param callback - 需要防抖的回调函数
 * @param delay - 延迟时间（毫秒），默认 500ms
 * @returns 防抖后的回调函数
 *
 * @example
 * ```typescript
 * function FormComponent() {
 *   const debouncedSave = useDebouncedCallback(
 *     (data) => {
 *       saveToServer(data);
 *     },
 *     1000
 *   );
 *
 *   return (
 *     <input
 *       onChange={(e) => debouncedSave(e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500,
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };
}
