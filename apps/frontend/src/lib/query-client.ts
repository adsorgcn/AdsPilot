import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5分钟的数据保持新鲜
      staleTime: 5 * 60 * 1000,
      // 10分钟后垃圾回收（v5新特性，替代cacheTime）
      gcTime: 10 * 60 * 1000,
      // 失败重试3次
      retry: 3,
      // 重试延迟策略：指数退避
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // 窗口聚焦时不自动重新获取
      refetchOnWindowFocus: false,
      // 重新连接时自动重新获取
      refetchOnReconnect: true,
    },
    mutations: {
      // 变更操作失败重试1次
      retry: 1,
    },
  },
});

// 导出类型以便在其他地方使用
export type QueryClientType = typeof queryClient;