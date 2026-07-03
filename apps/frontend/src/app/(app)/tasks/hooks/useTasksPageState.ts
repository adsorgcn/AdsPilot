import { useState, useTransition, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
  useCancelTask,
  useRetryTask,
  useTasksStream,
  useTokenBalance,
  type Task,
  type TaskStatus,
} from '~/lib/tasks';

export type StatusFilter = TaskStatus | 'all';

export function useTasksPageState() {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [isActionPending, startActionTransition] = useTransition();

  const cancelTask = useCancelTask();
  const retryTask = useRetryTask();

  const { balance, isLoading: isBalanceLoading, refetch: mutateBalance } =
    useTokenBalance();

  const {
    tasks,
    isLoading,
    error,
    mutate: refreshTasks,
  } = useTasksStream({
    status: status === 'all' ? undefined : status,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const hasTasks = tasks.length > 0;
  const isInitialLoading = isLoading && !hasTasks;

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('tasks.statusAll') },
      { value: 'pending', label: t('tasks.statusPending') },
      { value: 'running', label: t('tasks.statusRunning') },
      { value: 'completed', label: t('tasks.statusCompleted') },
      { value: 'failed', label: t('tasks.statusFailed') },
      { value: 'cancelled', label: t('tasks.statusCancelled') },
    ],
    [t],
  );

  const handleCancel = (task: Task) => {
    if (!window.confirm(t('tasks.confirmCancel'))) {
      return;
    }

    setPending((prev) => new Set(prev).add(task.id));

    startActionTransition(async () => {
      try {
        await cancelTask({ taskId: task.id });
        toast.success(t('tasks.messages.taskCancelled'));
        await Promise.all([refreshTasks(), mutateBalance()]);
      } catch (error) {
        const message = error instanceof Error ? error.message : t('tasks.messages.cancelFailed');
        toast.error(message);
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    });
  };

  const handleRetry = (task: Task) => {
    setPending((prev) => new Set(prev).add(task.id));

    startActionTransition(async () => {
      try {
        await retryTask({ taskId: task.id });
        toast.success(t('tasks.messages.taskRetried'));
        await refreshTasks();
      } catch (error) {
        const message = error instanceof Error ? error.message : t('tasks.messages.retryFailed');
        toast.error(message);
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    });
  };

  return {
    // State
    status,
    setStatus,
    pending,
    isActionPending,

    // Data
    tasks,
    balance,
    statusOptions,

    // Loading states
    isLoading,
    isBalanceLoading,
    isInitialLoading,
    hasTasks,

    // Error
    error,

    // Actions
    handleCancel,
    handleRetry,
    refreshTasks,
  };
}
