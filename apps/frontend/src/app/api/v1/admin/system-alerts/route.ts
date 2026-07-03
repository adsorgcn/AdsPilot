/**
 * System Alerts API
 *
 * 获取系统告警信息，包括性能告警、资源告警、业务告警、安全告警
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCacheHeaders } from '~/lib/api/optimization/CacheHeaders';

interface SystemAlert {
  id: string;
  type: 'performance' | 'resource' | 'business' | 'security';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  source: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, any>;
}

interface SystemAlerts {
  critical: SystemAlert[];
  warning: SystemAlert[];
  info: SystemAlert[];
  total: number;
}

// 获取性能告警
async function getPerformanceAlerts(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];

  try {
    // TODO: 连接真实的性能监控系统
    // 这里可以检查Web Vitals数据、API响应时间等

    // 示例：检查LCP性能
    // const lcpMetrics = await getLatestLCPMetrics();
    // if (lcpMetrics.average > 4000) {
    //   alerts.push({
    //     id: 'perf-lcp-slow',
    //     type: 'performance',
    //     severity: 'warning',
    //     title: '页面加载速度过慢',
    //     description: `LCP平均值为${lcpMetrics.average}ms，超过建议的4000ms阈值`,
    //     source: 'web-vitals',
    //     createdAt: new Date().toISOString(),
    //     acknowledged: false,
    //     metadata: { average: lcpMetrics.average, threshold: 4000 }
    //   });
    // }

    // 临时的模拟数据 - 真实环境中连接监控系统
    if (Math.random() > 0.7) {
      alerts.push({
        id: 'perf-api-slow',
        type: 'performance',
        severity: 'warning',
        title: 'API响应时间过长',
        description: '过去5分钟内API平均响应时间超过2秒',
        source: 'api-monitor',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        acknowledged: false,
        metadata: { averageResponseTime: 2400, threshold: 2000 }
      });
    }
  } catch (error) {
    console.error('[System Alerts] Error fetching performance alerts:', error);
  }

  return alerts;
}

// 获取资源告警
async function getResourceAlerts(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];

  try {
    // TODO: 连接真实的资源监控系统
    // 检查CPU、内存、磁盘使用率等

    // 示例：检查内存使用率
    // const memoryUsage = await getMemoryUsage();
    // if (memoryUsage > 85) {
    //   alerts.push({
    //     id: 'resource-memory-high',
    //     type: 'resource',
    //     severity: memoryUsage > 95 ? 'critical' : 'warning',
    //     title: '内存使用率过高',
    //     description: `当前内存使用率为${memoryUsage}%`,
    //     source: 'system-monitor',
    //     createdAt: new Date().toISOString(),
    //     acknowledged: false,
    //     metadata: { usage: memoryUsage, threshold: 85 }
    //   });
    // }

    // 临时的模拟数据
    if (Math.random() > 0.8) {
      alerts.push({
        id: 'resource-disk-space',
        type: 'resource',
        severity: 'warning',
        title: '磁盘空间不足',
        description: '系统磁盘使用率已达到75%',
        source: 'system-monitor',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        acknowledged: false,
        metadata: { usage: 75, threshold: 80 }
      });
    }
  } catch (error) {
    console.error('[System Alerts] Error fetching resource alerts:', error);
  }

  return alerts;
}

// 获取业务告警
async function getBusinessAlerts(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];

  try {
    // TODO: 连接业务监控系统
    // 检查Token余额、订阅状态、Offer创建失败率等

    // 示例：检查Token余额不足用户
    // const lowBalanceUsers = await getLowBalanceUsers();
    // if (lowBalanceUsers.length > 0) {
    //   alerts.push({
    //     id: 'business-low-token-balance',
    //     type: 'business',
    //     severity: 'warning',
    //     title: '用户Token余额不足',
    //     description: `${lowBalanceUsers.length}个用户Token余额低于10`,
    //     source: 'billing-monitor',
    //     createdAt: new Date().toISOString(),
    //     acknowledged: false,
    //     metadata: { userCount: lowBalanceUsers.length, threshold: 10 }
    //   });
    // }

    // 临时的模拟数据
    if (Math.random() > 0.9) {
      alerts.push({
        id: 'business-offer-evaluation-failed',
        type: 'business',
        severity: 'warning',
        title: 'Offer评估失败率上升',
        description: '过去1小时内Offer评估失败率达到15%',
        source: 'offer-monitor',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        acknowledged: false,
        metadata: { failureRate: 15, threshold: 10 }
      });
    }
  } catch (error) {
    console.error('[System Alerts] Error fetching business alerts:', error);
  }

  return alerts;
}

// 获取安全告警
async function getSecurityAlerts(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];

  try {
    // TODO: 连接安全监控系统
    // 检查异常登录、API滥用、安全事件等

    // 示例：检查异常登录
    // const suspiciousLogins = await getSuspiciousLogins();
    // if (suspiciousLogins.length > 0) {
    //   alerts.push({
    //     id: 'security-suspicious-login',
    //     type: 'security',
    //     severity: 'warning',
    //     title: '检测到异常登录',
    //     description: `发现${suspiciousLogins.length}次可疑登录尝试`,
    //     source: 'security-monitor',
    //     createdAt: new Date().toISOString(),
    //     acknowledged: false,
    //     metadata: { attempts: suspiciousLogins.length }
    //   });
    // }

    // 临时的模拟数据
    if (Math.random() > 0.95) {
      alerts.push({
        id: 'security-api-abuse',
        type: 'security',
        severity: 'critical',
        title: 'API调用频率异常',
        description: '检测到来自单个IP的异常高频API调用',
        source: 'security-monitor',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        acknowledged: false,
        metadata: { ip: '192.168.1.100', requestCount: 1000, timeWindow: '1分钟' }
      });
    }
  } catch (error) {
    console.error('[System Alerts] Error fetching security alerts:', error);
  }

  return alerts;
}

export async function GET(_request: NextRequest) {
  try {
    // 验证管理员权限
    // TODO: 实现真实的权限检查
    // const user = await getCurrentUser(_request);
    // if (!user || !user.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // 并行获取各类告警
    const [performanceAlerts, resourceAlerts, businessAlerts, securityAlerts] = await Promise.all([
      getPerformanceAlerts(),
      getResourceAlerts(),
      getBusinessAlerts(),
      getSecurityAlerts()
    ]);

    // 按严重程度分类
    const allAlerts = [...performanceAlerts, ...resourceAlerts, ...businessAlerts, ...securityAlerts];

    const systemAlerts: SystemAlerts = {
      critical: allAlerts.filter(alert => alert.severity === 'critical'),
      warning: allAlerts.filter(alert => alert.severity === 'warning'),
      info: allAlerts.filter(alert => alert.severity === 'info'),
      total: allAlerts.length
    };

    const response = NextResponse.json({
      success: true,
      data: systemAlerts,
      meta: {
        generated_at: new Date().toISOString(),
        sources: ['web-vitals', 'system-monitor', 'billing-monitor', 'offer-monitor', 'security-monitor']
      }
    });

    // 缓存1分钟 - 告警数据需要相对实时
    return setCacheHeaders(response, '/api/v1/admin/system-alerts', undefined, 'short');

  } catch (error) {
    console.error('[System Alerts] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch system alerts',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: 实现告警确认功能
    const { alertId: _alertId, action } = await request.json();

    if (action === 'acknowledge') {
      // 确认告警逻辑
      // await acknowledgeAlert(_alertId, userId);

      return NextResponse.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('[System Alerts] Error processing POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process alert action',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}