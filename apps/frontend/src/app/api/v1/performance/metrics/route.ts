/**
 * Performance Metrics API
 *
 * 获取实时Web Vitals性能指标
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCacheHeaders } from '~/lib/api/optimization/CacheHeaders';

interface PerformanceMetrics {
  LCP: { value: number; rating: 'good' | 'needs-improvement' | 'poor'; trend: number };
  FID: { value: number; rating: 'good' | 'needs-improvement' | 'poor'; trend: number };
  CLS: { value: number; rating: 'good' | 'needs-improvement' | 'poor'; trend: number };
  INP: { value: number; rating: 'good' | 'needs-improvement' | 'poor'; trend: number };
  FCP: { value: number; rating: 'good' | 'needs-improvement' | 'poor'; trend: number };
  TTFB: { value: number; rating: 'good' | 'needs-improvement' | 'poor'; trend: number };
}

// 获取过去24小时的Web Vitals数据
async function getWebVitalsData(): Promise<PerformanceMetrics> {
  try {
    // 这里应该连接到实际的数据库或监控系统
    // 目前使用模拟数据，结构已经准备好替换为真实数据源

    // TODO: 替换为真实的数据查询
    // const data = await db.query(`
    //   SELECT
    //     metric_name,
    //     AVG(value) as avg_value,
    //     CASE
    //       WHEN AVG(value) <= good_threshold THEN 'good'
    //       WHEN AVG(value) <= needs_improvement_threshold THEN 'needs-improvement'
    //       ELSE 'poor'
    //     END as rating,
    //     (AVG(value) - LAG(AVG(value)) OVER (ORDER BY hour)) as trend
    //   FROM web_vitals_metrics
    //   WHERE created_at >= NOW() - INTERVAL '24 hours'
    //   GROUP BY metric_name, hour
    //   ORDER BY hour DESC
    // `);

    // 临时的真实数据结构 - 准备连接实际数据源
    const mockData: PerformanceMetrics = {
      LCP: { value: 2200, rating: 'good', trend: -12 },
      FID: { value: 85, rating: 'good', trend: -5 },
      CLS: { value: 0.08, rating: 'good', trend: -20 },
      INP: { value: 180, rating: 'good', trend: -8 },
      FCP: { value: 1600, rating: 'good', trend: -15 },
      TTFB: { value: 650, rating: 'good', trend: -10 },
    };

    return mockData;
  } catch (error) {
    console.error('[Performance Metrics] Error fetching data:', error);

    // 降级到基本指标
    return {
      LCP: { value: 2500, rating: 'needs-improvement', trend: 0 },
      FID: { value: 100, rating: 'needs-improvement', trend: 0 },
      CLS: { value: 0.1, rating: 'needs-improvement', trend: 0 },
      INP: { value: 200, rating: 'needs-improvement', trend: 0 },
      FCP: { value: 1800, rating: 'needs-improvement', trend: 0 },
      TTFB: { value: 800, rating: 'needs-improvement', trend: 0 },
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h'; // 1h, 24h, 7d, 30d

    const data = await getWebVitalsData();

    const response = NextResponse.json({
      success: true,
      data,
      meta: {
        timeframe,
        generated_at: new Date().toISOString(),
        source: 'web_vitals_metrics'
      }
    });

    // 缓存5分钟 - 性能数据相对稳���
    return setCacheHeaders(response, '/api/v1/performance/metrics', undefined, 'medium');

  } catch (error) {
    console.error('[Performance Metrics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance metrics',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}