import { toast } from 'sonner';
import { exportToCsv } from '~/lib/utils/csv-export';
import type { Task } from '~/lib/api/types/console';
import { summarizeError } from '../components/task-utils';

export function exportTasksToCsv(tasks: Task[]) {
  if (!tasks.length) {
    toast.info('没有可导出的任务');
    return;
  }

  exportToCsv(
    tasks,
    [
      { key: 'id', label: 'Task ID' },
      { key: 'userId', label: 'User ID' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'tokensConsumed', label: 'Tokens' },
      { key: 'progress', label: 'Progress' },
      {
        key: 'error',
        label: 'Error',
        format: (value) => summarizeError(String(value ?? '')) ?? '',
      },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ],
    `console-tasks-${new Date().toISOString().split('T')[0]}.csv`,
  );
  toast.success(`已导出 ${tasks.length} 个任务`);
}
