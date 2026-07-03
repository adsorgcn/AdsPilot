import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type { TasksListParams } from '../types';

export function buildTasksEndpoint(
  params: TasksListParams,
  basePath: string = API_ENDPOINTS.CONSOLE.TASKS,
) {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set('status', params.status);
  }

  if (params.type) {
    searchParams.set('type', params.type);
  }

  if (typeof params.page === 'number') {
    searchParams.set('page', String(params.page));
  }

  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }

  if (params.sortBy) {
    searchParams.set('sort_by', params.sortBy);
  }

  if (params.sortOrder) {
    searchParams.set('sort_order', params.sortOrder);
  }

  const query = searchParams.toString();

  return `${basePath}${query ? `?${query}` : ''}`;
}

export function parseSseEvent(
  rawEvent: string,
): { event: string; data?: string } | null {
  if (!rawEvent.trim()) {
    return null;
  }

  const lines = rawEvent.split('\n');
  let eventType = 'message';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const value = line.slice(5).trimStart();
      data += value + '\n';
    }
  }

  if (data.endsWith('\n')) {
    data = data.slice(0, -1);
  }

  return {
    event: eventType,
    data: data || undefined,
  };
}
