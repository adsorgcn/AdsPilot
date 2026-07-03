'use client';

import { useState, useCallback } from 'react';
import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/core/ui/Card';
import { Button } from '~/core/ui/Button';
import { Badge } from '~/core/ui/Badge';

export default function PerformancePage() {
  const [isOptimizing, setIsOptimizing] = useState(false);

  // TODO: 实现完整的性能监控功能
  const handleGenerateReport = useCallback(async () => {
    setIsOptimizing(true);
    console.log('生成性能报告功能待实现');
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsOptimizing(false);
  }, []);

  const handleOptimizeNow = useCallback(async () => {
    setIsOptimizing(true);
    console.log('性能优化功能待实现');
    // 模拟优化过程
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsOptimizing(false);
  }, []);

  // const handleExportReport = async (format: 'json' | 'csv' | 'pdf') => {
//   console.log(`导出${format}格式报告功能待实现`);
// };

  return (
    <DashboardPageLayout>
      <div className="flex flex-col gap-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">性能监控中心</h1>
            <p className="text-gray-600 mt-2">
              实时监控应用性能，追踪优化效果，确保最佳用户体验
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerateReport}
              disabled={isOptimizing}
              variant="outline"
            >
              {isOptimizing ? '生成中...' : '生成报告'}
            </Button>
            <Button
              onClick={handleOptimizeNow}
              disabled={isOptimizing}
              variant="default"
            >
              {isOptimizing ? '优化中...' : '立即优化'}
            </Button>
          </div>
        </div>

        {/* 性能概览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              性能概览
              <Badge variant="outline">实时</Badge>
            </CardTitle>
            <CardDescription>
              当前应用的关键性能指标
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">A</div>
                <div className="text-sm text-gray-600">整体评分</div>
                <div className="text-xs text-gray-500">性能优秀</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">1.2s</div>
                <div className="text-sm text-gray-600">页面加载时间</div>
                <div className="text-xs text-gray-500">符合标准</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">95</div>
                <div className="text-sm text-gray-600">性能评分</div>
                <div className="text-xs text-gray-500">接近满分</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 功能说明 */}
        <Card>
          <CardHeader>
            <CardTitle>功能说明</CardTitle>
            <CardDescription>
              性能监控中心的主要功能模块
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">实时监控</h3>
                <p className="text-sm text-gray-600">
                  监控页面加载速度、API响应时间、用户体验指标
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">性能分析</h3>
                <p className="text-sm text-gray-600">
                  分析性能瓶颈，提供优化建议和解决方案
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">自动化优化</h3>
                <p className="text-sm text-gray-600">
                  自动应用性能优化策略，提升应用响应速度
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">报告导出</h3>
                <p className="text-sm text-gray-600">
                  生成详细的性能报告，支持多种格式导出
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 开发状态 */}
        <Card>
          <CardHeader>
            <CardTitle>开发状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-100">开发中</Badge>
                <span className="text-sm text-yellow-800">
                  性能监控功能正在开发中，当前显示为演示界面
                </span>
              </div>
              <div className="mt-2 text-xs text-yellow-600">
                待实现功能：实时性能数据采集、性能优化引擎、详细报告生成
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardPageLayout>
  );
}