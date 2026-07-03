'use client';

import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 用户状态接口
interface UserState {
  user: {
    id?: string;
    email?: string;
    subscriptionTier?: string;
    features?: string[];
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  updateUser: (user: Partial<UserState['user']>) => void;
  setAuthLoading: (loading: boolean) => void;
  logout: () => void;
}

// UI状态接口
interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    timestamp: number;
    read: boolean;
  }>;
  loading: {
    global: boolean;
    operations: Record<string, boolean>;
    messages: Record<string, string>;
  };
  setTheme: (theme: UIState['theme']) => void;
  setSidebarOpen: (open: boolean) => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (key: string, loading: boolean, message?: string) => void;
  setGlobalLoading: (loading: boolean, message?: string) => void;
}

// 数据缓存接口
interface DataCache {
  offers: {
    data: any[];
    lastFetched: number;
    isValid: boolean;
  };
  tasks: {
    data: any[];
    lastFetched: number;
    isValid: boolean;
  };
  analytics: {
    data: any;
    lastFetched: number;
    isValid: boolean;
  };
  setCacheData: <T extends keyof DataCache>(
    key: T,
    data: DataCache[T]['data']
  ) => void;
  invalidateCache: <T extends keyof DataCache>(key?: T) => void;
  getCacheAge: <T extends keyof DataCache>(key: T) => number;
  isCacheValid: <T extends keyof DataCache>(key: T, maxAge?: number) => boolean;
}

// 性能监控接口
interface PerformanceState {
  metrics: {
    pageLoadTime: number;
    apiResponseTimes: Record<string, number[]>;
    errorCounts: Record<string, number>;
    userInteractions: Array<{
      type: string;
      timestamp: number;
      duration?: number;
    }>;
  };
  recordPageLoad: (loadTime: number) => void;
  recordApiResponse: (endpoint: string, responseTime: number) => void;
  recordError: (errorType: string) => void;
  recordInteraction: (type: string, duration?: number) => void;
  getMetrics: () => PerformanceState['metrics'];
  clearMetrics: () => void;
}

// 主要状态类型
interface GlobalState extends UserState, UIState, DataCache, PerformanceState {
  // 全局操作
  reset: () => void;
  getState: () => GlobalState;
}

// 创建Zustand Store
const useGlobalStoreBase = create<GlobalState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // 用户状态初始值
        user: null,
        isAuthenticated: false,
        isLoading: false,

        // UI状态初始值
        theme: 'system',
        sidebarOpen: true,
        notifications: [],
        loading: {
          global: false,
          operations: {},
          messages: {},
        },

        // 数据缓存初始值
        offers: { data: [], lastFetched: 0, isValid: false },
        tasks: { data: [], lastFetched: 0, isValid: false },
        analytics: { data: null, lastFetched: 0, isValid: false },

        // 性能监控初始值
        metrics: {
          pageLoadTime: 0,
          apiResponseTimes: {},
          errorCounts: {},
          userInteractions: [],
        },

        // 用户状态操作
        updateUser: (userData) =>
          set((state) => {
            if (userData) {
              state.user = { ...state.user, ...userData };
              state.isAuthenticated = !!userData.id;
            }
          }),

        setAuthLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        logout: () =>
          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            // 保留UI状态但清理敏感数据
            state.offers = { data: [], lastFetched: 0, isValid: false };
            state.tasks = { data: [], lastFetched: 0, isValid: false };
            state.analytics = { data: null, lastFetched: 0, isValid: false };
          }),

        // UI状态操作
        setTheme: (theme) =>
          set((state) => {
            state.theme = theme;
          }),

        setSidebarOpen: (open) =>
          set((state) => {
            state.sidebarOpen = open;
          }),

        addNotification: (notification) =>
          set((state) => {
            const newNotification = {
              ...notification,
              id: Math.random().toString(36).substr(2, 9),
              timestamp: Date.now(),
              read: false,
            };
            state.notifications.unshift(newNotification);

            // 限制通知数量，最多保留50条
            if (state.notifications.length > 50) {
              state.notifications = state.notifications.slice(0, 50);
            }
          }),

        removeNotification: (id) =>
          set((state) => {
            state.notifications = state.notifications.filter(n => n.id !== id);
          }),

        markNotificationRead: (id) =>
          set((state) => {
            const notification = state.notifications.find(n => n.id === id);
            if (notification) {
              notification.read = true;
            }
          }),

        clearNotifications: () =>
          set((state) => {
            state.notifications = [];
          }),

        setLoading: (key, loading, message) =>
          set((state) => {
            state.loading.operations[key] = loading;
            if (message) {
              state.loading.messages[key] = message;
            } else if (!loading) {
              delete state.loading.messages[key];
            }

            // 更新全局加载状态
            const hasActiveOperations = Object.values(state.loading.operations).some(Boolean);
            state.loading.global = hasActiveOperations;
          }),

        setGlobalLoading: (loading, message) =>
          set((state) => {
            state.loading.global = loading;
            if (message) {
              state.loading.messages['global'] = message;
            } else if (!loading) {
              delete state.loading.messages['global'];
            }
          }),

        // 数据缓存操作
        setCacheData: (key, data) =>
          set((state) => {
            state[key].data = data;
            state[key].lastFetched = Date.now();
            state[key].isValid = true;
          }),

        invalidateCache: (key) =>
          set((state) => {
            if (key) {
              state[key].isValid = false;
            } else {
              // 清空所有缓存
              state.offers.isValid = false;
              state.tasks.isValid = false;
              state.analytics.isValid = false;
            }
          }),

        getCacheAge: (key) => {
          const state = get();
          return Date.now() - state[key].lastFetched;
        },

        isCacheValid: (key, maxAge = 5 * 60 * 1000) => { // 默认5分钟缓存
          const state = get();
          const cache = state[key];
          return cache.isValid && (Date.now() - cache.lastFetched) < maxAge;
        },

        // 性能监控操作
        recordPageLoad: (loadTime) =>
          set((state) => {
            state.metrics.pageLoadTime = loadTime;
          }),

        recordApiResponse: (endpoint, responseTime) =>
          set((state) => {
            if (!state.metrics.apiResponseTimes[endpoint]) {
              state.metrics.apiResponseTimes[endpoint] = [];
            }
            state.metrics.apiResponseTimes[endpoint].push(responseTime);

            // 只保留最近100次响应时间
            if (state.metrics.apiResponseTimes[endpoint].length > 100) {
              state.metrics.apiResponseTimes[endpoint] =
                state.metrics.apiResponseTimes[endpoint].slice(-100);
            }
          }),

        recordError: (errorType) =>
          set((state) => {
            state.metrics.errorCounts[errorType] = (state.metrics.errorCounts[errorType] || 0) + 1;
          }),

        recordInteraction: (type, duration) =>
          set((state) => {
            state.metrics.userInteractions.push({
              type,
              timestamp: Date.now(),
              duration,
            });

            // 只保留最近1000次交互
            if (state.metrics.userInteractions.length > 1000) {
              state.metrics.userInteractions =
                state.metrics.userInteractions.slice(-1000);
            }
          }),

        getMetrics: () => {
          return get().metrics;
        },

        clearMetrics: () =>
          set((state) => {
            state.metrics = {
              pageLoadTime: 0,
              apiResponseTimes: {},
              errorCounts: {},
              userInteractions: [],
            };
          }),

        // 全局操作
        reset: () =>
          set((state) => {
            // 重置所有状态到初始值，但保留一些UI状态
            state.user = null;
            state.isAuthenticated = false;
            state.notifications = [];
            state.loading = {
              global: false,
              operations: {},
              messages: {},
            };
            state.offers = { data: [], lastFetched: 0, isValid: false };
            state.tasks = { data: [], lastFetched: 0, isValid: false };
            state.analytics = { data: null, lastFetched: 0, isValid: false };
          }),

        getState: () => get(),
      })),
      {
        name: 'gm-global-state',
        partialize: (state) => ({
          // 只持久化部分状态
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          notifications: state.notifications.filter(n => !n.read).slice(0, 10), // 只保存未读的前10条通知
        }),
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    )
  )
);

