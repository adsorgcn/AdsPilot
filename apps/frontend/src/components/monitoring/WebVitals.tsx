'use client';

import { useEffect } from 'react';
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals/attribution';

function sendToAnalytics(metric: any) {
  // 发送到分析服务
  if (process.env.NODE_ENV === 'production') {
    // 这里可以发送到 Google Analytics, Vercel Analytics 等
    if (process.env.NODE_ENV !== 'production') console.log('Web Vital:', metric);

    // 示例：发送到自定义端点
    // fetch('/api/web-vitals', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(metric),
    // });
  }
}

export function WebVitals() {
  useEffect(() => {
    // 只在生产环境或开发环境启用监控
    if (typeof window !== 'undefined') {
      onCLS(sendToAnalytics);
      onINP(sendToAnalytics);
      onFCP(sendToAnalytics);
      onLCP(sendToAnalytics);
      onTTFB(sendToAnalytics);
    }
  }, []);

  return null;
}

// Web Vitals 阈值检查
export const VITAL_THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 }, // 新的INP指标替代FID
  FCP: { good: 1800, needsImprovement: 3000 },
  LCP: { good: 2500, needsImprovement: 4000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

// 检查性能评分
export function getVitalRating(name: keyof typeof VITAL_THRESHOLDS, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = VITAL_THRESHOLDS[name];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}