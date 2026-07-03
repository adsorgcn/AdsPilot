import resolveApiPath from '~/lib/api/resolve-api-path';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import requireSession from '~/lib/user/require-session';

type ServerApiRequestOptions = RequestInit & {
  requireAuth?: boolean;
  adminClient?: boolean;
  json?: unknown;
};

export class ServerApiError<T = unknown> extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: T,
  ) {
    super(message);
    this.name = 'ServerApiError';
  }
}

export async function serverApiRequest<T = unknown>(
  endpoint: string,
  options: ServerApiRequestOptions = {},
): Promise<T> {
  const { requireAuth = true, adminClient = false, json, headers, ...init } =
    options;

  const requestHeaders = new Headers(headers);

  if (json !== undefined) {
    if (!(json instanceof FormData)) {
      requestHeaders.set('Content-Type', 'application/json');
    }
    init.body =
      json instanceof FormData ? json : JSON.stringify(json, jsonReplacer);
  }

  let accessToken: string | null = null;

  if (requireAuth) {
    const client = await getSupabaseServerComponentClient(
      adminClient ? { admin: true } : undefined,
    );
    const session = await requireSession(client);

    accessToken = session.access_token ?? null;

    if (!accessToken) {
      throw new ServerApiError(401, 'UNAUTHENTICATED', 'Supabase session 无效');
    }

    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    requestHeaders.set('X-Supabase-Access-Token', accessToken);
  }

  const url = resolveApiPath(endpoint);

  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
  });

  const rawBody = await response.text();
  let parsedBody: unknown = undefined;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    const error = normalizeError(parsedBody, response.status, response.statusText);
    throw error;
  }

  if (parsedBody === undefined || parsedBody === null) {
    return undefined as T;
  }

  if (typeof parsedBody === 'object' && parsedBody !== null) {
    const payload = parsedBody as Record<string, unknown>;

    if (typeof payload.success === 'boolean') {
      if (payload.success) {
        return (payload.data ?? null) as T;
      }

      const errorBlock = payload.error as
        | { code?: string; message?: string; details?: unknown }
        | undefined;

      throw new ServerApiError(
        response.status,
        errorBlock?.code ?? 'API_ERROR',
        errorBlock?.message ?? '接口返回失败',
        errorBlock?.details,
      );
    }

    return payload as T;
  }

  return parsedBody as T;
}

function normalizeError(
  payload: unknown,
  status: number,
  fallbackMessage: string,
) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    const code = typeof record.code === 'string' ? record.code : 'API_ERROR';
    const message =
      typeof record.message === 'string' ? record.message : fallbackMessage;
    const details = record.details ?? record.error ?? record;

    return new ServerApiError(status, code, message, details);
  }

  return new ServerApiError(
    status,
    'API_ERROR',
    fallbackMessage || '请求失败',
    payload,
  );
}

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
}