// 全局状态上下文
const GlobalStateContext = createContext<ReturnType<typeof useGlobalStoreBase> | null>(null);

// 全局状态提供者组件
export function GlobalStateProvider({ children }: { children: ReactNode }) {
  const store = useGlobalStoreBase;

  // 性能监控：页面加载时间
  useEffect(() => {
    const handleLoad = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const loadTime = navigation.loadEventEnd - navigation.fetchStart;
      store.getState().recordPageLoad(loadTime);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [store]);

  // 监听在线状态
  useEffect(() => {
    const handleOnline = () => {
      store.getState().addNotification({
        type: 'success',
        title: '网络连接已恢复',
      });
    };

    const handleOffline = () => {
      store.getState().addNotification({
        type: 'warning',
        title: '网络连接已断开',
        message: '某些功能可能无法正常使用',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [store]);

  return (
    <GlobalStateContext.Provider value={store}>
      {children}
    </GlobalStateContext.Provider>
  );
}

// 使用全局状态的Hook
export function useGlobalState() {
  const store = useContext(GlobalStateContext);
  if (!store) {
    throw new Error('useGlobalState must be used within GlobalStateProvider');
  }
  return store;
}

// 便捷的状态选择器Hooks
export function useUserState() {
  return useGlobalState((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    updateUser: state.updateUser,
    setAuthLoading: state.setAuthLoading,
    logout: state.logout,
  }));
}

export function useUIState() {
  return useGlobalState((state) => ({
    theme: state.theme,
    sidebarOpen: state.sidebarOpen,
    notifications: state.notifications,
    loading: state.loading,
    setTheme: state.setTheme,
    setSidebarOpen: state.setSidebarOpen,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    markNotificationRead: state.markNotificationRead,
    clearNotifications: state.clearNotifications,
    setLoading: state.setLoading,
    setGlobalLoading: state.setGlobalLoading,
  }));
}

export function useDataCache() {
  return useGlobalState((state) => ({
    offers: state.offers,
    tasks: state.tasks,
    analytics: state.analytics,
    setCacheData: state.setCacheData,
    invalidateCache: state.invalidateCache,
    getCacheAge: state.getCacheAge,
    isCacheValid: state.isCacheValid,
  }));
}

export function usePerformanceMetrics() {
  return useGlobalState((state) => ({
    metrics: state.metrics,
    recordPageLoad: state.recordPageLoad,
    recordApiResponse: state.recordApiResponse,
    recordError: state.recordError,
    recordInteraction: state.recordInteraction,
    getMetrics: state.getMetrics,
    clearMetrics: state.clearMetrics,
  }));
}

// 全局状态工具函数
export const globalStateUtils = {
  // 获取当前状态快照
  getSnapshot: () => useGlobalStoreBase.getState(),

  // 订阅状态变化
  subscribe: (listener: (state: GlobalState) => void) =>
    useGlobalStoreBase.subscribe(listener),

  // 批量更新状态
  batchUpdate: (updates: Partial<GlobalState>) => {
    const state = useGlobalStoreBase.getState();
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof (state as any)[key] === 'function') {
        (state as any)[key](value);
      }
    });
  },
};