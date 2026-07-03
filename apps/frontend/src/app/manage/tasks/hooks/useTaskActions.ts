import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Task } from '~/lib/api/types/console';
import { cancelTask, retryTask } from '~/lib/api/console';

/**
 * 任务操作hooks (取消、重试)
 */
export function useTaskActions(refetch: () => Promise<any>) {
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(
    new Set(),
  );

  const openCancelDialog = useCallback((task: Task) => {
    setActionTask(task);
    setCancelDialogOpen(true);
  }, []);

  const openRetryDialog = useCallback((task: Task) => {
    setActionTask(task);
    setRetryDialogOpen(true);
  }, []);

  const handleCancelTask = useCallback(
    async (values: Record<string, string>) => {
      if (!actionTask) {
        return;
      }

      const taskId = actionTask.id;
      setPendingActionIds((prev) => new Set(prev).add(taskId));

      try {
        await cancelTask(taskId, values.reason);
        toast.success('任务已取消');
        setCancelDialogOpen(false);
        setActionTask(null);
        await refetch();
      } catch (err) {
        console.error('Cancel task failed', err);
        toast.error('取消失败，请稍后再试');
        throw err;
      } finally {
        setPendingActionIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [actionTask, refetch],
  );

  const handleRetryTask = useCallback(async () => {
    if (!actionTask) {
      return;
    }

    const taskId = actionTask.id;
    setPendingActionIds((prev) => new Set(prev).add(taskId));

    try {
      await retryTask(taskId);
      toast.success('任务已重新提交');
      setRetryDialogOpen(false);
      setActionTask(null);
      await refetch();
    } catch (err) {
      console.error('Retry task failed', err);
      toast.error('重试失败，请稍后再试');
    } finally {
      setPendingActionIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [actionTask, refetch]);

  return {
    actionTask,
    cancelDialogOpen,
    retryDialogOpen,
    pendingActionIds,
    setCancelDialogOpen,
    setRetryDialogOpen,
    openCancelDialog,
    openRetryDialog,
    handleCancelTask,
    handleRetryTask,
  };
}
