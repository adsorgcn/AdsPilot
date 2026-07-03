'use client';

import React, { useState } from 'react';
import { PageLayout } from '~/core/ui/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/core/ui/tabs';
import { useSmartBreadcrumb } from '../navigation/BreadcrumbNavigation';

export default function UIShowcaseMain() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPath, setCurrentPath] = useState('/dashboard/analytics/reports');
  const { breadcrumbs } = useSmartBreadcrumb(currentPath);

  return (
    <PageLayout
      title="UI Showcase"
      description="展示Google-Monetize应用的组件库和设计系统"
      breadcrumbs={breadcrumbs}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">UI Component Showcase</h1>
          <p className="text-muted-foreground">
            探索我们构建的完整UI组件库
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="components">组件</TabsTrigger>
            <TabsTrigger value="forms">表单</TabsTrigger>
            <TabsTrigger value="charts">图表</TabsTrigger>
            <TabsTrigger value="layouts">布局</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="text-center p-8">
              <h2 className="text-2xl font-semibold mb-4">UI总览</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                完整的UI组件库，包含表格、表单、图表、导航等常用组件
              </p>
            </div>
          </TabsContent>

          <TabsContent value="components" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-2">基础组件</h3>
                <p>按钮、输入框、卡片等基础UI组件</p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-2">高级组件</h3>
                <p>模态框、下拉菜单、数据表格等</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="forms" className="mt-6">
            <div className="text-center p-8">
              <h2 className="text-2xl font-semibold mb-4">表单组件</h2>
              <p className="text-muted-foreground">各种表单组件和验证逻辑</p>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="mt-6">
            <div className="text-center p-8">
              <h2 className="text-2xl font-semibold mb-4">图表组件</h2>
              <p className="text-muted-foreground">数据可视化组件库</p>
            </div>
          </TabsContent>

          <TabsContent value="layouts" className="mt-6">
            <div className="text-center p-8">
              <h2 className="text-2xl font-semibold mb-4">布局组件</h2>
              <p className="text-muted-foreground">页面布局和导航组件</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}