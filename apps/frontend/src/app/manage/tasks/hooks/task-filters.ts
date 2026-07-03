import type { Task } from '~/lib/api/types/console';

export const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'running', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

export const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'evaluation', label: '评估任务' },
  { value: 'deployment', label: '部署任务' },
  { value: 'click_task', label: '点击任务' },
  { value: 'sync', label: '同步任务' },
  { value: 'other', label: '其它任务' },
];

export const ATTENTION_OPTIONS = [
  { value: 'all', label: '全部任务' },
  { value: 'in_progress', label: '进行中' },
  { value: 'needs_attention', label: '需要处理' },
];

export type AttentionFilter = (typeof ATTENTION_OPTIONS)[number]['value'];

export function matchesAttention(task: Task, attention: AttentionFilter): boolean {
  if (attention === 'all') {
    return true;
  }

  if (attention === 'in_progress') {
    return task.status === 'running' || task.status === 'pending';
  }

  if (attention === 'needs_attention') {
    return task.status === 'failed' || task.status === 'cancelled' || Boolean(task.error);
  }

  return true;
}
