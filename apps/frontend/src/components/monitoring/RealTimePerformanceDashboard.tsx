'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdvancedAnalytics } from '~/core/performance/AdvancedAnalytics';
import { usePerformanceOptimizer } from '~/core/performance/PerformanceOptimizer';
import { useErrorMonitor } from '~/core/monitoring/ErrorMonitor';
import { useAPIOptimizer } from '~/core/api/APIOptimizer';
import { useEdgeCacheManager } from '~/core/cache/EdgeCacheManager';

// 性能指标类型
interface PerformanceMetrics {
  // Web指标
  fcp: number;
  lcp: number;
  cls: number;
  fid: number;

  // 资源指标
  bundleSize: number;
  memoryUsage: number;
  cacheHitRate: number;

  // API指标
  avgApiResponseTime: number;
  apiErrorRate: number;

  // 错误指标
  errorCount: number;
  errorRate: number;

  // 用户交互指标
  interactionCount: number;
  avgInteractionTime: number;

  // 综合评分
  overallScore: number;
}

// 实时数据点
interface DataPoint {
  timestamp: number;
  metrics: PerformanceMetrics;
}

// 仪表板配置
interface DashboardConfig {
  refreshInterval: number; // 毫秒
  maxDataPoints: number;
  enableAlerts: boolean;
  alertThresholds: {
    fcp: number;
    lcp: number;
    cls: number;
    fid: number;
    errorRate: number;
    apiResponseTime: number;
  };
}

const DEFAULT_CONFIG: DashboardConfig = {
  refreshInterval: 2000, // 2秒
  maxDataPoints: 60, // 保存60个数据点（2分钟）
  enableAlerts: true,
  alertThresholds: {
    fcp: 3000,
    lcp: 4000,
    cls: 0.25,
    fid: 300,
    errorRate: 5,
    apiResponseTime: 500,
  },
};

