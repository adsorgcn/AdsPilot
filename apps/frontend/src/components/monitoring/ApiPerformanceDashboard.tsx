/**
 * API性能监控仪表盘组件
 *
 * 提供实时的API性能指标展示和监控
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Badge from '~/core/ui/Badge';
import Progress from '~/core/ui/Progress';
import { apiMetricsCollector } from '~/lib/api/monitoring/ApiMetrics';
import { globalRequestBatcher } from '~/lib/api/optimization/RequestBatcher';

interface PerformanceMetrics {
  requests: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  endpoints: Array<{
    endpoint: string;
    requests: number;
    avgResponseTime: number;
    successRate: number;
    status: 'healthy' | 'warning' | 'error';
  }>;
  batchMetrics: {
    totalRequests: number;
    mergedRequests: number;
    mergeRate: string;
    batchRate: string;
  };
}

export function ApiPerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // 定期更新指标
  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      const dashboardData = apiMetricsCollector.getPerformanceDashboard();
      const batchMetrics = globalRequestBatcher.getMetrics();

      const processedMetrics: PerformanceMetrics = {
        requests: {
          total: dashboardData.overall.totalRequests,
          success: dashboardData.overall.successRequests,
          failed: dashboardData.overall.errorRequests,
          successRate: dashboardData.overall.successRate,
        },
        responseTime: {
          average: dashboardData.overall.avgResponseTime,
          p95: dashboardData.overall.p95ResponseTime,
          p99: dashboardData.overall.p95ResponseTime,
        },
        endpoints: Object.entries(dashboardData.endpoints)
          .map(([endpoint, stats]) => {
            const status: 'healthy' | 'warning' | 'error' = stats.successRate >= 95 ? 'healthy' :
              stats.successRate >= 80 ? 'warning' : 'error';

            return {
              endpoint,
              requests: stats.totalRequests,
              avgResponseTime: stats.avgResponseTime,
              successRate: stats.successRate,
              status,
            };
          })
          .sort((a, b) => b.requests - a.requests)
          .slice(0, 10),
        batchMetrics: {
          totalRequests: batchMetrics.totalRequests,
          mergedRequests: batchMetrics.mergedRequests,
          mergeRate: batchMetrics.mergeRate,
          batchRate: batchMetrics.batchRate,
        },
      };

      setMetrics(processedMetrics);
    };

    // 立即更新一次
    updateMetrics();

    // 每秒更新一次
    const interval = setInterval(updateMetrics, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // 只在开发环境显示
  if (process.env.NODE_ENV === 'production' && !isVisible) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResponseTimeColor = (time: number) => {
    if (time < 200) return 'text-green-600';
    if (time < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700"
        title="显示API性能监控"
      >
        📊
      </button>
    );
  }

  if (!metrics) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg">
        <div className="text-sm">加载性能指标中...</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-auto bg-white rounded-lg shadow-lg">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">API性能监控</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 总体统计 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">总体统计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>总请求数</span>
              <span className="font-mono">{metrics.requests.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>成功率</span>
              <span className={`font-mono ${metrics.requests.successRate >= 95 ? 'text-green-600' :
                                                 metrics.requests.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                {metrics.requests.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>平均响应时间</span>
              <span className={`font-mono ${getResponseTimeColor(metrics.responseTime.average)}`}>
                {metrics.responseTime.average.toFixed(0)}ms
              </span>
            </div>
            <Progress value={metrics.requests.successRate} className="h-2" />
          </CardContent>
        </Card>

        {/* 批处理指标 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">请求优化</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>批处理合并率</span>
              <Badge variant="secondary">{metrics.batchMetrics.mergeRate}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>批处理效率</span>
              <Badge variant="secondary">{metrics.batchMetrics.batchRate}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>优化请求数</span>
              <span className="font-mono text-green-600">
                {metrics.batchMetrics.mergedRequests}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 响应时间分布 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">响应时间分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>P95</span>
              <span className={`font-mono ${getResponseTimeColor(metrics.responseTime.p95)}`}>
                {metrics.responseTime.p95.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>P99</span>
              <span className={`font-mono ${getResponseTimeColor(metrics.responseTime.p99)}`}>
                {metrics.responseTime.p99.toFixed(0)}ms
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 端点性能 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">端点性能 (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {metrics.endpoints.map((endpoint, index) => (
                <div key={index} className="flex items-center justify-between text-xs p-2 border rounded">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono truncate">{endpoint.endpoint}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${getStatusColor(endpoint.status)}`}>
                        {endpoint.status}
                      </Badge>
                      <span className="text-gray-500">
                        {endpoint.requests} 请求
                      </span>
                      <span className={getResponseTimeColor(endpoint.avgResponseTime)}>
                        {endpoint.avgResponseTime.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                  <div className="ml-2">
                    <span className={`font-mono text-xs ${
                      endpoint.successRate >= 95 ? 'text-green-600' :
                      endpoint.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {endpoint.successRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 开发环境标识 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            开发环境性能监控
          </div>
        )}
      </div>
    </div>
  );
}
