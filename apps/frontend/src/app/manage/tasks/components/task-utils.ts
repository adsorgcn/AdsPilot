import type { Task } from '~/lib/api/types/console';

export type TaskStepStatus = 'done' | 'current' | 'upcoming';

export type TaskStep = {
  label: string;
  timestamp: string | null;
  status: TaskStepStatus;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    tone: 'success' | 'warn' | 'error' | 'info' | 'secondary';
  }
> = {
  pending: { label: 'Pending', tone: 'info' },
  running: { label: 'Running', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'secondary' },
};

const TYPE_LABELS: Record<string, string> = {
  evaluation: 'Evaluation',
  deployment: 'Deployment',
  click_task: 'Click Task',
  sync: 'Sync',
  other: 'Other',
};

export function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: 'secondary' };
}

export function getTaskTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

export function buildTaskSteps(task: Task): TaskStep[] {
  const submittedAt = formatDateTime(task.createdAt);
  const startedAt = formatDateTime(task.startedAt);
  const completedAt = formatDateTime(task.completedAt);

  const status = task.status;

  return [
    {
      label: 'Submitted',
      timestamp: submittedAt,
      status: 'done',
    },
    {
      label: 'Processing',
      timestamp: startedAt,
      status: startedAt ? 'done' : status === 'pending' ? 'current' : 'upcoming',
    },
    {
      label: status === 'failed' ? 'Failed' : 'Completed',
      timestamp: completedAt,
      status: completedAt
        ? 'done'
        : status === 'running'
          ? 'current'
          : 'upcoming',
    },
  ];
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

export function formatRelative(value?: string | null) {
  if (!value) {
    return '—';
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
    return `${minutes} min ago`;
  }

  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / hour));
    return `${hours} hr ago`;
  }

  const days = Math.round(diff / day);
  return `${days} d ago`;
}

export function summarizeError(text?: string | null) {
  if (!text) {
    return null;
  }

  if (text.length <= 96) {
    return text;
  }

  return `${text.slice(0, 93)}...`;
}
