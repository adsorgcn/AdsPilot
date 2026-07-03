'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdvancedPageTransition } from '~/components/animations/AdvancedPageTransition';
import { usePrefetchPages } from './DynamicImports';

// 路由过渡类型
export type RouteTransitionType = 'fade' | 'slide' | 'scale' | 'flip' | 'morph';

// 路由配置接口
interface RouteConfig {
  type: RouteTransitionType;
  duration: number;
  enableLoadingIndicator: boolean;
  preload?: boolean;
}

// 路由映射配置
const ROUTE_CONFIGS: Record<string, RouteConfig> = {
  // 应用主要页面 - 快速过渡
  '/app/offers': { type: 'slide', duration: 0.3, enableLoadingIndicator: false },
  '/app/tasks': { type: 'slide', duration: 0.3, enableLoadingIndicator: false },
  '/app/adscenter': { type: 'slide', duration: 0.3, enableLoadingIndicator: false },
  '/dashboard': { type: 'fade', duration: 0.2, enableLoadingIndicator: false },

  // 管理页面 - 中等过渡
  '/manage': { type: 'scale', duration: 0.4, enableLoadingIndicator: true },
  '/manage/users': { type: 'scale', duration: 0.4, enableLoadingIndicator: true },
  '/manage/analytics': { type: 'flip', duration: 0.5, enableLoadingIndicator: true },
  '/manage/offers': { type: 'flip', duration: 0.5, enableLoadingIndicator: true },
  '/manage/tasks': { type: 'flip', duration: 0.5, enableLoadingIndicator: true },

  // 设置页面 - 稳定过渡
  '/settings': { type: 'fade', duration: 0.3, enableLoadingIndicator: false },
  '/settings/profile': { type: 'fade', duration: 0.3, enableLoadingIndicator: false },
  '/settings/subscription': { type: 'scale', duration: 0.4, enableLoadingIndicator: true },

  // 站点页面 - 创意过渡
  '/': { type: 'morph', duration: 0.8, enableLoadingIndicator: true },
  '/pricing': { type: 'flip', duration: 0.6, enableLoadingIndicator: true },
  '/about': { type: 'scale', duration: 0.5, enableLoadingIndicator: false },
  '/contact': { type: 'fade', duration: 0.3, enableLoadingIndicator: false },

  // 认证页面 - 特殊处理
  '/auth': { type: 'morph', duration: 0.6, enableLoadingIndicator: true },
  '/auth/callback': { type: 'fade', duration: 0.2, enableLoadingIndicator: false },
};

// 路由过渡上下文
interface RouteTransitionContextType {
  currentTransition: RouteTransitionType;
  isTransitioning: boolean;
  setTransitionType: (type: RouteTransitionType) => void;
  preloadRoute: (path: string) => void;
}

const RouteTransitionContext = createContext<RouteTransitionContextType | null>(null);

// 路由过渡提供者组件
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTransition, setCurrentTransition] = useState<RouteTransitionType>('fade');
  const [previousPath, setPreviousPath] = useState(pathname);
  const { prefetchOffers, prefetchTasks, prefetchDashboard } = usePrefetchPages();

  // 获取路由配置
  const getRouteConfig = (path: string): RouteConfig => {
    // 精确匹配
    if (ROUTE_CONFIGS[path]) {
      return ROUTE_CONFIGS[path];
    }

    // 模糊匹配
    const pathKey = Object.keys(ROUTE_CONFIGS).find(key =>
      path.startsWith(key) && (key === '/' || path[key.length] === '/' || path.length === key.length)
    );

    if (pathKey) {
      return ROUTE_CONFIGS[pathKey];
    }

    // 默认配置
    return { type: 'fade', duration: 0.3, enableLoadingIndicator: false };
  };

  // 智能预取路由
  const preloadRoute = (targetPath: string) => {
    const routeConfig = getRouteConfig(targetPath);

    if (!routeConfig.preload) {
      return;
    }

    // 根据路径预取相应组件
    if (targetPath.includes('/offers')) {
      prefetchOffers();
    } else if (targetPath.includes('/tasks')) {
      prefetchTasks();
    } else if (targetPath.includes('/dashboard')) {
      prefetchDashboard();
    }
  };

  // 监听路由变化
  useEffect(() => {
    if (pathname !== previousPath) {
      setIsTransitioning(true);

      const routeConfig = getRouteConfig(pathname);
      setCurrentTransition(routeConfig.type);

      // 过渡结束后重置状态
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPreviousPath(pathname);
      }, routeConfig.duration * 1000);

      return () => clearTimeout(timer);
    }
  }, [pathname, previousPath]);

  // 预取相邻路由
  useEffect(() => {
    const routeConfig = getRouteConfig(pathname);

    // 基于当前路径预取可能的下一个路径
    const prefetchNextRoutes = () => {
      setTimeout(() => {
        if (pathname === '/dashboard') {
          preloadRoute('/app/offers');
          preloadRoute('/app/tasks');
        } else if (pathname === '/app/offers') {
          preloadRoute('/app/tasks');
          preloadRoute('/app/adscenter');
        } else if (pathname === '/app/tasks') {
          preloadRoute('/app/offers');
          preloadRoute('/manage/analytics');
        }
      }, 1500);
    };

    prefetchNextRoutes();
  }, [pathname]);

  const contextValue: RouteTransitionContextType = {
    currentTransition,
    isTransitioning,
    setTransitionType: setCurrentTransition,
    preloadRoute,
  };

  return (
    <RouteTransitionContext.Provider value={contextValue}>
      <AdvancedPageTransition
        type={currentTransition}
        duration={getRouteConfig(pathname).duration}
        enableLoadingIndicator={getRouteConfig(pathname).enableLoadingIndicator}
        className="min-h-screen"
      >
        {children}
      </AdvancedPageTransition>
    </RouteTransitionContext.Provider>
  );
}

// 使用路由过渡的Hook
export function useRouteTransition() {
  const context = useContext(RouteTransitionContext);

  if (!context) {
    throw new Error('useRouteTransition must be used within RouteTransitionProvider');
  }

  return context;
}

// 路由预取Hook
export function useRoutePrefetch() {
  const { preloadRoute } = useRouteTransition();

  return {
    preloadRoute,
    prefetchCommonRoutes: () => {
      // 预取常用路由
      preloadRoute('/app/offers');
      preloadRoute('/app/tasks');
      preloadRoute('/dashboard');
    },
  };
}

// 路由变化监听Hook
export function useRouteChange(callback: (from: string, to: string) => void) {
  const pathname = usePathname();
  const [previousPath, setPreviousPath] = useState(pathname);

  useEffect(() => {
    if (pathname !== previousPath) {
      callback(previousPath, pathname);
      setPreviousPath(pathname);
    }
  }, [pathname, previousPath, callback]);
}

// 路由加载状态Hook
export function useRouteLoadingState() {
  const { isTransitioning } = useRouteTransition();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    const routeConfig = ROUTE_CONFIGS[pathname] || { duration: 0.3 };
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, routeConfig.duration * 1000);

    return () => clearTimeout(timer);
  }, [pathname]);

  return {
    isLoading: isLoading || isTransitioning,
    routeConfig: ROUTE_CONFIGS[pathname] || { type: 'fade', duration: 0.3, enableLoadingIndicator: false },
  };
}