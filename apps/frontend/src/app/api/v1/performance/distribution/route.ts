/**
 * Performance Distribution API
 *
 * 获取性能评分分布数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCacheHeaders } from '~/lib/api/optimization/CacheHeaders';

interface PerformanceDistribution {
  LCP: { good: number; needsImprovement: number; poor: number };
  FID: { good: number; needsImprovement: number; poor: number };
  CLS: { good: number; needsImprovement: number; poor: number };
  INP: { good: number; needsImprovement: number; poor: number };
  FCP: { good: number; needsImprovement: number; poor: number };
  TTFB: { good: number; needsImprovement: number; poor: number };
}

async function getPerformanceDistribution(): Promise<PerformanceDistribution> {
  try {
    // TODO: 替换为真实的数据查询
    // const data = await db.query(`
    //   SELECT
    //     metric_name,
    //     CASE
    //       WHEN value <= good_threshold THEN 'good'
    //       WHEN value <= needs_improvement_threshold THEN 'needs-improvement'
    //       ELSE 'poor'
    //     END as rating,
    //     COUNT(*) as count
    //   FROM web_vitals_metrics
    //   WHERE created_at >= NOW() - INTERVAL '24 hours'
    //   GROUP BY metric_name, rating
    // `);

    const mockData: PerformanceDistribution = {
      LCP: { good: 75, needsImprovement: 20, poor: 5 },
      FID: { good: 85, needsImprovement: 12, poor: 3 },
      CLS: { good: 80, needsImprovement: 15, poor: 5 },
      INP: { good: 78, needsImprovement: 18, poor: 4 },
      FCP: { good: 82, needsImprovement: 14, poor: 4 },
      TTFB: { good: 70, needsImprovement: 22, poor: 8 },
    };

    return mockData;
  } catch (error) {
    console.error('[Performance Distribution] Error fetching data:', error);

    // 降级到基本分布
    return {
      LCP: { good: 60, needsImprovement: 30, poor: 10 },
      FID: { good: 70, needsImprovement: 20, poor: 10 },
      CLS: { good: 65, needsImprovement: 25, poor: 10 },
      INP: { good: 68, needsImprovement: 22, poor: 10 },
      FCP: { good: 72, needsImprovement: 18, poor: 10 },
      TTFB: { good: 65, needsImprovement: 25, poor: 10 },
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';

    const data = await getPerformanceDistribution();

    const response = NextResponse.json({
      success: true,
      data,
      meta: {
        timeframe,
        generated_at: new Date().toISOString(),
        source: 'web_vitals_distribution'
      }
    });

    // 缓存30分钟 - 分布数据相对稳定
    return setCacheHeaders(response, '/api/v1/performance/distribution', undefined, 'medium');

  } catch (error) {
    console.error('[Performance Distribution] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance distribution',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}