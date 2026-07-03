'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

// ✅ 懒加载增强版仪表盘 - 现代化设计
const EnhancedDashboard = dynamic(
  () => import('~/components/dashboard/EnhancedDashboard').then(mod => ({ default: mod.EnhancedDashboard })),
  {
    loading: () => <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />,
  }
);

export default function DashboardPage() {
  // ✅ 预加载关键组件 - 提升用户体验
  useEffect(() => {
    // 预加载常用的管理页面组件
    const preloadOffers = () => import('~/components/offers/OffersPage');
    const preloadSettings = () => import('~/app/settings/page');

    // 延迟预加载，避免影响首屏渲染
    setTimeout(() => {
      preloadOffers();
      preloadSettings();
    }, 2000);
  }, []);

  return <EnhancedDashboard />;
}