// 实时性能仪表板组件
export function RealTimePerformanceDashboard({
  config = DEFAULT_CONFIG,
  className = ''
}: { config?: Partial<DashboardConfig>; className?: string }) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 获取各种监控数据
  const performanceAnalysis = useAdvancedAnalytics();
  const performanceOptimizer = usePerformanceOptimizer();
  const errorMonitor = useErrorMonitor();
  const apiOptimizer = useAPIOptimizer();
  const edgeCache = useEdgeCacheManager();

  // 状态管理
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Array<{
    type: 'warning' | 'error';
    metric: string;
    value: number;
    threshold: number;
    timestamp: number;
  }>>([]);
  const [isVisible, setIsVisible] = useState(false);

  const alertHistory = useRef<Map<string, number>>(new Map());

  // 收集性能指标
  const collectMetrics = (): PerformanceMetrics => {
    const coreWebVitals = performanceAnalysis.getCoreWebVitals?.();
    const resourceMetrics = performanceAnalysis.getResourceMetrics?.();
    const runtimeMetrics = performanceAnalysis.getRuntimeMetrics?.();
    const perfStats = performanceOptimizer.getMetrics();
    const errorStats = errorMonitor.getErrorStats?.();
    const apiStats = apiOptimizer.getDetailedStats?.();
    const cacheStats = edgeCache.getDetailedStats?.();

    return {
      // Web指标
      fcp: coreWebVitals?.fcp?.value || 0,
      lcp: coreWebVitals?.lcp?.value || 0,
      cls: coreWebVitals?.cls?.value || 0,
      fid: coreWebVitals?.fid?.value || 0,

      // 资源指标
      bundleSize: resourceMetrics?.bundleSize || 0,
      memoryUsage: runtimeMetrics?.memoryUsage || 0,
      cacheHitRate: cacheStats?.hitRate || 0,

      // API指标
      avgApiResponseTime: apiStats?.averageResponseTime || 0,
      apiErrorRate: apiStats ? (apiStats.failedRequests / Math.max(1, apiStats.totalRequests)) * 100 : 0,

      // 错误指标
      errorCount: errorStats?.total || 0,
      errorRate: errorStats ? (errorStats.unresolved / Math.max(1, errorStats.total)) * 100 : 0,

      // 用户交互指标
      interactionCount: perfStats?.userInteractions?.length || 0,
      avgInteractionTime: perfStats?.userInteractions?.length ?
        perfStats.userInteractions.reduce((sum: number, interaction: any) => sum + (interaction.duration || 0), 0) / perfStats.userInteractions.length : 0,

      // 综合评分
      overallScore: 0, // TODO: Calculate based on available metrics
    };
  };

  // 检查警报
  const checkAlerts = (metrics: PerformanceMetrics) => {
    if (!finalConfig.enableAlerts) return;

    const newAlerts: typeof alerts = [];
    const now = Date.now();

    // 检查各项指标是否超过阈值
    const checks = [
      { metric: 'FCP', key: 'fcp', value: metrics.fcp, threshold: finalConfig.alertThresholds.fcp },
      { metric: 'LCP', key: 'lcp', value: metrics.lcp, threshold: finalConfig.alertThresholds.lcp },
      { metric: 'CLS', key: 'cls', value: metrics.cls, threshold: finalConfig.alertThresholds.cls },
      { metric: 'FID', key: 'fid', value: metrics.fid, threshold: finalConfig.alertThresholds.fid },
      { metric: 'Error Rate', key: 'errorRate', value: metrics.errorRate, threshold: finalConfig.alertThresholds.errorRate },
      { metric: 'API Response Time', key: 'apiResponseTime', value: metrics.avgApiResponseTime, threshold: finalConfig.alertThresholds.apiResponseTime },
    ];

    checks.forEach(check => {
      if (check.value > check.threshold) {
        // 防止重复警报（5分钟内相同指标只警报一次）
        const lastAlertTime = alertHistory.current.get(check.key);
        if (!lastAlertTime || now - lastAlertTime > 300000) {
          newAlerts.push({
            type: check.value > check.threshold * 1.5 ? 'error' : 'warning',
            metric: check.metric,
            value: check.value,
            threshold: check.threshold,
            timestamp: now,
          });
          alertHistory.current.set(check.key, now);
        }
      }
    });

    setAlerts(newAlerts);
  };

  // 更新数据
  const updateData = () => {
    try {
      const metrics = collectMetrics();
      const dataPoint: DataPoint = {
        timestamp: Date.now(),
        metrics,
      };

      setCurrentMetrics(metrics);
      checkAlerts(metrics);

      setDataPoints(prev => {
        const newPoints = [...prev, dataPoint];
        // 限制数据点数量
        if (newPoints.length > finalConfig.maxDataPoints) {
          return newPoints.slice(-finalConfig.maxDataPoints);
        }
        return newPoints;
      });
    } catch (error) {
      // 开发环境保留console.error，生产环境会自动移除
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to collect performance metrics:', error);
      }
    }
  };

  // 定期更新数据
  useEffect(() => {
    if (!isVisible) return;

    updateData(); // 立即更新一次
    const interval = setInterval(updateData, finalConfig.refreshInterval);

    return () => clearInterval(interval);
  }, [isVisible, finalConfig.refreshInterval]);

  // 格式化数值
  const formatValue = (value: number, unit: string = '', decimals: number = 0): string => {
    if (value === 0) return `0${unit}`;
    if (value < 0.01) return `<0.01${unit}`;
    return `${value.toFixed(decimals)}${unit}`;
  };

  // 获取状态颜色
  const getStatusColor = (value: number, threshold: number, inverse: boolean = false): string => {
    const isGood = inverse ? value > threshold : value < threshold;
    if (isGood) return 'text-green-600';
    if (value > threshold * 1.5) return 'text-red-600';
    return 'text-yellow-600';
  };

  // 计算趋势
  const getTrend = (metric: keyof PerformanceMetrics): 'up' | 'down' | 'stable' => {
    if (dataPoints.length < 2) return 'stable';

    const recent = dataPoints.slice(-5); // 最近5个数据点
    if (recent.length < 2) return 'stable';

    const first = recent[0].metrics[metric];
    const last = recent[recent.length - 1].metrics[metric];
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'up' : 'down';
  };

  const fcpTrend = getTrend('fcp');
  const lcpTrend = getTrend('lcp');
  const clsTrend = getTrend('cls');
  const fidTrend = getTrend('fid');
  const scoreTrend = getTrend('overallScore');

  // 趋势图标
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>;
      case 'down':
        return <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>;
      default:
        return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
        </svg>;
    }
  };

  if (!currentMetrics) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">正在加载性能数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 控制栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">实时性能监控</h3>
        <div className="flex items-center space-x-4">
          {/* 警报指示器 */}
          {alerts.length > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-600">{alerts.length} 个警报</span>
            </div>
          )}

          <button
            onClick={() => setIsVisible(!isVisible)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            {isVisible ? '暂停监控' : '开始监控'}
          </button>
        </div>
      </div>

      {/* 警报列表 */}
      {alerts.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">性能警报</h4>
          <div className="space-y-1">
            {alerts.slice(0, 3).map((alert, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className={alert.type === 'error' ? 'text-red-800' : 'text-yellow-800'}>
                  {alert.metric}: {formatValue(alert.value)} (阈值: {formatValue(alert.threshold)})
                </span>
                <span className="text-gray-600 text-xs">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {alerts.length > 3 && (
              <div className="text-xs text-gray-600 text-center">
                还有 {alerts.length - 3} 个警报...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 总体评分 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">总体性能评分</h4>
          <div className="flex items-center space-x-2">
            {getTrendIcon(scoreTrend)}
            <span className={`text-2xl font-bold ${
              currentMetrics.overallScore >= 90 ? 'text-green-600' :
              currentMetrics.overallScore >= 75 ? 'text-blue-600' :
              currentMetrics.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {currentMetrics.overallScore}
            </span>
          </div>
        </div>

        {/* 评分历史图表（简化版本） */}
        <div className="h-16 flex items-end space-x-1">
          {dataPoints.slice(-20).map((point, index) => (
            <div
              key={index}
              className="flex-1 bg-blue-200 rounded-t"
              style={{ height: `${(point.metrics.overallScore / 100) * 100}%` }}
              title={`${point.metrics.overallScore} - ${new Date(point.timestamp).toLocaleTimeString()}`}
            />
          ))}
        </div>
      </div>

      {/* 核心Web指标 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h4 className="font-medium text-gray-900 mb-4">核心Web指标</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              {getTrendIcon(fcpTrend)}
              <span className={`text-lg font-semibold ${getStatusColor(currentMetrics.fcp, finalConfig.alertThresholds.fcp)}`}>
                {formatValue(currentMetrics.fcp, 'ms')}
              </span>
            </div>
            <p className="text-sm text-gray-600">FCP</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              {getTrendIcon(lcpTrend)}
              <span className={`text-lg font-semibold ${getStatusColor(currentMetrics.lcp, finalConfig.alertThresholds.lcp)}`}>
                {formatValue(currentMetrics.lcp, 'ms')}
              </span>
            </div>
            <p className="text-sm text-gray-600">LCP</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              {getTrendIcon(clsTrend)}
              <span className={`text-lg font-semibold ${getStatusColor(currentMetrics.cls, finalConfig.alertThresholds.cls)}`}>
                {formatValue(currentMetrics.cls, '', 3)}
              </span>
            </div>
            <p className="text-sm text-gray-600">CLS</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              {getTrendIcon(fidTrend)}
              <span className={`text-lg font-semibold ${getStatusColor(currentMetrics.fid, finalConfig.alertThresholds.fid)}`}>
                {formatValue(currentMetrics.fid, 'ms')}
              </span>
            </div>
            <p className="text-sm text-gray-600">FID</p>
          </div>
        </div>
      </div>

      {/* API和缓存指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h4 className="font-medium text-gray-900 mb-4">API性能</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">平均响应时间</span>
              <span className={`text-sm font-medium ${getStatusColor(currentMetrics.avgApiResponseTime, finalConfig.alertThresholds.apiResponseTime)}`}>
                {formatValue(currentMetrics.avgApiResponseTime, 'ms')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">错误率</span>
              <span className={`text-sm font-medium ${getStatusColor(currentMetrics.apiErrorRate, finalConfig.alertThresholds.errorRate, true)}`}>
                {formatValue(currentMetrics.apiErrorRate, '%', 1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">缓存命中率</span>
              <span className={`text-sm font-medium ${getStatusColor(currentMetrics.cacheHitRate, 80, true)}`}>
                {formatValue(currentMetrics.cacheHitRate, '%', 1)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h4 className="font-medium text-gray-900 mb-4">资源使用</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">内存使用</span>
              <span className="text-sm font-medium text-gray-900">
                {formatValue(currentMetrics.memoryUsage / 1024 / 1024, 'MB', 1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">包大小</span>
              <span className="text-sm font-medium text-gray-900">
                {formatValue(currentMetrics.bundleSize / 1024, 'KB', 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">错误数量</span>
              <span className={`text-sm font-medium ${currentMetrics.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {currentMetrics.errorCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 用户交互指标 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h4 className="font-medium text-gray-900 mb-4">用户交互</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">交互次数</span>
            <span className="text-sm font-medium text-gray-900">{currentMetrics.interactionCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">平均交互时间</span>
            <span className="text-sm font-medium text-gray-900">{formatValue(currentMetrics.avgInteractionTime, 'ms', 1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 迷你性能指示器组件
export function MiniPerformanceIndicator() {
  const { getCoreWebVitals } = useAdvancedAnalytics();
  const [score, setScore] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const coreWebVitals = getCoreWebVitals?.();
      if (coreWebVitals) {
        // Calculate a simple score based on core web vitals status
        const goodCount = Object.values(coreWebVitals).filter((vital: any) => vital.status === 'good').length;
        const score = (goodCount / 4) * 100; // 4 vitals total
        setScore(score);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [getCoreWebVitals]);

  const getStatusColor = (s: number) => {
    if (s >= 90) return 'bg-green-500';
    if (s >= 75) return 'bg-blue-500';
    if (s >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 z-50"
        title="显示性能监控"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 min-w-64">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">性能监控</h4>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">性能评分</span>
            <span className="text-sm font-bold">{score}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${getStatusColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          // 这里可以打开完整仪表板
          if (process.env.NODE_ENV !== 'production') console.log('Open full dashboard');
        }}
        className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        详细报告
      </button>
    </div>
  );
}