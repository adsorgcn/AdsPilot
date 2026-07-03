/**
 * API性能监控和指标收集
 *
 * 提供API请求性能跟踪、错误统计和性能分析功能
 */

export interface ApiMetric {
  /** API端点 */
  endpoint: string;
  /** HTTP方法 */
  method: string;
  /** 请求耗时（毫秒） */
  duration: number;
  /** 请求是否成功 */
  success: boolean;
  /** HTTP状态码 */
  status?: number;
  /** 错误类型 */
  errorType?: string;
  /** 请求时间戳 */
  timestamp: number;
  /** 响应大小（字节） */
  responseSize?: number;
}

export interface ApiPerformanceStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successRequests: number;
  /** 失败请求数 */
  errorRequests: number;
  /** 平均响应时间 */
  avgResponseTime: number;
  /** 最大响应时间 */
  maxResponseTime: number;
  /** 最小响应时间 */
  minResponseTime: number;
  /** 成功率 */
  successRate: number;
  /** 95分位响应时间 */
  p95ResponseTime: number;
  /** 每秒请求数 */
  requestsPerSecond: number;
}

export interface PerformanceDashboard {
  /** 实时指标 */
  realtime: {
    /** 当前活跃请求数 */
    activeRequests: number;
    /** 最近5分钟错误率 */
    errorRate5Min: number;
    /** 最近5分钟平均响应时间 */
    avgResponseTime5Min: number;
  };
  /** 端点级别统计 */
  endpoints: Record<string, ApiPerformanceStats>;
  /** 总体统计 */
  overall: ApiPerformanceStats;
}

/**
 * API性能监控器
 */
class ApiMetricsCollector {
  private metrics: ApiMetric[] = [];
  private maxMetricsCount = 1000; // 保留最近1000条记录
  private activeRequests = new Map<string, { startTime: number; endpoint: string }>();

  /**
   * 开始跟踪API请求
   */
  startRequest(requestId: string, endpoint: string): void {
    this.activeRequests.set(requestId, {
      startTime: performance.now(),
      endpoint
    });
  }

  /**
   * 结束跟踪API请求并记录指标
   */
  endRequest(
    requestId: string,
    success: boolean,
    status?: number,
    errorType?: string,
    responseSize?: number
  ): void {
    const activeRequest = this.activeRequests.get(requestId);
    if (!activeRequest) return;

    const endTime = performance.now();
    const duration = Math.round(endTime - activeRequest.startTime);

    const metric: ApiMetric = {
      endpoint: activeRequest.endpoint,
      method: this.extractMethod(activeRequest.endpoint),
      duration,
      success,
      status,
      errorType,
      timestamp: Date.now(),
      responseSize
    };

    this.addMetric(metric);
    this.activeRequests.delete(requestId);

    // 发送到控制台和本地存储
    this.logMetric(metric);
    this.sendToAnalytics(metric);
  }

  /**
   * 获取当前活跃请求数
   */
  getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  /**
   * 获取性能统计数据
   */
  getPerformanceStats(endpoint?: string): ApiPerformanceStats {
    const filteredMetrics = endpoint
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return this.getEmptyStats();
    }

    const durations = filteredMetrics.map(m => m.duration);
    const successCount = filteredMetrics.filter(m => m.success).length;

