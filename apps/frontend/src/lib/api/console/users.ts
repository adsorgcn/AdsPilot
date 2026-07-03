import { consoleApi } from '~/lib/api';
import type { User, UserSearchResponse, UserActivityTimelineResponse } from '~/lib/api/types/console';

export interface UserSearchParams {
  q?: string;
  query?: string;
  status?: string;
  tag?: string;
  limit?: number;
}

export async function searchUsers(params: UserSearchParams = {}, signal?: AbortSignal): Promise<UserSearchResponse> {
  return consoleApi.searchUsers(params, { signal });
}

export async function fetchUserActivityTimeline(
  userId: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<UserActivityTimelineResponse> {
  return consoleApi.getUserActivityTimeline(userId, limit, { signal });
}

export async function addUserTag(userId: string, tag: string, note?: string) {
  return consoleApi.addUserTag(userId, tag, note);
}

export async function removeUserTag(userId: string, tag: string) {
  return consoleApi.removeUserTag(userId, tag);
}
