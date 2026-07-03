"use client";

import { useTranslation } from 'react-i18next';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import Button from '~/core/ui/Button';
import Spinner from '~/core/ui/Spinner';
import { ResourceTableSkeleton } from '~/core/ui/ResourceState';

import type { Task } from '~/lib/tasks';

import TaskStatusBadge from './TaskStatusBadge';
import TaskTypeBadge from './TaskTypeBadge';

type Props = {
  tasks: Task[];
  isLoading: boolean;
  onCancel: (task: Task) => void;
  onRetry: (task: Task) => void;
  pendingIds: Set<string>;
};

function TasksTable({ tasks, isLoading, onCancel, onRetry, pendingIds }: Props) {
  const { t } = useTranslation('common');

  if (!isLoading && tasks.length === 0) {
    return null;
  }

  return (
    <div className={'overflow-hidden rounded-lg border border-border bg-background'}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tasks.table.task')}</TableHead>
            <TableHead className={'hidden lg:table-cell'}>{t('tasks.table.status')}</TableHead>
            <TableHead className={'hidden xl:table-cell'}>{t('tasks.table.progress')}</TableHead>
            <TableHead className={'hidden xl:table-cell'}>{t('tasks.table.tokens')}</TableHead>
            <TableHead className={'hidden lg:table-cell'}>{t('tasks.table.createdAt')}</TableHead>
            <TableHead className={'w-44 text-right'}>{t('tasks.table.actions')}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <ResourceTableSkeleton rows={4} columns={5} />
          ) : (
            tasks.map((task) => {
              const pending = pendingIds.has(task.id);

              return (
                <TableRow key={task.id} className={'align-top'}>
                  <TableCell>
                    <div className={'flex flex-col space-y-1'}>
                      <TaskTypeBadge type={task.type} />

                      {task.offerUrl ? (
                        <a
                          href={task.offerUrl}
                          target={'_blank'}
                          rel={'noreferrer'}
                          className={'text-sm text-primary underline-offset-4 hover:underline'}
                        >
                          {task.offerUrl}
                        </a>
                      ) : null}

                      {task.currentStep ? (
                        <span className={'text-sm text-muted-foreground'}>
                          {t('tasks.table.currentStep')}{task.currentStep}
                        </span>
                      ) : null}

                      {task.error ? (
                        <span className={'text-sm text-red-500'}>{task.error}</span>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className={'hidden lg:table-cell'}>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>

                  <TableCell className={'hidden xl:table-cell text-sm text-muted-foreground'}>
                    {typeof task.progress === 'number'
                      ? `${Math.round(task.progress)}%`
                      : '--'}
                  </TableCell>

                  <TableCell className={'hidden xl:table-cell text-sm text-muted-foreground'}>
                    {formatNumber(task.tokensConsumed)}
                    {task.estimatedTokens
                      ? ` / ${t('tasks.table.estimated')} ${formatNumber(task.estimatedTokens)}`
                      : ''}
                  </TableCell>

                  <TableCell className={'hidden lg:table-cell text-sm text-muted-foreground'}>
                    {formatDate(task.createdAt)}
                  </TableCell>

                  <TableCell>
                    <div className={'flex justify-end space-x-2'}>
                      <Button
                        size={'sm'}
                        variant={'outline'}
                        onClick={() => onRetry(task)}
                        disabled={pending || task.status === 'running'}
                      >
                        {pending ? <Spinner className={'h-4 w-4'} /> : t('tasks.table.retry')}
                      </Button>

                      <Button
                        size={'sm'}
                        variant={'ghost'}
                        onClick={() => onCancel(task)}
                        disabled={pending || task.status !== 'running'}
                      >
                        {t('tasks.table.cancel')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function formatNumber(value?: number) {
  if (typeof value !== 'number') {
    return '--';
  }

  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default TasksTable;
