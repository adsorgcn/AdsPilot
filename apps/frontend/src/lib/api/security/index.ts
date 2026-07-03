import { LoginHistoryResponse, ActiveSessionsResponse } from './types';

const BASE_PATH = '/api/security';

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();

  return queryString ? `${BASE_PATH}${path}?${queryString}` : `${BASE_PATH}${path}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');

  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('响应格式异常，请稍后重试');
  }

  return (await response.json()) as T;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return parseJsonResponse<T>(response);
  }

  try {
    const payload = await parseJsonResponse<{ error?: string }>(response);
    throw new Error(payload.error ?? '请求失败，请稍后再试');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('请求失败，请稍后再试');
  }
}

export async function fetchLoginHistory(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<LoginHistoryResponse> {
  const limit = params.limit ?? 20;
  const url = buildUrl('/login-history', { limit });

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  return handleResponse<LoginHistoryResponse>(response);
}

export async function fetchActiveSessions(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<ActiveSessionsResponse> {
  const limit = params.limit ?? 20;
  const url = buildUrl('/sessions', { limit });

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  return handleResponse<ActiveSessionsResponse>(response);
}

export async function revokeSession(sessionId: string): Promise<void> {
  const response = await fetch(buildUrl(`/sessions/${encodeURIComponent(sessionId)}`), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.ok) {
    return;
  }

  try {
    const payload = await parseJsonResponse<{ error?: string }>(response);
    throw new Error(payload.error ?? '注销会话失败，请稍后再试');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('注销会话失败，请稍后再试');
  }
}
