'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
// 动态导入framer-motion以减少bundle大小
const motion = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.motion })),
  { ssr: false }
);

const { AnimatePresence } = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.AnimatePresence })),
  { ssr: false }
);

import {
  ChartBarIcon,
  CpuChipIcon,
  MemoryChipIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ServerIcon,
  EyeIcon,
  DevicePhoneMobileIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// Core Web Vitals 阈值
const CWV_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint (ms)
  FID: { good: 100, needsImprovement: 300 },    // First Input Delay (ms)
  CLS: { good: 0.1, needsImprovement: 0.25 },   // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 },  // First Contentful Paint (ms)
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte (ms)
  INP: { good: 200, needsImprovement: 500 },   // Interaction to Next Paint (ms)
};

interface MetricEntry {
  name: string;
  value: number;
  threshold: { good: number; needsImprovement: number };
  unit: string;
  description: string;
}

interface PerformanceMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  inp?: number;
  domContentLoaded?: number;
  loadComplete?: number;
  firstPaint?: number;
  memoryUsage?: MemoryMetrics;
}

interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  pressure?: 'low' | 'medium' | 'high';
}

interface NetworkInfo {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  cookieEnabled: boolean;
  onLine: boolean;
  hardwareConcurrency: number;
  deviceMemory: number;
  screenResolution: string;
  colorDepth: number;
}

// 性能监控 Hook
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const observerRef = useRef<PerformanceObserver | null>(null);

  const getNetworkInfo = useCallback((): NetworkInfo | null => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      };
    }
    return null;
  }, []);

  const getDeviceInfo = useCallback((): DeviceInfo => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
    };
  }, []);

  const getMemoryUsage = useCallback((): MemoryMetrics | undefined => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      let pressure: 'low' | 'medium' | 'high' = 'low';

      if (usedRatio > 0.8) pressure = 'high';
      else if (usedRatio > 0.6) pressure = 'medium';

      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        pressure,
      };
    }
    return undefined;
  }, []);

  const observeWebVitals = useCallback(() => {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const newMetrics: Partial<PerformanceMetrics> = {};

          switch (entry.entryType) {
            case 'largest-contentful-paint':
              newMetrics.lcp = entry.startTime;
              break;
            case 'first-input':
              newMetrics.fid = (entry as any).processingStart - entry.startTime;
              break;
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                newMetrics.cls = (entry as any).value;
              }
              break;
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                newMetrics.fcp = entry.startTime;
              } else if (entry.name === 'first-paint') {
                newMetrics.firstPaint = entry.startTime;
              }
              break;
            case 'navigation':
              const navEntry = entry as PerformanceNavigationTiming;
              newMetrics.ttfb = navEntry.responseStart - navEntry.requestStart;
              newMetrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.navigationStart;
              newMetrics.loadComplete = navEntry.loadEventEnd - navEntry.navigationStart;
              break;
            case 'interaction':
              newMetrics.inp = (entry as any).processingStart - entry.startTime;
              break;
          }

          if (Object.keys(newMetrics).length > 0) {
            setMetrics(prev => ({ ...prev, ...newMetrics }));
          }
        }
      });

      observer.observe({
        entryTypes: [
          'largest-contentful-paint',
          'first-input',
          'layout-shift',
          'paint',
          'navigation',
          'interaction'
        ],
      });

      observerRef.current = observer;
    } catch (error) {
      console.warn('Performance monitoring not fully supported:', error);
    }
  }, []);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    observeWebVitals();
    setNetworkInfo(getNetworkInfo());
    setDeviceInfo(getDeviceInfo());

    // 定期更新内存使用情况
    const memoryInterval = setInterval(() => {
      const memory = getMemoryUsage();
      if (memory) {
        setMetrics(prev => ({ ...prev, memoryUsage: memory }));
      }
    }, 2000);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      clearInterval(memoryInterval);
    };
  }, [observeWebVitals, getNetworkInfo, getDeviceInfo, getMemoryUsage]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      return startMonitoring();
    }
  }, [isMonitoring, startMonitoring]);

  return {
    metrics,
    isMonitoring,
    networkInfo,
    deviceInfo,
    startMonitoring: () => setIsMonitoring(true),
    stopMonitoring,
    refreshMemory: () => {
      const memory = getMemoryUsage();
      if (memory) {
        setMetrics(prev => ({ ...prev, memoryUsage: memory }));
      }
    },
  };
};

