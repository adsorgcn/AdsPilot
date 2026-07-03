/**
 * Web Vitals 性能监控配置
 *
 * 集成 Core Web Vitals 指标监控,用于量化前端优化效果
 *
 * @see https://web.dev/vitals/
 */

import { onCLS, onLCP, onINP, onFCP, onTTFB, type Metric } from 'web-vitals';

/**
 * 性能指标阈值配置
 * 基于 Google Web Vitals 推荐标准
 */
export const VITALS_THRESHOLDS = {
  // Largest Contentful Paint (最大内容绘制)
  LCP: {
    good: 2500,      // 优秀: ≤ 2.5s
    needsImprovement: 4000, // 需改进: 2.5s - 4s
    // poor: > 4s
  },
  // First Input Delay (首次输入延迟)
  FID: {
    good: 100,       // 优秀: ≤ 100ms
    needsImprovement: 300,  // 需改进: 100ms - 300ms
    // poor: > 300ms
  },
  // Cumulative Layout Shift (累积布局偏移)
  CLS: {
    good: 0.1,       // 优秀: ≤ 0.1
    needsImprovement: 0.25, // 需改进: 0.1 - 0.25
    // poor: > 0.25
  },
  // Interaction to Next Paint (交互到下一次绘制)
  INP: {
    good: 200,       // 优秀: ≤ 200ms
    needsImprovement: 500,  // 需改进: 200ms - 500ms
    // poor: > 500ms
  },
  // First Contentful Paint (首次内容绘制)
  FCP: {
    good: 1800,      // 优秀: ≤ 1.8s
    needsImprovement: 3000, // 需改进: 1.8s - 3s
    // poor: > 3s
  },
  // Time to First Byte (首字节时间)
  TTFB: {
    good: 800,       // 优秀: ≤ 800ms
    needsImprovement: 1800, // 需改进: 800ms - 1.8s
    // poor: > 1.8s
  },
} as const;

/**
 * 性能等级
 */
export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

/**
 * 计算性能指标等级
 */
export function getRating(metric: Metric): PerformanceRating {
  const thresholds = VITALS_THRESHOLDS[metric.name as keyof typeof VITALS_THRESHOLDS];

  if (!thresholds) {
    return 'needs-improvement';
  }

  if (metric.value <= thresholds.good) {
    return 'good';
  }

  if (metric.value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  }

  return 'poor';
}

/**
 * 性能数据上报接口
 */
interface AnalyticsPayload {
  name: string;
  value: number;
  rating: PerformanceRating;
  delta: number;
  id: string;
  navigationType: string;
  attribution?: Record<string, unknown>;
}

/**
 * 发送性能数据到分析端点
 */
async function sendToAnalytics(payload: AnalyticsPayload): Promise<void> {
  // 使用 sendBeacon API 确保在页面卸载时也能发送
  if (typeof navigator.sendBeacon === 'function') {
    const url = '/api/analytics/web-vitals';
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    // 降级到 fetch (现代浏览器基本都支持 sendBeacon)
    try {
      await fetch('/api/analytics/web-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (error) {
      // 静默失败,不影响用户体验
      console.debug('[Web Vitals] Failed to send metric:', error);
    }
  }
}

/**
 * 性能指标处理器
 */
function handleMetric(metric: Metric): void {
  const rating = getRating(metric);

  const payload: AnalyticsPayload = {
    name: metric.name,
    value: metric.value,
    rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    attribution: (metric as any).attribution as Record<string, unknown> | undefined,
  };

  // 开发环境输出到控制台
  if (process.env.NODE_ENV === 'development') {
    console.table({
      Metric: metric.name,
      Value: `${metric.value.toFixed(2)}ms`,
      Rating: rating,
      Threshold: VITALS_THRESHOLDS[metric.name as keyof typeof VITALS_THRESHOLDS],
    });
  }

  // 上报到分析服务
  void sendToAnalytics(payload);

  // 可选: 发送到第三方监控服务 (如 Google Analytics)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

/**
 * 初始化 Web Vitals 监控
 *
 * 在应用入口调用一次即可
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { initWebVitals } from '~/lib/performance/web-vitals';
 *
 * export default function RootLayout({ children }) {
 *   useEffect(() => {
 *     initWebVitals();
 *   }, []);
 *
 *   return <html>{children}</html>;
 * }
 * ```
 */
export function initWebVitals(): void {
  // 仅在浏览器环境执行
  if (typeof window === 'undefined') {
    return;
  }

  // 监听核心指标
  onLCP(handleMetric);  // Largest Contentful Paint
  onCLS(handleMetric);  // Cumulative Layout Shift
  onINP(handleMetric);  // Interaction to Next Paint (replaces FID)

  // 监听辅助指标
  onFCP(handleMetric);  // First Contentful Paint
  onTTFB(handleMetric); // Time to First Byte

  // 记录初始化
  if (process.env.NODE_ENV === 'development') {
    console.log('[Web Vitals] Monitoring initialized');
  }
}

/**
 * 手动上报自定义性能指标
 *
 * @example
 * ```tsx
 * import { reportCustomMetric } from '~/lib/performance/web-vitals';
 *
 * const startTime = performance.now();
 * await fetchData();
 * const duration = performance.now() - startTime;
 *
 * reportCustomMetric('data-fetch', duration);
 * ```
 */
export function reportCustomMetric(name: string, value: number): void {
  const payload: AnalyticsPayload = {
    name: `custom:${name}`,
    value,
    rating: 'needs-improvement', // 自定义指标默认评级
    delta: value,
    id: `${name}-${Date.now()}`,
    navigationType: 'custom',
  };

  void sendToAnalytics(payload);
}
