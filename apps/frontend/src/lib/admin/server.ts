import { serverApiRequest } from '~/lib/server/api-client';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type {
  AdminAuditLogListResponse,
  AdminImpersonationEventListResponse,
  AdminStatsResponse,
  AdminUser,
  AdminUserDetailResponse,
  AdminUserListResponse,
} from './types';

export interface ListUsersParams {
  page?: number;
  perPage?: number;
}

export async function fetchAdminUsers(params: ListUsersParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.perPage) {
    searchParams.set('per_page', String(params.perPage));
  }

  const query = searchParams.toString();

  return serverApiRequest<AdminUserListResponse>(
    `/api/v1/console/users${query ? `?${query}` : ''}`,
  );
}

export async function fetchAdminUser(userId: string) {
  return serverApiRequest<AdminUserDetailResponse>(
    `/api/v1/console/users/${encodeURIComponent(userId)}`,
  );
}

export async function fetchAdminStats() {
  return serverApiRequest<AdminStatsResponse>(API_ENDPOINTS.CONSOLE.STATS);
}

export interface AuditLogQuery {
  page?: number;
  perPage?: number;
  action?: string;
  resource?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchAdminAuditLogs(params: AuditLogQuery = {}) {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.perPage) {
    searchParams.set('per_page', String(params.perPage));
  }
  if (params.action) {
    searchParams.set('action', params.action);
  }
  if (params.resource) {
    searchParams.set('resource', params.resource);
  }
  if (params.userId) {
    searchParams.set('userId', params.userId);
  }
  if (params.startDate) {
    searchParams.set('startDate', params.startDate);
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate);
  }

  const query = searchParams.toString();

  return serverApiRequest<AdminAuditLogListResponse>(
    `/api/v1/console/audit${query ? `?${query}` : ''}`,
  );
}

export interface ImpersonationQuery {
  page?: number;
  perPage?: number;
  adminId?: string;
  targetUserId?: string;
}

export async function fetchImpersonationEvents(
  params: ImpersonationQuery = {},
) {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.perPage) {
    searchParams.set('per_page', String(params.perPage));
  }
  if (params.adminId) {
    searchParams.set('adminId', params.adminId);
  }
  if (params.targetUserId) {
    searchParams.set('targetUserId', params.targetUserId);
  }

  const query = searchParams.toString();

  return serverApiRequest<AdminImpersonationEventListResponse>(
    `/api/v1/console/audit/impersonation${query ? `?${query}` : ''}`,
  );
}

export interface UpdateUserRequest {
  email?: string;
  role?: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
  banDuration?: string;
}

export async function updateAdminUser(
  userId: string,
  body: UpdateUserRequest,
) {
  return serverApiRequest<AdminUser>(`/api/v1/console/users/${userId}`, {
    method: 'PUT',
    json: body,
  });
}

export async function deleteAdminUser(userId: string) {
  await serverApiRequest<void>(`/api/v1/console/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function banAdminUser(userId: string, duration = '8760h') {
  return updateAdminUser(userId, { banDuration: duration });
}

export async function reactivateAdminUser(userId: string) {
  return updateAdminUser(userId, { banDuration: 'none' });
}

export async function impersonateAdminUser(userId: string) {
  return serverApiRequest<{
    accessToken: string;
    refreshToken: string;
    redirectTo?: string;
  }>(`/api/v1/console/users/${userId}/impersonate`, {
    method: 'POST',
  });
}


