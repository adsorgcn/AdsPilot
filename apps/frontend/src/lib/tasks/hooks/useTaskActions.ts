import { useCallback } from 'react';

import { apiPost } from '~/lib/api';

import type { CancelTaskPayload, RetryTaskPayload } from '../types';

/**
 * 取消任务
 */
export function useCancelTask() {
  return useCallback(async ({ taskId, reason }: CancelTaskPayload) => {
    await apiPost(`/api/v1/tasks/${taskId}/cancel`, {
      reason,
    });
  }, []);
}

/**
 * 重试失败任务
 */
export function useRetryTask() {
  return useCallback(async ({ taskId }: RetryTaskPayload) => {
    await apiPost(`/api/v1/tasks/${taskId}/retry`, {});
  }, []);
}
