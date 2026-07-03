"use client";

import { useMemo, type ComponentProps } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';

import type { Task } from '~/lib/api/types/console';

import {
  buildTaskSteps,
  formatDateTime,
  formatRelative,
  getStatusMeta,
  getTaskTypeLabel,
} from './task-utils';

type TaskDetailSheetProps = {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelRequest: (task: Task) => void;
  onRetryRequest: (task: Task) => void;
  pendingIds?: Set<string>;
};

export default function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onCancelRequest,
  onRetryRequest,
  pendingIds,
}: TaskDetailSheetProps) {
  const statusMeta = task ? getStatusMeta(task.status) : null;
  const steps = useMemo(() => (task ? buildTaskSteps(task) : []), [task]);
  const isPending = task ? pendingIds?.has(task.id) ?? false : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>{task ? `任务 ${task.id}` : '任务详情'}</SheetTitle>
          <SheetDescription>
            查看任务执行步骤、关联资源与可执行操作。
          </SheetDescription>
        </SheetHeader>

        {task ? (
          <div className="mt-6 space-y-6">
            <section className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
              <DetailField label="任务类型" value={getTaskTypeLabel(task.type)} />
              <DetailField label="用户 ID" value={task.userId ?? '—'} />
              <DetailField label="Offer ID" value={task.offerId ?? '—'} />
              <DetailField label="广告账号" value={task.adsAccountId ?? '—'} />
              <DetailField label="Tokens" value={task.tokensConsumed.toLocaleString()} />
              <DetailField
                label="进度"
                value={typeof task.progress === 'number' ? `${Math.round(task.progress * 100)}%` : '—'}
              />
              <DetailField label="创建时间" value={formatDateTime(task.createdAt) ?? '—'} />
              <DetailField label="更新时间" value={formatDateTime(task.updatedAt) ?? '—'} />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">状态</span>
                {statusMeta ? (
                  <Badge size="small" color={statusToneToBadge(statusMeta.tone)}>
                    {statusMeta.label}
                  </Badge>
                ) : null}
              </div>
            </section>

            {task.error ? (
              <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <h3 className="text-sm font-semibold text-destructive">错误信息</h3>
                <p className="mt-2 whitespace-pre-wrap text-xs text-destructive">
                  {task.error}
                </p>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">执行时间线</h3>
              <ol className="space-y-3 border-l border-border pl-6">
                {steps.map((step) => (
                  <li key={step.label} className="relative">
                    <span
                      className={`absolute -left-[11px] top-1 h-2.5 w-2.5 rounded-full border border-background ${
                        step.status === 'done'
                          ? 'bg-primary'
                          : step.status === 'current'
                            ? 'bg-amber-500'
                            : 'bg-muted'
                      }`}
                    />
                    <div className="text-sm font-medium text-foreground">{step.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {step.timestamp ?? '等待执行'}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">关联链接</h3>
              <ul className="space-y-2 text-xs text-primary">
                {task.offerId ? (
                  <li>
                    <a
                      href={`/offers?focus=${task.offerId}`}
                      className="hover:underline"
                    >
                      查看关联 Offer
                    </a>
                  </li>
                ) : null}
                {task.adsAccountId ? (
                  <li>
                    <a
                      href={`/adscenter?account=${task.adsAccountId}`}
                      className="hover:underline"
                    >
                      查看广告账号
                    </a>
                  </li>
                ) : null}
                <li>
                  <a href={`/tasks?focus=${task.id}`} className="hover:underline">
                    在仪表板中查看
                  </a>
                </li>
              </ul>
            </section>

            <section className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetryRequest(task)}
                disabled={isPending || task.status === 'running' || task.status === 'pending'}
              >
                重试任务
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCancelRequest(task)}
                disabled={isPending || task.status !== 'running'}
              >
                取消任务
              </Button>
              <span className="text-xs text-muted-foreground">
                最近更新 {formatRelative(task.updatedAt)}
              </span>
            </section>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">请选择一个任务查看详情。</p>
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
