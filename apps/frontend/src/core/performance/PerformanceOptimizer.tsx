'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// 性能指标接口
interface PerformanceMetrics {
  // 核心Web指标
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  firstContentfulPaint?: number;
  timeToInteractive?: number;

  // 自定义指标
  componentRenderTime?: number;
  apiResponseTime?: number;
  userInteractionTime?: number;

  // 资源指标
  bundleSize?: number;
  memoryUsage?: number;
  cacheHitRate?: number;

  // 错误指标
  errorCount?: number;
  jsErrorCount?: number;
  networkErrorCount?: number;
}

// 性能配置
interface PerformanceConfig {
  enableMonitoring: boolean;
  enableAutoOptimization: boolean;
  sampleRate: number;
  thresholds: {
    fcp: number; // First Contentful Paint (ms)
    lcp: number; // Largest Contentful Paint (ms)
    fid: number; // First Input Delay (ms)
    cls: number; // Cumulative Layout Shift
    tti: number; // Time to Interactive (ms)
  };
}

// 性能优化器Hook
export function usePerformanceOptimizer(config: Partial<PerformanceConfig> = {}) {
  const {
    recordPageLoad,
    recordApiResponse,
    recordInteraction,
    getMetrics,
  } = usePerformanceMetrics();

  const metricsRef = useRef<PerformanceMetrics>({});
  const observersRef = useRef<Set<PerformanceObserver>>(new Set());
  const [isOptimizing, setIsOptimizing] = useState(false);

  const finalConfig: PerformanceConfig = {
    enableMonitoring: true,
    enableAutoOptimization: true,
    sampleRate: 0.1, // 10% 采样率
    thresholds: {
      fcp: 1800,
      lcp: 2500,
      fid: 100,
      cls: 0.1,
      tti: 3800,
    },
    ...config,
  };

  // 检查是否应该采样
  const shouldSample = useCallback(() => {
    return Math.random() < finalConfig.sampleRate;
  }, [finalConfig.sampleRate]);

  // 监控核心Web指标
  const observeWebVitals = useCallback(() => {
    if (!finalConfig.enableMonitoring || !shouldSample()) return;

    // FCP (First Contentful Paint)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcp = entries[entries.length - 1];
        metricsRef.current.firstContentfulPaint = fcp.startTime;

        if (fcp.startTime > finalConfig.thresholds.fcp) {
          console.warn('FCP threshold exceeded:', fcp.startTime, 'ms');
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
      observersRef.current.add(fcpObserver);
    } catch (error) {
      console.warn('FCP observation not supported:', error);
    }

    // LCP (Largest Contentful Paint)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        metricsRef.current.largestContentfulPaint = lcp.startTime;

        if (lcp.startTime > finalConfig.thresholds.lcp) {
          console.warn('LCP threshold exceeded:', lcp.startTime, 'ms');
          // 触发自动优化
          if (finalConfig.enableAutoOptimization) {
            triggerAutoOptimization('lcp');
          }
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      observersRef.current.add(lcpObserver);
    } catch (error) {
      console.warn('LCP observation not supported:', error);
    }

    // FID (First Input Delay)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart) {
            const fid = entry.processingStart - entry.startTime;
            metricsRef.current.firstInputDelay = fid;

            if (fid > finalConfig.thresholds.fid) {
              console.warn('FID threshold exceeded:', fid, 'ms');
              triggerAutoOptimization('fid');
            }
          }
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      observersRef.current.add(fidObserver);
    } catch (error) {
      console.warn('FID observation not supported:', error);
    }

    // CLS (Cumulative Layout Shift)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            metricsRef.current.cumulativeLayoutShift = clsValue;

            if (clsValue > finalConfig.thresholds.cls) {
              console.warn('CLS threshold exceeded:', clsValue);
              triggerAutoOptimization('cls');
            }
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      observersRef.current.add(clsObserver);
    } catch (error) {
      console.warn('CLS observation not supported:', error);
    }
  }, [finalConfig, shouldSample]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动优化触发器
  const triggerAutoOptimization = useCallback((metric: string) => {
    if (!finalConfig.enableAutoOptimization) return;

    setIsOptimizing(true);

    switch (metric) {
      case 'lcp':
        // 优化LCP：预加载关键资源
        optimizeLCP();
        break;
      case 'fid':
        // 优化FID：减少主线程阻塞
        optimizeFID();
        break;
      case 'cls':
        // 优化CLS：稳定布局
        optimizeCLS();
        break;
    }

    setTimeout(() => setIsOptimizing(false), 2000);
  }, [finalConfig.enableAutoOptimization]); // eslint-disable-line react-hooks/exhaustive-deps

  // LCP优化策略
  const optimizeLCP = useCallback(() => {
    // 预加载关键CSS
    const criticalCSS = [
      '/css/critical.css',
    ];

    criticalCSS.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = href;
      document.head.appendChild(link);
    });

    // 预加载关键字体
    const criticalFonts = [
      '/fonts/inter-var.woff2',
    ];

    criticalFonts.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = href;
      document.head.appendChild(link);
    });

    console.log('Applied LCP optimizations');
  }, []);

  // FID优化策略
  const optimizeFID = useCallback(() => {
    // 减少JavaScript执行时间
    // 这里可以实现代码分割和非关键JavaScript的延迟加载

    // 使用requestIdleCallback处理非关键任务
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // 预加载非关键资源
        console.log('Applied FID optimizations');
      });
    }
  }, []);

  // CLS优化策略
  const optimizeCLS = useCallback(() => {
    // 为动态内容添加明确的尺寸
    const dynamicElements = document.querySelectorAll('[data-dynamic-content]');
    dynamicElements.forEach(element => {
      if (!(element as HTMLElement).style.minHeight) {
        (element as HTMLElement).style.minHeight = '100px';
      }
    });

    console.log('Applied CLS optimizations');
  }, []);

  // 监控资源加载性能
  const observeResourcePerformance = useCallback(() => {
    if (!finalConfig.enableMonitoring) return;

    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.duration > 1000) { // 超过1秒的资源
          console.warn('Slow resource detected:', {
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
          });
        }
      });
    });

    resourceObserver.observe({ type: 'resource', buffered: true });
    observersRef.current.add(resourceObserver);
  }, [finalConfig.enableMonitoring]);

  // 监控长任务
  const observeLongTasks = useCallback(() => {
    if (!finalConfig.enableMonitoring) return;

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          console.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
          });

          recordInteraction('long_task', entry.duration);
        });
      });

      longTaskObserver.observe({ type: 'longtask', buffered: true });
      observersRef.current.add(longTaskObserver);
    } catch (error) {
      console.warn('Long task observation not supported:', error);
    }
  }, [finalConfig.enableMonitoring, recordInteraction]);

  // 内存使用监控
  const monitorMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };

      metricsRef.current.memoryUsage = memoryInfo.usedJSHeapSize;

      // 内存使用超过80%时发出警告
      if (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit > 0.8) {
        console.warn('High memory usage detected:', memoryInfo);
        triggerAutoOptimization('memory');
      }
    }
  }, []);

  // 组件渲染性能监控
  const measureComponentRender = useCallback((componentName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      metricsRef.current.componentRenderTime = renderTime;
      recordInteraction(`${componentName}_render`, renderTime);

      if (renderTime > 100) { // 渲染时间超过100ms
        console.warn(`Slow render detected for ${componentName}:`, renderTime, 'ms');
      }
    };
  }, [recordInteraction]);

  // 获取性能报告
  const getPerformanceReport = useCallback(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    const fcp = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime;
    const lcp = metricsRef.current.largestContentfulPaint;
    const cls = metricsRef.current.cumulativeLayoutShift || 0;
    const fid = metricsRef.current.firstInputDelay;

    return {
      // 基础指标
      fcp,
      lcp,
      cls,
      fid,
      tti: metricsRef.current.timeToInteractive,

      // 导航指标
      domContentLoaded: nav?.domContentLoadedEventEnd - nav?.domContentLoadedEventStart,
      loadComplete: nav?.loadEventEnd - nav?.loadEventStart,

      // 自定义指标
      componentRenderTime: metricsRef.current.componentRenderTime,
      memoryUsage: metricsRef.current.memoryUsage,

      // 性能评分 (0-100)
      performanceScore: calculatePerformanceScore({
        fcp: fcp || 0,
        lcp: lcp || 0,
        cls,
        fid: fid || 0,
      }),
    };
  }, []);

  // 计算性能评分
  const calculatePerformanceScore = (metrics: {
    fcp: number;
    lcp: number;
    cls: number;
    fid: number;
  }) => {
    const { thresholds } = finalConfig;

    let score = 100;

    // FCP评分 (25%)
    const fcpScore = Math.max(0, 100 - (metrics.fcp / thresholds.fcp) * 100);
    score = score * 0.75 + fcpScore * 0.25;

    // LCP评分 (25%)
    const lcpScore = Math.max(0, 100 - (metrics.lcp / thresholds.lcp) * 100);
    score = score * 0.75 + lcpScore * 0.25;

    // CLS评分 (25%)
    const clsScore = Math.max(0, 100 - (metrics.cls / thresholds.cls) * 100);
    score = score * 0.75 + clsScore * 0.25;

    // FID评分 (25%)
    const fidScore = Math.max(0, 100 - (metrics.fid / thresholds.fid) * 100);
    score = score * 0.75 + fidScore * 0.25;

    return Math.round(score);
  };

  // 清理观察器
  const cleanup = useCallback(() => {
    observersRef.current.forEach(observer => observer.disconnect());
    observersRef.current.clear();
  }, []);

  // 初始化性能监控
  useEffect(() => {
    if (typeof window === 'undefined') return;

    observeWebVitals();
    observeResourcePerformance();
    observeLongTasks();

    // 定期监控内存使用
    const memoryInterval = setInterval(monitorMemoryUsage, 10000);

    return () => {
      cleanup();
      clearInterval(memoryInterval);
    };
  }, [observeWebVitals, observeResourcePerformance, observeLongTasks, monitorMemoryUsage, cleanup]);

  return {
    // 监控状态
    isOptimizing,

    // 测量工具
    measureComponentRender,

    // 优化触发器
    triggerAutoOptimization,

    // 报告工具
    getPerformanceReport,
    getMetrics,

    // 配置
    config: finalConfig,
  };
}

