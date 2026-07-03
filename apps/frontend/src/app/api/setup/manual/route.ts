import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { userApiService } from '~/lib/api/services/UserApiService';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import configuration from '~/configuration';

const setupSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const logger = getLogger();
  const client = getSupabaseRouteHandlerClient();

  try {
    // 验证session
    const { user } = await requireSession(client);

    // 解析请求体
    const body = await request.json();
    const data = setupSchema.parse(body);

    // 验证用户ID匹配
    if (data.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    logger.info({ userId: user.id }, 'Manual setup initiated');

    // 使用Backend API更新用户档案
    try {
      await userApiService.updateUserProfile(user.id, {
        displayName: data.displayName,
        onboarded: true,
      });

      logger.info(
        { userId: user.id },
        'Manual setup completed successfully via API'
      );
    } catch (apiError) {
      logger.error({ error: apiError }, 'Failed to update user profile via API');
      throw apiError;
    }

    return NextResponse.json({
      success: true,
      redirectUrl: configuration.paths.appHome,
    });
  } catch (error) {
    logger.error({ error }, 'Manual setup failed');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Setup failed' },
      { status: 500 }
    );
  }
}
