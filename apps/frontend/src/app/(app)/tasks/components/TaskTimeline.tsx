'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ResourceEmptyState,
  ResourceListSkeleton,
} from '~/core/ui/ResourceState';
import TaskStatusBadge from './TaskStatusBadge';
import TaskTypeBadge from './TaskTypeBadge';

import type { Task } from '~/lib/tasks';

type TaskTimelineProps = {
  tasks: Task[];
  isLoading: boolean;
};

type StepStatus = 'done' | 'current' | 'upcoming';

export default function TaskTimeline({ tasks, isLoading }: TaskTimelineProps) {
  const { t } = useTranslation('common');
  const timelineTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      })
      .slice(0, 15);
  }, [tasks]);

  if (isLoading && timelineTasks.length === 0) {
    return <ResourceListSkeleton rows={4} />;
  }

  if (!isLoading && timelineTasks.length === 0) {
    return (
      <ResourceEmptyState
        title={t('tasks.timeline.emptyTitle')}
        description={t('tasks.timeline.emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {timelineTasks.map((task) => (
        <article key={task.id} className="rounded-lg border bg-card p-4">
          <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TaskTypeBadge type={task.type} />
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t('tasks.timeline.taskId')}：</span>
                {task.id}
              </div>
              {task.offerUrl ? (
                <a
                  href={task.offerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {task.offerUrl}
                </a>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground md:items-end">
              <div>
                <span className="font-medium text-foreground">Tokens：</span>
                {typeof task.tokensConsumed === 'number'
                  ? task.tokensConsumed.toLocaleString()
                  : '—'}
              </div>
              {task.error ? (
                <div className="flex items-center gap-1 text-destructive">
                  <XMarkIcon className="h-4 w-4" />
                  <span>{task.error}</span>
                </div>
              ) : null}
            </div>
          </header>

          <ol className="mt-4 space-y-3 border-l border-border pl-6">
            {buildSteps(task, t).map((step) => (
              <li key={step.label} className="relative">
                <span
                  className={`absolute -left-[13px] top-1 h-2.5 w-2.5 rounded-full border border-background ${
                    step.status === 'done'
                      ? 'bg-primary'
                      : step.status === 'current'
                        ? 'bg-amber-500'
                        : 'bg-muted'
                  }`}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {step.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {step.timestamp ?? t('tasks.timeline.pending')}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

function buildSteps(task: Task, t: (key: string) => string): Array<{ label: string; timestamp: string | null; status: StepStatus }> {
  const submittedAt = formatDateTime(task.createdAt);
  const startedAt = formatDateTime(task.startedAt ?? null);
  const completedAt = formatDateTime(task.completedAt ?? null);

  // const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const isRunning = task.status === 'running';
  const isPending = task.status === 'pending';

  return [
    {
      label: t('tasks.timeline.submitted'),
      timestamp: submittedAt,
      status: 'done',
    },
    {
      label: t('tasks.timeline.processing'),
      timestamp: startedAt,
      status: startedAt ? 'done' : isPending ? 'current' : 'upcoming',
    },
    {
      label: isFailed ? t('tasks.timeline.failed') : t('tasks.timeline.completed'),
      timestamp: completedAt,
      status: completedAt
        ? 'done'
        : isRunning
          ? 'current'
          : 'upcoming',
    },
  ];
}

function formatDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function XMarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
