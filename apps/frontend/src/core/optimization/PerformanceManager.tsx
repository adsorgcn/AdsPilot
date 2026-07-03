'use client';

import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useAdvancedAnalytics } from '~/core/performance/AdvancedAnalytics';
import { usePerformanceOptimizer } from '~/core/performance/PerformanceOptimizer';
import { useImageOptimizer } from '~/core/images/ImageOptimizer';
import { usePWAManager } from '~/core/pwa/PWAManager';
import { useEdgeCacheManager } from '~/core/cache/EdgeCacheManager';
import { useAPIOptimizer } from '~/core/api/APIOptimizer';
import { useErrorMonitor } from '~/core/monitoring/ErrorMonitor';
import { useMobileOptimizer } from '~/core/mobile/MobileOptimizer';

// 性能管理器配置
interface PerformanceManagerConfig {
  // 启用的优化模块
  enableAdvancedAnalytics: boolean;
  enablePerformanceOptimizer: boolean;
  enableImageOptimizer: boolean;
  enablePWAManager: boolean;
  enableEdgeCache: boolean;
  enableAPIOptimizer: boolean;
  enableErrorMonitor: boolean;
  enableMobileOptimizer: boolean;

  // 自动优化
  enableAutoOptimization: boolean;
  autoOptimizationInterval: number; // 毫秒

  // 性能目标
  performanceTargets: {
    fcp: number; // 首次内容绘制（毫秒）
    lcp: number; // 最大内容绘制（毫秒）
    cls: number; // 累积布局偏移
    fid: number; // 首次输入延迟（毫秒）
    apiResponseTime: number; // API响应时间（毫秒）
    errorRate: number; // 错误率（百分比）
  };

  // 优化阈值
  optimizationThresholds: {
    memoryUsage: number; // 内存使用（字节）
    cacheHitRate: number; // 缓存命中率（百分比）
    bundleSize: number; // 包大小（字节）
  };
}

// 默认配置
const DEFAULT_CONFIG: PerformanceManagerConfig = {
  enableAdvancedAnalytics: true,
  enablePerformanceOptimizer: true,
  enableImageOptimizer: true,
  enablePWAManager: true,
  enableEdgeCache: true,
  enableAPIOptimizer: true,
  enableErrorMonitor: true,
  enableMobileOptimizer: true,

  enableAutoOptimization: true,
  autoOptimizationInterval: 30000, // 30秒

  performanceTargets: {
    fcp: 1800,
    lcp: 2500,
    cls: 0.1,
    fid: 100,
    apiResponseTime: 200,
    errorRate: 1,
  },

  optimizationThresholds: {
    memoryUsage: 50 * 1024 * 1024, // 50MB
    cacheHitRate: 80,
    bundleSize: 1 * 1024 * 1024, // 1MB
  },
};

// 综合性能报告
interface ComprehensivePerformanceReport {
  // 基础指标
  overallScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;

  // Web指标
  webVitals: {
    fcp: { value: number; target: number; status: 'good' | 'needs-improvement' | 'poor' };
    lcp: { value: number; target: number; status: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; target: number; status: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; target: number; status: 'good' | 'needs-improvement' | 'poor' };
  };

  // 资源指标
  resourceMetrics: {
    bundleSize: { value: number; target: number; status: 'good' | 'warning' | 'critical' };
    memoryUsage: { value: number; target: number; status: 'good' | 'warning' | 'critical' };
    cacheHitRate: { value: number; target: number; status: 'good' | 'warning' | 'critical' };
    imageOptimization: { value: number; status: 'good' | 'warning' | 'critical' };
  };

  // API指标
  apiMetrics: {
    responseTime: { value: number; target: number; status: 'good' | 'warning' | 'critical' };
    errorRate: { value: number; target: number; status: 'good' | 'warning' | 'critical' };
    cacheEfficiency: { value: number; status: 'good' | 'warning' | 'critical' };
  };

  // 错误指标
  errorMetrics: {
    totalErrors: number;
    errorRate: { value: number; target: number; status: 'good' | 'warning' | 'critical' };
    criticalErrors: number;
  };

  // 移动端指标
  mobileMetrics: {
    deviceType: string;
    networkType: string;
    batteryLevel?: number;
    touchOptimization: boolean;
    responsiveDesign: boolean;
  };

