import { create } from 'zustand';

interface LoadingState {
  /**
   * 当前是否有任何加载操作进行中
   */
  isLoading: boolean;

  /**
   * 加载操作的数量（用于支持多个并发加载）
   */
  loadingCount: number;

  /**
   * 加载消息（可选）
   */
  message?: string;

  /**
   * 开始一个加载操作
   * @param message - 可选的加载消息
   */
  startLoading: (message?: string) => void;

  /**
   * 结束一个加载操作
   */
  stopLoading: () => void;

  /**
   * 重置加载状态（清除所有加载操作）
   */
  resetLoading: () => void;
}

/**
 * 全局加载状态管理 Store
 *
 * 使用方式:
 * ```tsx
 * import { useLoadingStore } from '~/lib/stores/useLoadingStore';
 *
 * function MyComponent() {
 *   const { startLoading, stopLoading, isLoading } = useLoadingStore();
 *
 *   const handleAction = async () => {
 *     startLoading('处理中...');
 *     try {
 *       await someAsyncOperation();
 *     } finally {
 *       stopLoading();
 *     }
 *   };
 *
 *   return <div>{isLoading && 'Loading...'}</div>;
 * }
 * ```
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  loadingCount: 0,
  message: undefined,

  startLoading: (message?: string) =>
    set((state) => ({
      loadingCount: state.loadingCount + 1,
      isLoading: true,
      message: message ?? state.message,
    })),

  stopLoading: () =>
    set((state) => {
      const newCount = Math.max(0, state.loadingCount - 1);
      return {
        loadingCount: newCount,
        isLoading: newCount > 0,
        message: newCount === 0 ? undefined : state.message,
      };
    }),

  resetLoading: () =>
    set({
      isLoading: false,
      loadingCount: 0,
      message: undefined,
    }),
}));