// 性能评分计算
export const calculatePerformanceScore = (metrics: PerformanceMetrics): number => {
  const scores: number[] = [];

  const metricEntries: MetricEntry[] = [
    {
      name: 'LCP',
      value: metrics.lcp || 0,
      threshold: CWV_THRESHOLDS.LCP,
      unit: 'ms',
      description: 'Largest Contentful Paint'
    },
    {
      name: 'FID',
      value: metrics.fid || 0,
      threshold: CWV_THRESHOLDS.FID,
      unit: 'ms',
      description: 'First Input Delay'
    },
    {
      name: 'CLS',
      value: metrics.cls || 0,
      threshold: CWV_THRESHOLDS.CLS,
      unit: '',
      description: 'Cumulative Layout Shift'
    },
    {
      name: 'FCP',
      value: metrics.fcp || 0,
      threshold: CWV_THRESHOLDS.FCP,
      unit: 'ms',
      description: 'First Contentful Paint'
    },
    {
      name: 'TTFB',
      value: metrics.ttfb || 0,
      threshold: CWV_THRESHOLDS.TTFB,
      unit: 'ms',
      description: 'Time to First Byte'
    },
    {
      name: 'INP',
      value: metrics.inp || 0,
      threshold: CWV_THRESHOLDS.INP,
      unit: 'ms',
      description: 'Interaction to Next Paint'
    },
  ];

  metricEntries.forEach(metric => {
    if (metric.value > 0) {
      let score = 100;
      if (metric.value >= metric.threshold.needsImprovement) {
        score = 0;
      } else if (metric.value >= metric.threshold.good) {
        const ratio = (metric.value - metric.threshold.good) /
                     (metric.threshold.needsImprovement - metric.threshold.good);
        score = Math.round(100 * (1 - ratio));
      }
      scores.push(score);
    }
  });

  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
};

