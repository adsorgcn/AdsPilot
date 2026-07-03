export type TaskType = 'evaluation' | 'click_task' | 'deployment' | 'sync' | 'other';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  offerId?: string;
  offerUrl?: string;
  adsAccountId?: string;
  progress?: number;
  currentStep?: string;
  tokensConsumed: number;
  estimatedTokens?: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export type { TokenBalance, RawTokenBalance } from '../billing/types';

export interface TasksListParams {
  type?: TaskType;
  status?: TaskStatus;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'updated_at' | 'tokens_consumed';
  sortOrder?: 'asc' | 'desc';
}

export interface TasksListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RawTask {
  id: string;
  type: string;
  status: string;
  offer_id?: string;
  offer_url?: string;
  ads_account_id?: string;
  progress?: number;
  current_step?: string;
  tokens_consumed: number;
  estimated_tokens?: number;
  result?: unknown;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface TasksListApiResponse {
  tasks: RawTask[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CancelTaskPayload {
  taskId: string;
  reason?: string;
}

export interface RetryTaskPayload {
  taskId: string;
}
