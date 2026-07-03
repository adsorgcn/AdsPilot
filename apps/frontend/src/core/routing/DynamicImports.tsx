'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { PageLoadingIndicator } from '~/core/ui/PageLoadingIndicator';

// 懒加载组件的加载状态
const DefaultLoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <PageLoadingIndicator />
  </div>
);

// 页面级加载状态
const PageLoadingFallback = () => (
  <div className="flex h-96 w-full items-center justify-center rounded-lg border bg-muted/50">
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  </div>
);

// 卡片级加载状态
const CardLoadingFallback = () => (
  <div className="animate-pulse rounded-lg border bg-muted p-6">
    <div className="space-y-4">
      <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
      <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
      <div className="h-20 w-full rounded bg-muted-foreground/10" />
    </div>
  </div>
);

// 动态导入配置选项
interface DynamicImportOptions {
  loading?: 'default' | 'page' | 'card' | 'none';
  preload?: boolean;
  ssr?: boolean;
}

// 统一的动态导入HOC
export function createDynamicComponent<T extends Record<string, any>>(
  importFunc: () => Promise<{ default: T }>,
  options: DynamicImportOptions = {}
) {
  const {
    loading = 'default',
    preload = false,
    ssr = false
  } = options;

  // 选择加载组件
  const getLoadingComponent = () => {
    switch (loading) {
      case 'page':
        return <PageLoadingFallback />;
      case 'card':
        return <CardLoadingFallback />;
      case 'none':
        return <div />;
      default:
        return <DefaultLoadingFallback />;
    }
  };

  // 创建动态组件
  const DynamicComponent = dynamic(importFunc, {
    loading: getLoadingComponent,
    ssr,
  });

  // 预加载逻辑
  if (preload && typeof window !== 'undefined') {
    // 延迟预取，避免影响初始加载
    setTimeout(() => {
      importFunc();
    }, 2000);
  }

  return DynamicComponent;
}

// 预定义的动态组件导入

// 应用核心页面
// 应用核心页面
export const DynamicOffersPage = createDynamicComponent(
  () => import('~/components/offers/EnhancedOffersPage').then(mod => ({ default: mod.EnhancedOffersPage })),
  { loading: 'page', preload: true }
);

export const DynamicTasksPage = createDynamicComponent(
  () => import('~/components/tasks/EnhancedTasksPage').then(mod => ({ default: mod.EnhancedTasksPage })),
  { loading: 'page', preload: true }
);

export const DynamicAdsCenterPage = createDynamicComponent(
  () => import('~/components/ads-center/EnhancedAdsCenterPage').then(mod => ({ default: mod.EnhancedAdsCenterPage })),
  { loading: 'page', preload: false }
);

export const DynamicDashboardPage = createDynamicComponent(
  () => import('~/components/dashboard/DashboardPage').then(mod => ({ default: mod.DashboardPage })),
  { loading: 'page', preload: true }
);

// 注意：不动态导入带有 metadata 的页面组件
// 这些页面应该保持为服务器组件，通过 Next.js 路由系统直接访问
// 如果需要懒加载，应该在页面内部懒加载组件，而不是整个页面

// 管理页面 - 保持为服务器组件，通过路由直接访问
// export const DynamicManageUsersPage = ... (已移除)
// export const DynamicManageAnalyticsPage = ... (已移除)

// 设置页面 - 保持为服务器组件，通过路由直接访问
// export const DynamicSettingsProfilePage = ... (已移除)
// export const DynamicSettingsSubscriptionPage = ... (已移除)

// 站点页面
export const DynamicLandingPage = createDynamicComponent(
  () => import('~/app/(site)/LandingPageClient').then(mod => ({ default: mod.LandingPageClient })),
  { loading: 'default', ssr: true }
);

// Pricing 页面 - 保持为服务器组件，通过路由直接访问
// export const DynamicPricingPage = ... (已移除)

// About 页面 - 不能动态导入，因为有 metadata
// export const DynamicAboutPage = createDynamicComponent(
//   () => import('~/app/(site)/components/AboutPage').then(mod => ({ default: mod.AboutPage })),
//   { loading: 'page', preload: false }
// );

// 组件级的懒加载
export const DynamicChartComponent = createDynamicComponent(
  () => import('~/components/charts/RevenueChart').then(mod => ({ default: mod.RevenueChart })),
  { loading: 'card', preload: false }
);

export const DynamicDataTable = createDynamicComponent(
  () => import('~/components/ui/DataTable').then(mod => ({ default: mod.default })),
  { loading: 'card', preload: false }
);

// 智能预取Hook
export function usePrefetchPages() {
  const prefetchPage = (importFunc: () => Promise<{ default: any }>) => {
    if (typeof window !== 'undefined') {
      // 在空闲时间预取
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          importFunc();
        });
      } else {
        setTimeout(() => {
          importFunc();
        }, 3000);
      }
    }
  };

  return {
    prefetchOffers: () => prefetchPage(() => import('~/components/offers/EnhancedOffersPage')),
    prefetchTasks: () => prefetchPage(() => import('~/components/tasks/EnhancedTasksPage')),
    prefetchDashboard: () => prefetchPage(() => import('~/components/dashboard/DashboardPage')),
    // 不预取带有 metadata 的页面组件
    // prefetchManageUsers: () => prefetchPage(() => import('~/app/manage/users/page')),
    // prefetchAnalytics: () => prefetchPage(() => import('~/app/manage/analytics/page')),
  };
}

// 预取策略配置
export const PREFETCH_STRATEGIES = {
  // 立即预取：用户最可能访问的页面
  immediate: ['dashboard', 'offers'],
  // 空闲时预取：次要重要页面
  idle: ['tasks', 'analytics'],
  // 鼠标悬停预取：导航链接
  hover: ['manage-users', 'settings'],
  // 不预取：低频访问页面
  none: ['admin', 'debug'],
} as const;

// 批量预取函数
export function prefetchPageSet(strategy: keyof typeof PREFETCH_STRATEGIES) {
  const pages = PREFETCH_STRATEGIES[strategy];

  const prefetchMap = {
    'dashboard': () => {
      // 直接调用动态导入，不使用 Hook
      import('~/components/dashboard/DashboardPage');
    },
    'offers': () => {
      import('~/components/offers/EnhancedOffersPage');
    },
    'tasks': () => {
      import('~/components/tasks/EnhancedTasksPage');
    },
    // 'analytics': 已移除，因为有 metadata
  };

  // 根据策略延迟预取
  const delays = {
    immediate: 0,
    idle: 2000,
    hover: 100,
  };

  setTimeout(() => {
    pages.forEach(page => {
      const prefetchFn = prefetchMap[page as keyof typeof prefetchMap];
      if (prefetchFn) {
        prefetchFn();
      }
    });
  }, delays[strategy] || 1000);
}