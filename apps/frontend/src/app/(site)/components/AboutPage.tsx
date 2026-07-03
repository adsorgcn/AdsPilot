'use client';

import dynamic from 'next/dynamic';

// 动态导入 About 页面内容，避免客户端组件问题
const AboutPageContent = dynamic(
  () => import('../about/page').then(mod => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => <div className="min-h-screen animate-pulse bg-muted" />
  }
);

export function AboutPage() {
  return <AboutPageContent />;
}