  // 优化建议
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: 'performance' | 'accessibility' | 'seo' | 'user-experience';
    title: string;
    description: string;
    expectedImprovement: number; // 预期改进百分比
    implementation: string[];
  }>;

  // 系统状态
  systemStatus: {
    pwaEnabled: boolean;
    serviceWorkerActive: boolean;
    cacheEnabled: boolean;
    monitoringActive: boolean;
  };
}

// 性能管理器上下文
interface PerformanceManagerContextType {
  // 配置
  config: PerformanceManagerConfig;

  // 当前报告
  currentReport: ComprehensivePerformanceReport | null;

  // 历史数据
  historicalData: ComprehensivePerformanceReport[];

  // 操作方法
  generateReport: () => Promise<ComprehensivePerformanceReport>;
  optimizeNow: () => Promise<void>;
  exportReport: (format: 'json' | 'csv' | 'pdf') => Promise<string>;
  clearCache: () => void;
  resetStats: () => void;

  // 状态
  isOptimizing: boolean;
  lastOptimization: number | null;
}

const PerformanceManagerContext = createContext<PerformanceManagerContextType | null>(null);

// 性能管理器提供者组件
export function PerformanceManagerProvider({ children }: { children: ReactNode }) {
  const config = DEFAULT_CONFIG;

  // 获取各个优化模块的数据
  const analytics = useAdvancedAnalytics();
  const optimizer = usePerformanceOptimizer();
  const imageOptimizer = useImageOptimizer();
  const pwaManager = usePWAManager();
  const edgeCache = useEdgeCacheManager();
  const apiOptimizer = useAPIOptimizer();
  const errorMonitor = useErrorMonitor();
  const mobileOptimizer = useMobileOptimizer();

  // 状态
  const [currentReport, setCurrentReport] = useState<ComprehensivePerformanceReport | null>(null);
  const [historicalData, setHistoricalData] = useState<ComprehensivePerformanceReport[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<number | null>(null);

  // 生成综合报告
  const generateReport = useCallback(async (): Promise<ComprehensivePerformanceReport> => {
    const timestamp = Date.now();

    try {
      // 获取分析报告
      const analysisReport = analytics.getPerformanceReport?.();
      const optimizerStats = optimizer.getMetrics();
      const imageStats = imageOptimizer.stats;
      const pwaState = pwaManager.installState;
      const cacheStats = edgeCache.getDetailedStats();
      const apiStats = apiOptimizer.getDetailedStats();
      const errorStats = errorMonitor.getErrorStats?.();
      const mobileState = mobileOptimizer;

      if (!analysisReport) {
        throw new Error('Performance analysis not available');
      }

      // 计算Web指标状态
      const webVitals = {
        fcp: {
          value: analysisReport.coreWebVitals.fcp.value,
          target: config.performanceTargets.fcp,
          status: getMetricStatus(analysisReport.coreWebVitals.fcp.value, config.performanceTargets.fcp),
        },
        lcp: {
          value: analysisReport.coreWebVitals.lcp.value,
          target: config.performanceTargets.lcp,
          status: getMetricStatus(analysisReport.coreWebVitals.lcp.value, config.performanceTargets.lcp),
        },
        cls: {
          value: analysisReport.coreWebVitals.cls.value,
          target: config.performanceTargets.cls,
          status: getMetricStatus(analysisReport.coreWebVitals.cls.value, config.performanceTargets.cls),
        },
        fid: {
          value: analysisReport.coreWebVitals.fid.value,
          target: config.performanceTargets.fid,
          status: getMetricStatus(analysisReport.coreWebVitals.fid.value, config.performanceTargets.fid),
        },
      };

      // 计算资源指标状态
      const resourceMetrics = {
        bundleSize: {
          value: analysisReport.resourceMetrics.bundleSize,
          target: config.optimizationThresholds.bundleSize,
          status: getMetricStatus(analysisReport.resourceMetrics.bundleSize, config.optimizationThresholds.bundleSize),
        },
        memoryUsage: {
          value: analysisReport.runtimeMetrics.memoryUsage,
          target: config.optimizationThresholds.memoryUsage,
          status: getMetricStatus(analysisReport.runtimeMetrics.memoryUsage, config.optimizationThresholds.memoryUsage),
        },
        cacheHitRate: {
          value: cacheStats.hitRate,
          target: config.optimizationThresholds.cacheHitRate,
          status: getMetricStatus(cacheStats.hitRate, config.optimizationThresholds.cacheHitRate),
        },
        imageOptimization: {
          value: imageStats.formatUsage.webp / Math.max(1, Object.values(imageStats.formatUsage).reduce((a, b) => a + b, 0)) * 100,
          status: imageStats.formatUsage.webp > 0 ? 'good' : 'warning',
        },
      };

      // 计算API指标状态
      const apiMetrics = {
        responseTime: {
          value: analysisReport.runtimeMetrics.apiResponseTime,
          target: config.performanceTargets.apiResponseTime,
          status: getMetricStatus(analysisReport.runtimeMetrics.apiResponseTime, config.performanceTargets.apiResponseTime),
        },
        errorRate: {
          value: analysisReport.runtimeMetrics.errorRate,
          target: config.performanceTargets.errorRate,
          status: getMetricStatus(analysisReport.runtimeMetrics.errorRate, config.performanceTargets.errorRate),
        },
        cacheEfficiency: {
          value: apiStats.cachedResponses / Math.max(1, apiStats.totalRequests) * 100,
          status: apiStats.cachedResponses > apiStats.totalRequests * 0.8 ? 'good' : 'warning',
        },
      };

      // 计算错误指标
      const errorMetrics = {
        totalErrors: errorStats?.total || 0,
        errorRate: {
          value: errorStats ? (errorStats.unresolved / Math.max(1, errorStats.total)) * 100 : 0,
          target: config.performanceTargets.errorRate,
          status: errorStats ? getMetricStatus(
            (errorStats.unresolved / Math.max(1, errorStats.total)) * 100,
            config.performanceTargets.errorRate
          ) : 'good',
        },
        criticalErrors: errorStats?.byLevel?.fatal || 0,
      };

      // 移动端指标
      const mobileMetrics = {
        deviceType: mobileState.deviceType,
        networkType: mobileState.networkInfo?.effectiveType || 'unknown',
        batteryLevel: mobileState.batteryInfo?.level,
        touchOptimization: mobileState.config.enableTouchOptimization,
        responsiveDesign: mobileState.config.enableViewportOptimization,
      };

      // 计算综合评分
      const overallScore = calculateOverallScore({
        webVitals,
        resourceMetrics,
        apiMetrics,
        errorMetrics,
      });

      // 计算等级
      const grade = getGrade(overallScore);

      // 生成优化建议
      const recommendations = generateRecommendations({
        webVitals,
        resourceMetrics,
        apiMetrics,
        errorMetrics,
        mobileMetrics,
      });

      // 系统状态
      const systemStatus = {
        pwaEnabled: pwaState.isInstalled || pwaState.isStandalone,
        serviceWorkerActive: pwaManager.swState.activated,
        cacheEnabled: true,
        monitoringActive: true,
      };

      const report: ComprehensivePerformanceReport = {
        overallScore,
        grade,
        timestamp,
        webVitals,
        resourceMetrics,
        apiMetrics,
        errorMetrics,
        mobileMetrics,
        recommendations,
        systemStatus,
      };

      setCurrentReport(report);
      setHistoricalData(prev => {
        const newHistory = [...prev, report];
        return newHistory.slice(-100); // 保留最近100个报告
      });

      return report;
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      throw error;
    }
  }, [
    analytics,
    optimizer,
    imageOptimizer,
    pwaManager,
    edgeCache,
    apiOptimizer,
    errorMonitor,
    mobileOptimizer,
    config,
  ]);

  // 获取指标状态
  const getMetricStatus = (value: number, target: number): 'good' | 'needs-improvement' | 'poor' => {
    if (value <= target) return 'good';
    if (value <= target * 2) return 'needs-improvement';
    return 'poor';
  };

  // 计算综合评分
  const calculateOverallScore = (metrics: {
    webVitals: any;
    resourceMetrics: any;
    apiMetrics: any;
    errorMetrics: any;
  }): number => {
    const webVitalsScore = calculateWebVitalsScore(metrics.webVitals);
    const resourceScore = calculateResourceScore(metrics.resourceMetrics);
    const apiScore = calculateAPIScore(metrics.apiMetrics);
    const errorScore = calculateErrorScore(metrics.errorMetrics);

    return Math.round(
      webVitalsScore * 0.4 +
      resourceScore * 0.25 +
      apiScore * 0.25 +
      errorScore * 0.1
    );
  };

  // 计算Web指标评分
  const calculateWebVitalsScore = (webVitals: any): number => {
    let score = 100;

    if (webVitals.fcp.status === 'needs-improvement') score -= 15;
    if (webVitals.fcp.status === 'poor') score -= 30;
    if (webVitals.lcp.status === 'needs-improvement') score -= 20;
    if (webVitals.lcp.status === 'poor') score -= 40;
    if (webVitals.cls.status === 'needs-improvement') score -= 15;
    if (webVitals.cls.status === 'poor') score -= 25;
    if (webVitals.fid.status === 'needs-improvement') score -= 15;
    if (webVitals.fid.status === 'poor') score -= 30;

    return Math.max(0, score);
  };

  // 计算资源评分
  const calculateResourceScore = (resourceMetrics: any): number => {
    let score = 100;

    if (resourceMetrics.bundleSize.status === 'warning') score -= 10;
    if (resourceMetrics.bundleSize.status === 'critical') score -= 20;
    if (resourceMetrics.memoryUsage.status === 'warning') score -= 10;
    if (resourceMetrics.memoryUsage.status === 'critical') score -= 20;
    if (resourceMetrics.cacheHitRate.status === 'warning') score -= 15;
    if (resourceMetrics.cacheHitRate.status === 'critical') score -= 25;
    if (resourceMetrics.imageOptimization.status === 'warning') score -= 10;
    if (resourceMetrics.imageOptimization.status === 'critical') score -= 15;

    return Math.max(0, score);
  };

  // 计算API评分
  const calculateAPIScore = (apiMetrics: any): number => {
    let score = 100;

    if (apiMetrics.responseTime.status === 'warning') score -= 15;
    if (apiMetrics.responseTime.status === 'critical') score -= 25;
    if (apiMetrics.errorRate.status === 'warning') score -= 15;
    if (apiMetrics.errorRate.status === 'critical') score -= 30;
    if (apiMetrics.cacheEfficiency.status === 'warning') score -= 10;
    if (apiMetrics.cacheEfficiency.status === 'critical') score -= 20;

    return Math.max(0, score);
  };

  // 计算错误评分
  const calculateErrorScore = (errorMetrics: any): number => {
    let score = 100;

    if (errorMetrics.errorRate.status === 'warning') score -= 20;
    if (errorMetrics.errorRate.status === 'critical') score -= 40;
    if (errorMetrics.criticalErrors > 0) score -= 30;
    if (errorMetrics.totalErrors > 10) score -= 10;

    return Math.max(0, score);
  };

  // 获取等级
  const getGrade = (score: number): ComprehensivePerformanceReport['grade'] => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  // 生成优化建议
  const generateRecommendations = (metrics: any): ComprehensivePerformanceReport['recommendations'] => {
  const recommendations: ComprehensivePerformanceReport['recommendations'] = [];

  // Web指标建议
  if (metrics.webVitals.fcp.status !== 'good') {
    recommendations.push({
      priority: metrics.webVitals.fcp.status === 'poor' ? 'critical' : 'high',
      category: 'performance',
      title: '优化首次内容绘制时间',
      description: `当前FCP为${Math.round(metrics.webVitals.fcp.value)}ms，目标为${config.performanceTargets.fcp}ms`,
      expectedImprovement: 25,
      implementation: [
        '移除阻塞渲染的资源',
        '启用服务器端渲染',
        '优化关键资源加载',
        '使用CDN加速',
      ],
    });
  }

  if (metrics.webVitals.lcp.status !== 'good') {
    recommendations.push({
      priority: metrics.webVitals.lcp.status === 'poor' ? 'critical' : 'high',
      category: 'performance',
      title: '优化最大内容绘制时间',
      description: `当前LCP为${Math.round(metrics.webVitals.lcp.value)}ms，目标为${config.performanceTargets.lcp}ms`,
      expectedImprovement: 20,
      implementation: [
        '优化图片加载',
        '预加载关键资源',
        '移除非必要脚本',
        '使用现代图片格式',
      ],
    });
  }

  // API优化建议
  if (metrics.apiMetrics.responseTime.status !== 'good') {
    recommendations.push({
      priority: metrics.apiMetrics.responseTime.status === 'critical' ? 'high' : 'medium',
      category: 'performance',
      title: '优化API响应时间',
      description: `当前API响应时间为${Math.round(metrics.apiMetrics.responseTime.value)}ms，目标为${config.performanceTargets.apiResponseTime}ms`,
      expectedImprovement: 30,
      implementation: [
        '启用API响应缓存',
        '优化数据库查询',
        '使用GraphQL减少数据传输',
        '启用HTTP/2或HTTP/3',
      ],
    });
  }

  // 移动端优化建议
  if (metrics.mobileMetrics.deviceType === 'mobile') {
    if (!metrics.mobileMetrics.touchOptimization) {
      recommendations.push({
        priority: 'medium',
        category: 'user-experience',
        title: '启用移动端触摸优化',
        description: '移动设备建议启用触摸优化以改善用户体验',
        expectedImprovement: 15,
        implementation: [
          '增加触摸目标大小',
          '优化触摸响应延迟',
          '启用触觉反馈',
          '优化滚动性能',
        ],
      });
    }
  }

  return recommendations;
  };

  // 立即优化
  const optimizeNow = useCallback(async (): Promise<void> => {
    setIsOptimizing(true);

    try {
      // 执行各种优化操作
      const optimizations = [
        analytics.runAnalysis?.(),
        edgeCache.cleanupExpiredCache(),
        apiOptimizer.clearCache(),
        optimizer.triggerAutoOptimization('manual'),
      ];

      await Promise.all(optimizations.filter(Boolean));
      setLastOptimization(Date.now());
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  }, [analytics, edgeCache, apiOptimizer, optimizer]);

  // 导出报告
  const exportReport = useCallback(async (format: 'json' | 'csv' | 'pdf'): Promise<string> => {
    const report = currentReport || await generateReport();

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return convertToCSV(report);
      case 'pdf':
        return convertToPDF(report);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }, [currentReport, generateReport]);

  // 转换为CSV
  const convertToCSV = (report: ComprehensivePerformanceReport): string => {
    const headers = [
      'Timestamp',
      'Overall Score',
      'Grade',
      'FCP (ms)',
      'LCP (ms)',
      'CLS',
      'FID (ms)',
      'Bundle Size (MB)',
      'Memory Usage (MB)',
      'Cache Hit Rate (%)',
      'API Response Time (ms)',
      'Error Rate (%)',
      'Total Errors',
    ];

    const row = [
      new Date(report.timestamp).toISOString(),
      report.overallScore,
      report.grade,
      report.webVitals.fcp.value,
      report.webVitals.lcp.value,
      report.webVitals.cls.value,
      report.webVitals.fid.value,
      (report.resourceMetrics.bundleSize.value / 1024 / 1024).toFixed(2),
      (report.resourceMetrics.memoryUsage.value / 1024 / 1024).toFixed(2),
      report.resourceMetrics.cacheHitRate.value.toFixed(1),
      report.apiMetrics.responseTime.value.toFixed(0),
      report.errorMetrics.errorRate.value.toFixed(1),
      report.errorMetrics.totalErrors,
    ];

    return [headers.join(','), row.join(',')].join('\n');
  };

  // 转换为PDF（简化实现）
  const convertToPDF = (report: ComprehensivePerformanceReport): string => {
    // 这里应该使用专门的PDF生成库
    // 为了简化，返回JSON格式的文本
    return JSON.stringify(report, null, 2);
  };

  // 清理缓存
  const clearCache = useCallback(() => {
    apiOptimizer.clearCache();
    edgeCache.clearCache();
    analytics.cleanupExpiredCache?.();
  }, [apiOptimizer, edgeCache, analytics]);

  // 重置统计
  const resetStats = useCallback(() => {
    setCurrentReport(null);
    setHistoricalData([]);
  }, []);

  // 自动优化
  useEffect(() => {
    if (!config.enableAutoOptimization) return;

    const interval = setInterval(async () => {
      try {
        const report = await generateReport();

        // 如果性能评分低于80，自动优化
        if (report.overallScore < 80) {
          await optimizeNow();
        }
      } catch (error) {
        console.error('Auto-optimization failed:', error);
      }
    }, config.autoOptimizationInterval);

    return () => clearInterval(interval);
  }, [config, generateReport, optimizeNow]);

  // 定期生成报告
  useEffect(() => {
    const interval = setInterval(() => {
      generateReport();
    }, 60000); // 每分钟生成一次报告

    return () => clearInterval(interval);
  }, [generateReport]);

  const contextValue: PerformanceManagerContextType = {
    config,
    currentReport,
    historicalData,
    generateReport,
    optimizeNow,
    exportReport,
    clearCache,
    resetStats,
    isOptimizing,
    lastOptimization,
  };

  return (
    <PerformanceManagerContext.Provider value={contextValue}>
      {children}
    </PerformanceManagerContext.Provider>
  );
}

// 使用性能管理器Hook
export function usePerformanceManager() {
  const context = useContext(PerformanceManagerContext);
  if (!context) {
    throw new Error('usePerformanceManager must be used within PerformanceManagerProvider');
  }
  return context;
}

// 性能监控面板组件
export function PerformanceMonitoringPanel({
  enabled = process.env.NODE_ENV === 'development',
  className = ''
}: { enabled?: boolean; className?: string }) {
  const { currentReport, generateReport, optimizeNow, exportReport, isOptimizing } = usePerformanceManager();

  if (!enabled || !currentReport) {
    return null;
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'text-green-600 bg-green-50';
      case 'A': return 'text-green-600 bg-green-50';
      case 'B': return 'text-blue-600 bg-blue-50';
      case 'C': return 'text-yellow-600 bg-yellow-50';
      case 'D': return 'text-orange-600 bg-orange-50';
      case 'F': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      case 'warning': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">性能监控面板</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => generateReport()}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={isOptimizing}
          >
            {isOptimizing ? '分析中...' : '刷新报告'}
          </button>
          <button
            onClick={optimizeNow}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            disabled={isOptimizing}
          >
            {isOptimizing ? '优化中...' : '立即优化'}
          </button>
          <button
            onClick={() => exportReport('json')}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            导出
          </button>
        </div>
      </div>

      {/* 总体评分 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-600">总体评分</h4>
            <p className="text-2xl font-bold">{currentReport.overallScore}</p>
          </div>
          <div className={`px-4 py-2 rounded-lg font-bold text-white ${getGradeColor(currentReport.grade)}`}>
            {currentReport.grade}
          </div>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">FCP</p>
          <p className={`text-lg font-semibold ${getStatusColor(currentReport.webVitals.fcp.status)}`}>
            {Math.round(currentReport.webVitals.fcp.value)}ms
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">LCP</p>
          <p className={`text-lg font-semibold ${getStatusColor(currentReport.webVitals.lcp.status)}`}>
            {Math.round(currentReport.webVitals.lcp.value)}ms
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">CLS</p>
          <p className={`text-lg font-semibold ${getStatusColor(currentReport.webVitals.cls.status)}`}>
            {currentReport.webVitals.cls.value.toFixed(3)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">FID</p>
          <p className={`text-lg font-semibold ${getStatusColor(currentReport.webVitals.fid.status)}`}>
            {Math.round(currentReport.webVitals.fid.value)}ms
          </p>
        </div>
      </div>

      {/* 优化建议 */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">优化建议</h4>
        <div className="space-y-2">
          {currentReport.recommendations.slice(0, 5).map((rec, index) => (
            <div key={index} className={`p-3 border rounded-lg ${
              rec.priority === 'critical' ? 'border-red-200 bg-red-50' :
              rec.priority === 'high' ? 'border-orange-200 bg-orange-50' :
              rec.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-gray-900">{rec.title}</h5>
                  <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                  <p className="text-xs text-green-600 mt-1">
                    预期改进: {rec.expectedImprovement}%
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                  rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {rec.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 系统状态 */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">系统状态</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              currentReport.systemStatus.pwaEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span>PWA</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              currentReport.systemStatus.serviceWorkerActive ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span>Service Worker</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              currentReport.systemStatus.cacheEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span>缓存</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              currentReport.systemStatus.monitoringActive ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <span>监控</span>
          </div>
        </div>
      </div>
    </div>
  );
}