/**
 * 性能监控相关Hooks
 *
 * 提供Web Vitals数据查询接口
 */

import { useQuery } from '@tanstack/react-query';
import { consoleApi } from '~/lib/api';

/**
 * 性能指标数据
 */
export interface PerformanceMetric {
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  trend?: number; // 相对上周的变化百分比
}

export interface PerformanceMetrics {
  LCP: PerformanceMetric;
  FID: PerformanceMetric;
  CLS: PerformanceMetric;
  INP: PerformanceMetric;
  FCP: PerformanceMetric;
  TTFB: PerformanceMetric;
}

/**
 * 性能趋势数据
 */
export interface PerformanceTrend {
  date: string;
  LCP: number;
  FID: number;
  CLS: number; // 实际值×100用于图表显示
  INP: number;
  FCP: number;
  TTFB: number;
}

/**
 * 性能分布数据
 */
export interface PerformanceDistribution {
  [metric: string]: {
    good: number;
    needsImprovement: number;
    poor: number;
  };
}

/**
 * 获取当前性能指标
 * 使用 1 分钟轮询以保持性能数据实时性
 *
 * @example
 * ```tsx
 * function MetricsGrid() {
 *   const { metrics, isLoading, error } = usePerformanceMetrics();
 *
 *   if (isLoading) return <Spinner />;
 *   return <div>LCP: {metrics.LCP.value}ms</div>;
 * }
 * ```
 */
export function usePerformanceMetrics() {
  const query = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const response = await consoleApi.getPerformanceMetrics();
      return response;
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  return {
    metrics: query.data,
    error: query.error,
    isLoading: query.isLoading,
  };
}

/**
 * 获取性能趋势数据
 * 使用 5 分钟轮询，趋势数据变化较慢
 *
 * @param options.days - 查询天数,默认7天
 */
export function usePerformanceTrends(options: { days?: number } = {}) {
  const { days = 7 } = options;

  const query = useQuery({
    queryKey: ['performance-trends', days],
    queryFn: async () => {
      const response = await consoleApi.getPerformanceTrends(days);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  return {
    trends: query.data,
    error: query.error,
    isLoading: query.isLoading,
  };
}

/**
 * 获取性能评分分布
 * 使用 5 分钟轮询，分布数据变化较慢
 */
export function usePerformanceDistribution() {
  const query = useQuery({
    queryKey: ['performance-distribution'],
    queryFn: async () => {
      const response = await consoleApi.getPerformanceDistribution();
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes polling
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  return {
    distribution: query.data,
    error: query.error,
    isLoading: query.isLoading,
  };
}