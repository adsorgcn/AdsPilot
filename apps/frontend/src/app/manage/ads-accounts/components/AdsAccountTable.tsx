"use client";

import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';

import type { AdsAccountAdmin } from '~/lib/api/types/console';

type AdsAccountTableProps = {
  accounts: AdsAccountAdmin[];
  isLoading: boolean;
  isRefreshing?: boolean;
  maxHeight?: number;
  scrollKey?: string;
  onSelect: (account: AdsAccountAdmin) => void;
};

const DEFAULT_MAX_HEIGHT = 520;
const ROW_ESTIMATE = 96;

export default function AdsAccountTable({
  accounts,
  isLoading,
  isRefreshing = false,
  maxHeight = DEFAULT_MAX_HEIGHT,
  scrollKey,
  onSelect,
}: AdsAccountTableProps) {
  const hasAccounts = accounts.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: accounts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    getItemKey: (index) => accounts[index]?.id ?? index,
    measureElement: (element) =>
      element ? element.getBoundingClientRect().height : ROW_ESTIMATE,
  });

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    virtualizer.scrollToIndex(0, { align: 'start' });
  }, [scrollKey, virtualizer]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="hidden border-b border-border bg-muted/70 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(260px,1.2fr)_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr_140px] lg:gap-4">
        <span>账号</span>
        <span>提供商</span>
        <span>状态</span>
        <span>花费</span>
        <span>收入</span>
        <span>ROAS</span>
        <span className="text-right">操作</span>
      </div>

      {isLoading && !hasAccounts ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : hasAccounts ? (
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight }}>
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const account = accounts[virtualRow.index];

              if (!account) {
                return null;
              }

              const isLast = virtualRow.index === accounts.length - 1;
              const syncState = resolveSyncStatus(account);

              return (
                <div
                  key={account.id}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 right-0"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <AccountRow
                    account={account}
                    isLast={isLast}
                    syncState={syncState}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          没有符合筛选条件的账号
        </div>
      )}

      {isRefreshing ? (
        <div className="border-t border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
          正在同步最新数据…
        </div>
      ) : null}
    </div>
  );
}

type SyncState = {
  label: string;
  tone: 'success' | 'warn' | 'error';
  description: string;
  bucket: 'fresh' | 'stale' | 'never';
};

type AccountRowProps = {
  account: AdsAccountAdmin;
  isLast: boolean;
  syncState: SyncState;
  onSelect: (account: AdsAccountAdmin) => void;
};

function AccountRow({ account, isLast, syncState, onSelect }: AccountRowProps) {
  const borderClass = isLast ? 'border-b-0' : 'border-b border-border';

  return (
    <div
      className={`flex flex-col gap-3 bg-background px-4 py-4 transition hover:bg-muted/40 lg:grid lg:grid-cols-[minmax(260px,1.2fr)_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr_140px] lg:items-center lg:gap-4 ${borderClass}`}
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onSelect(account)}
          className="max-w-full text-left text-sm font-semibold text-foreground hover:text-primary"
        >
          {account.accountName}
        </button>
        <span className="text-xs text-muted-foreground">{account.accountId}</span>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>关联 Offer：{account.linkedOffersCount}</span>
          <span>·</span>
          <span>活跃活动：{account.activeCampaignsCount}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge size="small" color="normal">
          {formatProvider(account.provider)}
        </Badge>
      </div>

      <div>
        <StatusBadge status={account.status} />
      </div>

      <div className="text-sm font-medium text-foreground">
        {formatCurrency(account.totalCost)}
      </div>

      <div className="text-sm font-medium text-foreground">
        {formatCurrency(account.totalRevenue)}
      </div>

      <div className="text-sm font-medium">
        <Badge size="small" color={resolveRoasTone(account.roas)}>
          {account.roas.toFixed(2)}
        </Badge>
      </div>

      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
        <span className={syncToneToClass(syncState.tone)}>{syncState.label}</span>
        <span>{syncState.description}</span>
        <Button size="sm" variant="ghost" onClick={() => onSelect(account)}>
          查看详情
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = (() => {
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
  })();

  const label = status.replace(/_/g, ' ');

  return (
    <Badge size="small" color={tone} className="uppercase">
      {label}
    </Badge>
  );
}

function resolveSyncStatus(account: AdsAccountAdmin): SyncState {
  const { lastSyncedAt } = account;

  if (!lastSyncedAt) {
    return {
      label: '未同步',
      tone: 'warn',
      description: '尚未执行同步任务',
      bucket: 'never',
    };
  }

  const diff = Date.now() - new Date(lastSyncedAt).getTime();
  const hours = Math.round(diff / (60 * 60 * 1000));

  if (diff <= 6 * 60 * 60 * 1000) {
    return {
      label: '实时同步',
      tone: 'success',
      description: `最近 ${hours <= 1 ? '1 小时内' : `${hours} 小时内`} 完成同步`,
      bucket: 'fresh',
    };
  }

  if (diff <= 24 * 60 * 60 * 1000) {
    return {
      label: '最近同步',
      tone: 'warn',
      description: `上次同步 ${hours} 小时前`,
      bucket: 'fresh',
    };
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return {
    label: '同步延迟',
    tone: 'error',
    description: `${days} 天未同步，建议检查连接`,
    bucket: 'stale',
  };
}

function resolveRoasTone(roas: number) {
  if (roas >= 2) {
    return 'success';
  }
  if (roas >= 1) {
    return 'info';
  }
  if (roas >= 0.5) {
    return 'warn';
  }
  return 'error';
}

function syncToneToClass(tone: SyncState['tone']) {
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

export function filterByPerformance(
  account: AdsAccountAdmin,
  performance: 'all' | 'high-roas' | 'low-roas' | 'high-spend',
) {
  switch (performance) {
    case 'high-roas':
      return account.roas >= 2;
    case 'low-roas':
      return account.roas < 1;
    case 'high-spend':
      return account.totalCost >= 1000;
    default:
      return true;
  }
}

export function matchSyncBucket(
  syncState: SyncState,
  filter: 'all' | 'fresh' | 'stale' | 'never',
) {
  if (filter === 'all') {
    return true;
  }

  return syncState.bucket === filter;
}

export { resolveSyncStatus };
