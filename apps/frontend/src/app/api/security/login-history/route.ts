import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getSupabaseClientKeys from '~/core/supabase/get-supabase-client-keys';
import type { LoginHistoryEntry, SecurityStatus } from '~/lib/api/security/types';

type AuthAuditLogEntry = {
  id: string;
  created_at: string;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  user_id: string | null;
};

type AuthAuditLogResponse = {
  data: AuthAuditLogEntry[] | null;
  error: {
    message: string;
    code: string;
  } | null;
};

interface AuthSchema {
  Tables: {
    audit_log_entries: {
      Row: AuthAuditLogEntry;
      Insert: never;
      Update: never;
    };
  };
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
}

export async function GET(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json(
      { error: '无法校验当前用户身份' },
      { status: 500 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: '未登录或会话已失效' },
      { status: 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);

  let limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 20;
  limit = Math.min(limit, 100);

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase 服务凭据未配置，无法获取登录历史' },
      { status: 500 },
    );
  }

  const { url } = getSupabaseClientKeys();

  const adminClient = createClient<AuthSchema>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error }: AuthAuditLogResponse = await adminClient
    .from('audit_log_entries')
    .select('id, created_at, event_type, payload, user_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Security] 获取登录历史失败', error);

    return NextResponse.json(
      { error: '获取登录历史失败，请稍后再试' },
      { status: 500 },
    );
  }

  const items: LoginHistoryEntry[] = (data ?? []).map(normalizeAuditEntry);

  return NextResponse.json({ items });
}

function normalizeAuditEntry(entry: AuthAuditLogEntry): LoginHistoryEntry {
  const payload = (entry.payload ?? {}) as Record<string, unknown>;
  const event =
    getString(payload.event) ??
    getString(payload.event_type) ??
    getString(payload.action) ??
    entry.event_type ??
    'unknown';

  const status = inferStatus(event, payload);

  const ip =
    getString(payload.ip) ??
    getString(payload.ip_address) ??
    getString(payload.ipAddress);

  const userAgent =
    getString(payload.user_agent) ??
    getString(payload.userAgent) ??
    getString(payload.ua) ??
    getString(payload.useragent);

  const locationPayload =
    (payload.location as Record<string, unknown> | null | undefined) ??
    (payload.geo as Record<string, unknown> | null | undefined) ??
    (payload.metadata as Record<string, unknown> | null | undefined)?.location ??
    null;

  const location = locationPayload
    ? {
        city: getString((locationPayload as any).city),
        country: getString((locationPayload as any).country),
        region: getString((locationPayload as any).region),
      }
    : null;

  const description =
    getString(payload.description) ??
    getString(payload.message) ??
    getString(payload.detail) ??
    null;

  return {
    id: entry.id,
    occurredAt: entry.created_at,
    event,
    status,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
    location,
    description,
    metadata: sanitizeMetadata(payload),
  };
}

function getString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return null;
}

function inferStatus(event: string, payload: Record<string, unknown>): SecurityStatus {
  const eventLower = event.toLowerCase();
  const statusValue =
    getString(payload.status) ??
    getString(payload.result) ??
    getString(payload.outcome) ??
    getString((payload.context as Record<string, unknown> | undefined)?.status);

  const statusLower = statusValue?.toLowerCase();

  if (
    (statusLower && statusLower.includes('fail')) ||
    eventLower.includes('fail') ||
    eventLower.includes('error') ||
    eventLower.includes('block')
  ) {
    return 'failure';
  }

  if (
    (statusLower && statusLower.includes('success')) ||
    eventLower.includes('login') ||
    eventLower.includes('signin') ||
    eventLower.includes('mfa') ||
    eventLower.includes('verified')
  ) {
    return 'success';
  }

  return 'info';
}

function sanitizeMetadata(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (!payload || Object.keys(payload).length === 0) {
    return null;
  }

  const cloned: Record<string, unknown> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (key === 'token' || key === 'access_token' || key === 'refresh_token') {
      return;
    }

    cloned[key] = value;
  });

  return Object.keys(cloned).length > 0 ? cloned : null;
}