    // 计算统计指标
    const sortedDurations = durations.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);

    return {
      totalRequests: filteredMetrics.length,
      successRequests: successCount,
      errorRequests: filteredMetrics.length - successCount,
      avgResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      maxResponseTime: Math.max(...durations),
      minResponseTime: Math.min(...durations),
      successRate: Math.round((successCount / filteredMetrics.length) * 100),
      p95ResponseTime: sortedDurations[p95Index] || 0,
      requestsPerSecond: this.calculateRPS(filteredMetrics)
    };
  }

  /**
   * 获取实时性能仪表盘数据
   */
  getPerformanceDashboard(): PerformanceDashboard {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const recentMetrics = this.metrics.filter(m => m.timestamp >= fiveMinutesAgo);
    const errorRate = recentMetrics.length > 0
      ? (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100
      : 0;

    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      : 0;

    // 计算各端点统计
    const endpoints: Record<string, ApiPerformanceStats> = {};
    const uniqueEndpoints = [...new Set(this.metrics.map(m => m.endpoint))];

    uniqueEndpoints.forEach(endpoint => {
      endpoints[endpoint] = this.getPerformanceStats(endpoint);
    });

    return {
      realtime: {
        activeRequests: this.activeRequests.size,
        errorRate5Min: Math.round(errorRate * 100) / 100,
        avgResponseTime5Min: Math.round(avgResponseTime)
      },
      endpoints,
      overall: this.getPerformanceStats()
    };
  }

  /**
   * 清理旧的指标数据
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.metrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);

    // 清理超时的活跃请求
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [id, request] of this.activeRequests.entries()) {
      if (request.startTime < tenMinutesAgo) {
        this.activeRequests.delete(id);
      }
    }
  }

  private addMetric(metric: ApiMetric): void {
    this.metrics.push(metric);

    // 保持最大数量限制
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(-this.maxMetricsCount);
    }
  }

  private extractMethod(endpoint: string): string {
    // 从端点提取HTTP方法，默认为GET
    if (endpoint.includes('/create') || endpoint.includes('/batch')) return 'POST';
    if (endpoint.includes('/update') || endpoint.includes('/modify')) return 'PUT';
    if (endpoint.includes('/delete')) return 'DELETE';
    return 'GET';
  }

  private getEmptyStats(): ApiPerformanceStats {
    return {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      successRate: 0,
      p95ResponseTime: 0,
      requestsPerSecond: 0
    };
  }

  private calculateRPS(metrics: ApiMetric[]): number {
    if (metrics.length < 2) return 0;

    const timestamps = metrics.map(m => m.timestamp);
    const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);

    return timeSpan > 0 ? Math.round((metrics.length / timeSpan) * 1000) : 0;
  }

  private logMetric(metric: ApiMetric): void {
    const level = metric.success ? 'info' : 'error';
    const status = metric.success ? '✅' : '❌';

    console[level](
      `[API Metrics] ${status} ${metric.method} ${metric.endpoint} - ${metric.duration}ms (${metric.status})`,
      {
        success: metric.success,
        duration: metric.duration,
        responseSize: metric.responseSize,
        timestamp: new Date(metric.timestamp).toISOString()
      }
    );

    // 警告慢请求
    if (metric.duration > 2000) {
      if (process.env.NODE_ENV !== 'production') console.warn(
        `🐌 Slow API Request: ${metric.method} ${metric.endpoint} took ${metric.duration}ms`
      );
    }
  }

  private sendToAnalytics(metric: ApiMetric): void {
    // 发送到分析服务（Google Analytics或其他）
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'api_request', {
        event_category: 'api_performance',
        event_label: metric.endpoint,
        value: metric.duration,
        custom_map: {
          success: metric.success,
          status_code: metric.status
        }
      });
    }

    // 发送到Web Vitals监控
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(`api-end-${metric.endpoint}`);
    }
  }
}

// 全局单例
export const apiMetricsCollector = new ApiMetricsCollector();

// 定期清理数据
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiMetricsCollector.cleanup();
  }, 5 * 60 * 1000); // 每5分钟清理一次
}

/**
 * 为API客户端添加性能监控的装饰器
 */
export function withApiMetrics<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  getEndpoint?: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const endpoint = getEndpoint ? getEndpoint(...args) : 'unknown';

    apiMetricsCollector.startRequest(requestId, endpoint);

    try {
      const result = await fn(...args);
      apiMetricsCollector.endRequest(requestId, true);
      return result;
    } catch (error) {
      const status = error?.status || 0;
      const errorType = error?.code || 'UNKNOWN_ERROR';
      apiMetricsCollector.endRequest(requestId, false, status, errorType);
      throw error;
    }
  }) as T;
}