/**
 * Performance Trends API
 *
 * 获取历史性能趋势数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCacheHeaders } from '~/lib/api/optimization/CacheHeaders';

interface PerformanceTrend {
  date: string;
  LCP: number;
  FID: number;
  CLS: number;
  INP: number;
  FCP: number;
  TTFB: number;
}

async function getPerformanceTrends(days: number): Promise<PerformanceTrend[]> {
  try {
    // TODO: 替换为真实的数据查询
    // const data = await db.query(`
    //   SELECT
    //     DATE(created_at) as date,
    //     AVG(CASE WHEN metric_name = 'LCP' THEN value END) as LCP,
    //     AVG(CASE WHEN metric_name = 'FID' THEN value END) as FID,
    //     AVG(CASE WHEN metric_name = 'CLS' THEN value END) as CLS,
    //     AVG(CASE WHEN metric_name = 'INP' THEN value END) as INP,
    //     AVG(CASE WHEN metric_name = 'FCP' THEN value END) as FCP,
    //     AVG(CASE WHEN metric_name = 'TTFB' THEN value END) as TTFB
    //   FROM web_vitals_metrics
    //   WHERE created_at >= NOW() - INTERVAL '${days} days'
    //   GROUP BY DATE(created_at)
    //   ORDER BY date DESC
    // `);

    const data: PerformanceTrend[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      data.push({
        date: date.toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
        }),
        LCP: 2200 + Math.random() * 400 - 200,
        FID: 85 + Math.random() * 30 - 15,
        CLS: (0.08 + Math.random() * 0.04 - 0.02) * 100, // ×100用于图表
        INP: 180 + Math.random() * 60 - 30,
        FCP: 1600 + Math.random() * 300 - 150,
        TTFB: 650 + Math.random() * 200 - 100,
      });
    }

    return data;
  } catch (error) {
    console.error('[Performance Trends] Error fetching data:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 1), 30); // 限制在1-30天

    const data = await getPerformanceTrends(days);

    const response = NextResponse.json({
      success: true,
      data,
      meta: {
        days,
        generated_at: new Date().toISOString(),
        source: 'web_vitals_trends'
      }
    });

    // 缓存1小时 - 历史数据相对稳定
    return setCacheHeaders(response, '/api/v1/performance/trends', undefined, 'long');

  } catch (error) {
    console.error('[Performance Trends] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance trends',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}