import type {
  RawTask,
  Task,
  TaskStatus,
  TaskType,
  TasksListApiResponse,
  TasksListResponse,
} from '../types';

export function mapTasksListResponse(data: TasksListApiResponse): TasksListResponse {
  return {
    tasks: data.tasks.map(mapTask),
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.total_pages,
  };
}

export function mapTask(task: RawTask): Task {
  return {
    id: task.id,
    type: normalizeTaskType(task.type),
    status: normalizeTaskStatus(task.status),
    offerId: task.offer_id,
    offerUrl: task.offer_url,
    adsAccountId: task.ads_account_id,
    progress: task.progress,
    currentStep: task.current_step,
    tokensConsumed: task.tokens_consumed,
    estimatedTokens: task.estimated_tokens,
    result: task.result,
    error: task.error,
    createdAt: task.created_at,
    startedAt: task.started_at,
    completedAt: task.completed_at,
    updatedAt: task.updated_at,
  };
}

function normalizeTaskType(value?: string): TaskType {
  const lower = (value ?? '').toLowerCase();

  switch (lower) {
    case 'evaluation':
    case 'evaluate':
      return 'evaluation';
    case 'click_task':
    case 'click-task':
      return 'click_task';
    case 'deployment':
      return 'deployment';
    case 'sync':
      return 'sync';
    default:
      return 'other';
  }
}

function normalizeTaskStatus(value?: string): TaskStatus {
  const lower = (value ?? '').toLowerCase();

  switch (lower) {
    case 'pending':
    case 'queued':
      return 'pending';
    case 'running':
    case 'in_progress':
      return 'running';
    case 'completed':
    case 'success':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
}
