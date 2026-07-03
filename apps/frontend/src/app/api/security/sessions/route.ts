import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getSupabaseClientKeys from '~/core/supabase/get-supabase-client-keys';
import type { ActiveSession } from '~/lib/api/security/types';

type AuthSessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  ip?: string | null;
  user_agent?: string | null;
  factor_id?: string | null;
  not_after?: string | null;
};

interface AuthSchema {
  Tables: {
    sessions: {
      Row: AuthSessionRow;
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
      { error: 'Supabase 服务凭据未配置，无法获取会话信息' },
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

  const { data, error } = await adminClient
    .from('sessions')
    .select('id, user_id, created_at, updated_at, ip, user_agent, factor_id, not_after')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Security] 获取会话列表失败', error);

    return NextResponse.json(
      { error: '获取会话信息失败，请稍后再试' },
      { status: 500 },
    );
  }

  const items: ActiveSession[] = (data ?? []).map((session: any) => ({
    id: session.id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    ip: session.ip ?? null,
    userAgent: session.user_agent ?? null,
    factorId: session.factor_id ?? null,
    expiresAt: session.not_after ?? null,
  }));

  return NextResponse.json({ items });
}