// 性能监控面板组件
interface PerformanceMonitorPanelProps {
  enabled?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function PerformanceMonitorPanel({
  enabled = process.env.NODE_ENV === 'development',
  position = 'top-right'
}: PerformanceMonitorPanelProps) {
  const { getPerformanceReport, isOptimizing } = usePerformanceOptimizer();
  const [report, setReport] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setReport(getPerformanceReport());
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, getPerformanceReport]);

  if (!enabled || !report) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50 bg-black/80 text-white p-3 rounded-lg text-xs font-mono min-w-48`}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">性能监控</span>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-400 hover:text-white"
        >
          {isVisible ? '隐藏' : '显示'}
        </button>
      </div>

      {isOptimizing && (
        <div className="text-yellow-400 mb-2 animate-pulse">
          ⚡ 正在优化性能...
        </div>
      )}

      {isVisible && (
        <div className="space-y-1">
          <div>评分: <span className={report.performanceScore > 80 ? 'text-green-400' : report.performanceScore > 60 ? 'text-yellow-400' : 'text-red-400'}>{report.performanceScore}</span></div>
          <div>FCP: {Math.round(report.fcp || 0)}ms</div>
          <div>LCP: {Math.round(report.lcp || 0)}ms</div>
          <div>CLS: {report.cls?.toFixed(3) || 0}</div>
          <div>FID: {Math.round(report.fid || 0)}ms</div>
          <div>内存: {Math.round((report.memoryUsage || 0) / 1024 / 1024)}MB</div>
        </div>
      )}
    </div>
  );
}