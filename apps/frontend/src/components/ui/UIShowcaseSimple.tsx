'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '~/core/ui/PageLayout';
import { useSmartBreadcrumb } from '../navigation/BreadcrumbNavigation';

// 动态导入组件以减少bundle大小
const UIShowcaseMain = dynamic(() => import('./UIShowcaseMain'));
const UIShowcaseDemos = dynamic(() => import('./UIShowcaseDemos'));

export default function UIShowcase() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPath, setCurrentPath] = useState('/ui/showcase');
  const { breadcrumbs } = useSmartBreadcrumb(currentPath);

  return (
    <PageLayout
      title="UI Showcase"
      description="Google-Monetize应用组件库展示"
      breadcrumbs={breadcrumbs}
    >
      <div className="space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">UI Component Showcase</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            探索我们构建的完整UI组件库
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              总览
            </button>
            <button
              onClick={() => setActiveTab('components')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'components'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              组件
            </button>
            <button
              onClick={() => setActiveTab('demos')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'demos'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              演示
            </button>
          </div>
        </div>

        {activeTab === 'overview' && <UIShowcaseMain />}
        {activeTab === 'components' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-2">基础组件</h3>
              <p className="text-muted-foreground">按钮、输入框、卡片等</p>
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-2">高级组件</h3>
              <p className="text-muted-foreground">模态框、下拉菜单、表格等</p>
            </div>
          </div>
        )}
        {activeTab === 'demos' && <UIShowcaseDemos />}
      </div>
    </PageLayout>
  );
}