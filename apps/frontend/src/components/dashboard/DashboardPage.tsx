'use client';

import dynamic from 'next/dynamic';

// 动态加载 EnhancedDashboard 以减少初始 bundle 大小
const EnhancedDashboard = dynamic(() => import('./EnhancedDashboard').then(mod => ({ default: mod.EnhancedDashboard })), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading Dashboard...</p>
      </div>
    </div>
  ),
});

export function DashboardPage() {
  return <EnhancedDashboard />;
}