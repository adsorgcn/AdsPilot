'use client';

import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { useAIInsights } from '~/lib/insights/hooks';
import type { Insight } from '~/lib/api/types/console';
import { LoadingSpinner } from '~/components/ui/loading-dots';

const SEVERITY_MAP: Record<Insight['severity'], { label: string; tone: 'info' | 'warn' | 'error'; Icon: React.ComponentType<{ className?: string }> }> = {
  info: {
    label: '提示',
    tone: 'info',
    Icon: InformationCircleIcon,
  },
  warning: {
    label: '预警',
    tone: 'warn',
    Icon: ExclamationTriangleIcon,
  },
  error: {
    label: '告警',
    tone: 'error',
    Icon: SparklesIcon,
  },
};

export default function AIInsightsFeed() {
  const { insights, isLoading, error, refresh, reconnect, isConnected } = useAIInsights();

  const displayInsights = useMemo(() => insights.slice(0, 5), [insights]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>AI Insights</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            根据任务、广告与资源数据自动生成的预警与建议。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge size="small" color={isConnected ? 'success' : 'info'}>
            {isConnected ? '实时同步' : '离线缓存'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={refresh}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <LoadingSpinner size="sm" className="mr-2" />
            正在加载智能洞察...
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <p className="mb-2 font-medium">无法获取智能洞察</p>
            <p className="mb-3 text-xs text-red-600/80 dark:text-red-200/80">{error.message}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={refresh}>
                重试
              </Button>
              <Button size="sm" variant="ghost" onClick={reconnect}>
                重新连接
              </Button>
            </div>
          </div>
        ) : null}

        {!isLoading && !error && displayInsights.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
            当前没有新的智能洞察，继续保持出色的运营表现！
          </div>
        ) : null}

        {displayInsights.map((insight) => (
          <InsightItem key={insight.id} insight={insight} />
        ))}
      </CardContent>
    </Card>
  );
}

function InsightItem({ insight }: { insight: Insight }) {
  const config = SEVERITY_MAP[insight.severity] ?? SEVERITY_MAP.info;
  const Icon = config.Icon;

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className={`mt-1 rounded-full p-2 ${severityBgClass(insight.severity)}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
          <Badge size="small" color={config.tone}>
            {config.label}
          </Badge>
          <Badge size="small" color="info">
            {formatCategory(insight.category)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{insight.message}</p>
        <p className="text-xs text-muted-foreground/80">{formatDateTime(insight.createdAt)}</p>
        {insight.action ? (
          <Button size="sm" variant="outline" className="mt-2" href={insight.action.url}>
            {insight.action.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function formatCategory(category: string) {
  switch (category) {
    case 'token':
      return 'Token';
    case 'task':
      return '任务';
    case 'ads':
      return '广告';
    default:
      return category;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function severityBgClass(severity: Insight['severity']) {
  switch (severity) {
    case 'error':
      return 'bg-red-500/10 text-red-500';
    case 'warning':
      return 'bg-amber-500/10 text-amber-500';
    default:
      return 'bg-sky-500/10 text-sky-500';
  }
}
