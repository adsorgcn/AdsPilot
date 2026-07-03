import { useCallback } from 'react';
import { useLoadingStore } from './useLoadingStore';

/**
 * Hook 封装：自动管理加载状态的异步操作
 *
 * 使用方式:
 * ```tsx
 * import { useLoadingWithAction } from '~/lib/stores/useLoadingWithAction';
 *
 * function MyComponent() {
 *   const handleSave = useLoadingWithAction(async () => {
 *     await api.save();
 *   }, '保存中...');
 *
 *   return <button onClick={handleSave}>保存</button>;
 * }
 * ```
 *
 * @param action - 异步操作函数
 * @param message - 加载消息（可选）
 * @returns 包装后的函数，自动管理加载状态
 */
export function useLoadingWithAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  message?: string,
): T {
  const { startLoading, stopLoading } = useLoadingStore();

  return useCallback(
    (async (...args: Parameters<T>) => {
      startLoading(message);
      try {
        return await action(...args);
      } finally {
        stopLoading();
      }
    }) as T,
    [action, message, startLoading, stopLoading],
  );
}

/**
 * Hook 封装：返回一个执行异步操作并管理加载状态的函数
 *
 * 区别于 useLoadingWithAction，此 hook 返回的函数会在内部调用传入的 action
 *
 * 使用方式:
 * ```tsx
 * import { useLoadingAction } from '~/lib/stores/useLoadingWithAction';
 *
 * function MyComponent() {
 *   const executeWithLoading = useLoadingAction();
 *
 *   const handleSave = () => {
 *     executeWithLoading(
 *       async () => {
 *         await api.save();
 *       },
 *       '保存中...'
 *     );
 *   };
 *
 *   return <button onClick={handleSave}>保存</button>;
 * }
 * ```
 */
export function useLoadingAction() {
  const { startLoading, stopLoading } = useLoadingStore();

  return useCallback(
    async <T>(action: () => Promise<T>, message?: string): Promise<T> => {
      startLoading(message);
      try {
        return await action();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );
}
