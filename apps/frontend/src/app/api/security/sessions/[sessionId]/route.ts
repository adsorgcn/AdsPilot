import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getSupabaseClientKeys from '~/core/supabase/get-supabase-client-keys';

type AuthSessionRow = {
  id: string;
  user_id: string;
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

export async function DELETE(
  _request: Request,
  context: { params: { sessionId: string } },
) {
  const sessionId = context.params.sessionId;

  if (!sessionId) {
    return NextResponse.json(
      { error: '缺少会话标识' },
      { status: 400 },
    );
  }

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

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase 服务凭据未配置，无法注销会话' },
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

  const { data: session, error: fetchError } = await adminClient
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (fetchError) {
    console.error('[Security] 查询会话信息失败', fetchError);

    return NextResponse.json(
      { error: '无法校验会话信息，请稍后再试' },
      { status: 500 },
    );
  }

  if (!session || (session as any).user_id !== user.id) {
    return NextResponse.json(
      { error: '会话不存在或不属于当前用户' },
      { status: 404 },
    );
  }

  const { error: deleteError } = await adminClient
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (deleteError) {
    console.error('[Security] 注销会话失败', deleteError);

    return NextResponse.json(
      { error: '注销会话失败，请稍后再试' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
