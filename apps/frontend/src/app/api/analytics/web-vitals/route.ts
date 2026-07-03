/**
 * Web Vitals 数据接收端点
 *
 * 接收客户端上报的性能指标并存储到日志/数据库
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCacheHeaders } from '~/lib/api/optimization/CacheHeaders';

interface WebVitalsPayload {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  attribution?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WebVitalsPayload;

    // 基础验证
    if (!payload.name || typeof payload.value !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 提取用户信息 (可选)
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || 'unknown';

    // 构造日志条目
    const logEntry = {
      timestamp: new Date().toISOString(),
      metric: payload.name,
      value: payload.value,
      rating: payload.rating,
      delta: payload.delta,
      id: payload.id,
      navigationType: payload.navigationType,
      attribution: payload.attribution,
      userAgent,
      referer,
    };

    // Note: Store to database or logging service when ready
    // 选项1: 写入Cloud Logging
    // console.log(JSON.stringify({ severity: 'INFO', ...logEntry }));

    // 选项2: 批量缓存后写入BigQuery (推荐用于大量数据)
    // await batchWriter.add(logEntry);

    // 选项3: 写入Console服务的监控表
    // await consoleApi.recordWebVital(logEntry);

    // 开发环境输出
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', logEntry);
    }

    const response = NextResponse.json({ success: true });

    // 添加缓存头：web vitals数据可以短时间缓存
    return setCacheHeaders(response, '/api/analytics/web-vitals', undefined, 'short');
  } catch (error) {
    console.error('[Web Vitals] Error processing metric:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// 仅允许POST
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
