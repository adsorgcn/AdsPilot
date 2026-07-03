"use client";

import { useEffect, useRef, type ComponentProps } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';

import type { Task } from '~/lib/api/types/console';

import {
  formatRelative,
  getStatusMeta,
  getTaskTypeLabel,
  summarizeError,
} from './task-utils';

type TaskTableProps = {
  tasks: Task[];
  isLoading: boolean;
  isRefreshing?: boolean;
  onSelect: (task: Task) => void;
  onCancel: (task: Task) => void;
  onRetry: (task: Task) => void;
  pendingIds?: Set<string>;
  maxHeight?: number;
  scrollKey?: string;
};

const DEFAULT_MAX_HEIGHT = 560;
const ROW_ESTIMATE = 120;

export default function TaskTable({
  tasks,
  isLoading,
  isRefreshing = false,
  onSelect,
  onCancel,
  onRetry,
  pendingIds,
  maxHeight = DEFAULT_MAX_HEIGHT,
  scrollKey,
}: TaskTableProps) {
  const hasTasks = tasks.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 6,
    getItemKey: (index) => tasks[index]?.id ?? index,
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
      <div className="hidden border-b border-border bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(220px,1.2fr)_0.7fr_0.6fr_0.6fr_0.6fr_0.8fr_130px] lg:gap-4">
        <span>任务信息</span>
        <span>类型</span>
        <span>状态</span>
        <span>Tokens</span>
        <span>进度</span>
        <span>更新时间</span>
        <span className="text-right">操作</span>
      </div>

      {isLoading && !hasTasks ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : hasTasks ? (
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight }}>
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const task = tasks[virtualRow.index];

              if (!task) {
                return null;
              }

              const isLast = virtualRow.index === tasks.length - 1;
              const isPending = pendingIds?.has(task.id) ?? false;

              return (
                <div
                  key={task.id}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 right-0"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <TaskRow
                    task={task}
                    isLast={isLast}
                    isPending={isPending}
                    onSelect={onSelect}
                    onCancel={onCancel}
                    onRetry={onRetry}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          没有符合条件的任务
        </div>
      )}

      {isRefreshing ? (
        <div className="border-t border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
          正在刷新任务状态…
        </div>
      ) : null}
    </div>
  );
}

type TaskRowProps = {
  task: Task;
  isLast: boolean;
  isPending: boolean;
  onSelect: (task: Task) => void;
  onCancel: (task: Task) => void;
  onRetry: (task: Task) => void;
};

function TaskRow({ task, isLast, isPending, onSelect, onCancel, onRetry }: TaskRowProps) {
  const typeLabel = getTaskTypeLabel(task.type);
  const statusMeta = getStatusMeta(task.status);
  const errorSummary = summarizeError(task.error);
  const rowBorder = isLast ? 'border-b-0' : 'border-b border-border';

  return (
    <div
      className={`flex flex-col gap-3 bg-background px-4 py-4 transition hover:bg-muted/40 lg:grid lg:grid-cols-[minmax(220px,1.2fr)_0.7fr_0.6fr_0.6fr_0.6fr_0.8fr_130px] lg:items-center lg:gap-4 ${rowBorder}`}
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onSelect(task)}
          className="max-w-full text-left text-sm font-semibold text-foreground hover:text-primary"
        >
          任务 {task.id}
        </button>
        <div className="text-xs text-muted-foreground">
          用户 {task.userId ?? '—'}
        </div>
        {task.offerUrl ? (
          <a
            href={task.offerUrl}
            target="_blank"
            rel="noreferrer"
            className="max-w-full truncate text-xs text-primary underline-offset-4 hover:underline"
          >
            {task.offerUrl}
          </a>
        ) : null}
        {errorSummary ? (
          <div className="text-xs text-destructive">{errorSummary}</div>
        ) : null}
      </div>

      <div className="text-xs text-muted-foreground">
        {typeLabel}
      </div>

      <div>
        <Badge size="small" color={statusToneToBadge(statusMeta.tone)}>
          {statusMeta.label}
        </Badge>
      </div>

      <div className="text-sm font-medium text-foreground">
        {task.tokensConsumed.toLocaleString()}
      </div>

      <div className="text-sm text-muted-foreground">
        {typeof task.progress === 'number' ? `${Math.round(task.progress * 100)}%` : '—'}
      </div>

      <div className="text-xs text-muted-foreground">
        {formatRelative(task.updatedAt)}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onSelect(task)}>
          详情
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRetry(task)}
          disabled={isPending || task.status === 'running' || task.status === 'pending'}
        >
          重试
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCancel(task)}
          disabled={isPending || task.status !== 'running'}
        >
          取消
        </Button>
      </div>
    </div>
  );
}

function statusToneToBadge(
  tone: 'success' | 'warn' | 'error' | 'info' | 'secondary',
): ComponentProps<typeof Badge>['color'] {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    case 'info':
      return 'info';
    case 'secondary':
    default:
      return 'normal';
  }
}