// 单个指标组件
interface MetricCardProps {
  metric: MetricEntry;
  value: number | undefined;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, value, className = '' }) => {
  if (!value) return null;

  const getStatus = () => {
    if (value <= metric.threshold.good) return 'good';
    if (value <= metric.threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  };

  const status = getStatus();
  const score = status === 'good' ? 100 :
               status === 'needs-improvement' ? 50 : 0;

  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    'needs-improvement': 'text-yellow-600 bg-yellow-50 border-yellow-200',
    poor: 'text-red-600 bg-red-50 border-red-200'
  };

  const statusIcons = {
    good: <CheckCircleIcon className="w-5 h-5" />,
    'needs-improvement': <ExclamationTriangleIcon className="w-5 h-5" />,
    poor: <ExclamationTriangleIcon className="w-5 h-5" />
  };

  return (
    <motion.div
      className={cn(
        'p-4 rounded-lg border-2 transition-all duration-300',
        statusColors[status],
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {statusIcons[status]}
            <h4 className="font-semibold text-gray-900">{metric.name}</h4>
          </div>
          <p className="text-sm text-gray-600 mb-1">{metric.description}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {metric.name === 'CLS' ? value.toFixed(3) : Math.round(value)}
            </span>
            <span className="text-sm text-gray-500">{metric.unit}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-600">Score</div>
          <div className="text-xl font-bold text-gray-900">{score}</div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className={cn(
              'h-2 rounded-full',
              status === 'good' ? 'bg-green-500' :
              status === 'needs-improvement' ? 'bg-yellow-500' : 'bg-red-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

// 主要性能监控组件
interface PerformanceMonitorProps {
  className?: string;
  showDetails?: boolean;
  autoStart?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  className = '',
  showDetails = true,
  autoStart = true,
}) => {
  const {
    metrics,
    isMonitoring,
    networkInfo,
    deviceInfo,
    startMonitoring,
    stopMonitoring,
    refreshMemory,
  } = usePerformanceMonitor();

  const overallScore = calculatePerformanceScore(metrics);

  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }
  }, [autoStart, startMonitoring]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 标题和控制 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChartBarIcon className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Performance Monitor</h2>
          <div className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            getScoreColor(overallScore)
          )}>
            {getScoreGrade(overallScore)} - {overallScore}/100
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={refreshMemory}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MemoryChipIcon className="w-4 h-4 inline mr-2" />
            Refresh Memory
          </motion.button>
          <motion.button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={cn(
              'px-4 py-2 rounded-lg transition-colors',
              isMonitoring
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isMonitoring ? (
              <>
                <ExclamationTriangleIcon className="w-4 h-4 inline mr-2" />
                Stop
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4 inline mr-2" />
                Start
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 总体评分 */}
      <motion.div
        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">Overall Performance Score</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">{overallScore}</span>
              <span className="text-lg opacity-80">/ 100</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-6xl font-bold">{getScoreGrade(overallScore)}</div>
            <div className="text-sm opacity-80">Grade</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-white/20 rounded-full h-3">
            <motion.div
              className="bg-white rounded-full h-3"
              initial={{ width: 0 }}
              animate={{ width: `${overallScore}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          metric={{
            name: 'LCP',
            value: metrics.lcp,
            threshold: CWV_THRESHOLDS.LCP,
            unit: 'ms',
            description: 'Largest Contentful Paint'
          }}
        />
        <MetricCard
          metric={{
            name: 'FID',
            value: metrics.fid,
            threshold: CWV_THRESHOLDS.FID,
            unit: 'ms',
            description: 'First Input Delay'
          }}
        />
        <MetricCard
          metric={{
            name: 'CLS',
            value: metrics.cls,
            threshold: CWV_THRESHOLDS.CLS,
            unit: '',
            description: 'Cumulative Layout Shift'
          }}
        />
        <MetricCard
          metric={{
            name: 'FCP',
            value: metrics.fcp,
            threshold: CWV_THRESHOLDS.FCP,
            unit: 'ms',
            description: 'First Contentful Paint'
          }}
        />
        <MetricCard
          metric={{
            name: 'TTFB',
            value: metrics.ttfb,
            threshold: CWV_THRESHOLDS.TTFB,
            unit: 'ms',
            description: 'Time to First Byte'
          }}
        />
        <MetricCard
          metric={{
            name: 'INP',
            value: metrics.inp,
            threshold: CWV_THRESHOLDS.INP,
            unit: 'ms',
            description: 'Interaction to Next Paint'
          }}
        />
      </div>

      {showDetails && (
        <>
          {/* 内存使用情况 */}
          {metrics.memoryUsage && (
            <motion.div
              className="bg-gray-50 rounded-lg p-6 border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MemoryChipIcon className="w-5 h-5" />
                Memory Usage
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  metrics.memoryUsage.pressure === 'high' ? 'bg-red-100 text-red-700' :
                  metrics.memoryUsage.pressure === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                )}>
                  {metrics.memoryUsage.pressure?.toUpperCase()}
                </span>
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Used JS Heap Size</span>
                  <span className="font-medium">{formatBytes(metrics.memoryUsage.usedJSHeapSize)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total JS Heap Size</span>
                  <span className="font-medium">{formatBytes(metrics.memoryUsage.totalJSHeapSize)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">JS Heap Size Limit</span>
                  <span className="font-medium">{formatBytes(metrics.memoryUsage.jsHeapSizeLimit)}</span>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div
                      className={cn(
                        'h-2 rounded-full',
                        metrics.memoryUsage.pressure === 'high' ? 'bg-red-500' :
                        metrics.memoryUsage.pressure === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      )}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100}%`
                      }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round((metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100)}% of limit
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 网络信息 */}
          {networkInfo && (
            <motion.div
              className="bg-gray-50 rounded-lg p-6 border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ServerIcon className="w-5 h-5" />
                Network Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Connection Type</div>
                  <div className="font-medium capitalize">{networkInfo.effectiveType}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Downlink</div>
                  <div className="font-medium">{networkInfo.downlink} Mbps</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">RTT</div>
                  <div className="font-medium">{networkInfo.rtt} ms</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Data Saver</div>
                  <div className="font-medium">{networkInfo.saveData ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 设备信息 */}
          {deviceInfo && (
            <motion.div
              className="bg-gray-50 rounded-lg p-6 border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DevicePhoneMobileIcon className="w-5 h-5" />
                Device Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Platform</div>
                  <div className="font-medium">{deviceInfo.platform}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">CPU Cores</div>
                  <div className="font-medium">{deviceInfo.hardwareConcurrency}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Device Memory</div>
                  <div className="font-medium">{deviceInfo.deviceMemory} GB</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Screen Resolution</div>
                  <div className="font-medium">{deviceInfo.screenResolution}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Color Depth</div>
                  <div className="font-medium">{deviceInfo.colorDepth} bit</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Language</div>
                  <div className="font-medium">{deviceInfo.language}</div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* 监控状态 */}
      <div className="text-center text-sm text-gray-500">
        {isMonitoring ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Monitoring Active
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            Monitoring Paused
          </span>
        )}
      </div>
    </div>
  );
};

// 性能优化建议组件
interface OptimizationSuggestion {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
}

export const PerformanceOptimizer: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
  const suggestions: OptimizationSuggestion[] = [];

  // LCP 优化建议
  if (metrics.lcp && metrics.lcp > CWV_THRESHOLDS.LCP.good) {
    suggestions.push({
      category: 'Loading Performance',
      priority: metrics.lcp > CWV_THRESHOLDS.LCP.needsImprovement ? 'high' : 'medium',
      title: 'Optimize Largest Contentful Paint',
      description: 'Reduce server response time, optimize images, use CDN, remove render-blocking resources',
      impact: 'Improves perceived loading speed and user experience'
    });
  }

  // FID 优化建议
  if (metrics.fid && metrics.fid > CWV_THRESHOLDS.FID.good) {
    suggestions.push({
      category: 'Interactivity',
      priority: metrics.fid > CWV_THRESHOLDS.FID.needsImprovement ? 'high' : 'medium',
      title: 'Reduce First Input Delay',
      description: 'Minimize main thread work, reduce JavaScript execution time, use web workers',
      impact: 'Improves responsiveness to user interactions'
    });
  }

  // CLS 优化建议
  if (metrics.cls && metrics.cls > CWV_THRESHOLDS.CLS.good) {
    suggestions.push({
      category: 'Visual Stability',
      priority: metrics.cls > CWV_THRESHOLDS.CLS.needsImprovement ? 'high' : 'medium',
      title: 'Reduce Cumulative Layout Shift',
      description: 'Include size attributes for images and videos, avoid inserting content above existing content',
      impact: 'Prevents unexpected layout changes and improves user experience'
    });
  }

  // 内存使用建议
  if (metrics.memoryUsage && metrics.memoryUsage.pressure !== 'low') {
    suggestions.push({
      category: 'Memory Management',
      priority: metrics.memoryUsage.pressure === 'high' ? 'high' : 'medium',
      title: 'Optimize Memory Usage',
      description: 'Clean up unused objects, implement object pooling, avoid memory leaks',
      impact: 'Prevents performance degradation and crashes'
    });
  }

  const priorityColors = {
    high: 'border-red-200 bg-red-50 text-red-700',
    medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    low: 'border-green-200 bg-green-50 text-green-700'
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Suggestions</h3>
      {suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-500" />
          <p>Great! No major performance issues detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              className={cn(
                'p-4 rounded-lg border-2',
                priorityColors[suggestion.priority]
              )}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{suggestion.title}</h4>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      priorityColors[suggestion.priority]
                    )}>
                      {suggestion.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm mb-2 opacity-90">{suggestion.description}</p>
                  <div className="text-xs opacity-75">
                    <strong>Impact:</strong> {suggestion.impact}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;