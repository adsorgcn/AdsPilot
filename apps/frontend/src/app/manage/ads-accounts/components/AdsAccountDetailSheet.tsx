"use client";

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import {
  ResourceEmptyState,
  ResourceListSkeleton,
} from '~/core/ui/ResourceState';
import type { AdsAccountAdmin, Task } from '~/lib/api/types/console';
import { useConsoleTaskList } from '~/lib/admin/resources/tasks';

import { resolveSyncStatus } from './AdsAccountTable';

type AdsAccountDetailSheetProps = {
  account: AdsAccountAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AdsAccountDetailSheet({
  account,
  open,
  onOpenChange,
}: AdsAccountDetailSheetProps) {
  const router = useRouter();

  const {
    data: taskData,
    isLoading: tasksLoading,
    error: tasksError,
  } = useConsoleTaskList({
    userId: account?.userId,
    pageSize: 5,
  });

  const insights = useMemo(() => (account ? buildInsights(account) : []), [account]);
  const syncStatus = account ? resolveSyncStatus(account) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle>{account?.accountName ?? 'Ads Account Detail'}</SheetTitle>
          <SheetDescription>
            查看广告账号的实时表现、同步状态与近期任务。
          </SheetDescription>
        </SheetHeader>

        {account ? (
          <div className="mt-6 space-y-6">
            <section className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
              <DetailField label="Account ID" value={account.accountId} />
              <DetailField label="Provider" value={formatProvider(account.provider)} />
              <DetailField
                label="Linked Offers"
                value={`${account.linkedOffersCount}`}
              />
              <DetailField
                label="Active Campaigns"
                value={`${account.activeCampaignsCount}`}
              />
              <DetailField
                label="Connected At"
                value={formatDate(account.connectedAt)}
              />
              <DetailField
                label="Last Synced"
                value={account.lastSyncedAt ? formatRelativeTime(account.lastSyncedAt) : 'Never'}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge size="small" color={statusTone(account.status)} className="uppercase">
                  {account.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              {syncStatus ? (
                <div className="rounded-md bg-background p-3 text-xs text-muted-foreground">
                  <p className={`font-medium ${syncToneToClass(syncStatus.tone)}`}>
                    {syncStatus.label}
                  </p>
                  <p className="mt-1">{syncStatus.description}</p>
                </div>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Performance Insights</h3>
              <ul className="grid gap-3">
                {insights.map((insight) => (
                  <li
                    key={insight.title}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{insight.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Recent Tasks</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onOpenChange(false);
                    router.push('/manage/tasks');
                  }}
                >
                  管理任务
                </Button>
              </div>

              {tasksLoading ? (
                <ResourceListSkeleton rows={4} />
              ) : tasksError ? (
                <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
                  任务加载失败：{tasksError instanceof Error ? tasksError.message : 'Unknown error'}
                </div>
              ) : taskData && taskData.items?.length ? (
                <ul className="space-y-3">
                  {taskData.items.slice(0, 5).map((task: Task) => (
                    <li key={task.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground capitalize">{task.type}</span>
                        <Badge size="small" color={taskStatusTone(task.status)}>
                          {task.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.error ?? '执行成功'} · {formatRelativeTime(task.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <ResourceEmptyState
                  title="暂无关联任务"
                  description="最近没有执行任务，建议检查自动化或手动触发评估。"
                />
              )}
            </section>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">请选择一个账号查看详情。</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-words">{value}</span>
    </div>
  );
}

function buildInsights(account: AdsAccountAdmin) {
  const insights: Array<{ title: string; description: string }> = [];

  if (account.roas >= 2) {
    insights.push({
      title: 'ROAS 表现领先',
      description: '保持当前策略，同时考虑扩充预算以捕获更多高质量流量。',
    });
  } else if (account.roas < 1) {
    insights.push({
      title: 'ROAS 偏低',
      description: '建议检查落地页相关 Offer 的质量评分，并复盘近期的优化任务。',
    });
  }

  if (!account.lastSyncedAt) {
    insights.push({
      title: '尚未完成同步',
      description: '请检查授权流程，确保广告账号已正确连接并完成至少一次同步。',
    });
  }

  if (account.totalCost > 2000 && account.activeCampaignsCount <= 1) {
    insights.push({
      title: '预算集中',
      description: '高花费集中在单一活动，建议拆分实验或引入自动化策略进行 A/B 测试。',
    });
  }

  if (!insights.length) {
    insights.push({
      title: '状态良好',
      description: '账号各项指标稳定，可结合 AI 策略建议持续优化。',
    });
  }

  return insights;
}

function taskStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
      return 'info';
    case 'pending':
      return 'warn';
    default:
      return 'normal';
  }
}

function statusTone(status: string) {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warn';
    case 'suspended':
    case 'disconnected':
      return 'error';
    default:
      return 'normal';
  }
}

function syncToneToClass(tone: 'success' | 'warn' | 'error') {
  switch (tone) {
    case 'success':
      return 'text-emerald-600';
    case 'warn':
      return 'text-amber-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
}

function formatProvider(provider: string) {
  switch (provider) {
    case 'google':
      return 'Google Ads';
    case 'meta':
      return 'Meta Ads';
    case 'tt':
      return 'TikTok Ads';
    default:
      return provider;
  }
}

function formatDate(value?: string) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRelativeTime(value?: string) {
  if (!value) {
    return 'Never';
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const minutes = Math.max(1, Math.round(diff / minute));
    return `${minutes} 分钟前`;
  }

  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / hour));
    return `${hours} 小时前`;
  }

  const days = Math.round(diff / day);
  return `${days} 天前`;
}
