import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import requireSession from '~/lib/user/require-session';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { userApiService } from '~/lib/api/services/UserApiService';
import configuration from '~/configuration';
import getLogger from '~/core/logger';
import FadeIn from '~/components/FadeIn';
import { FullWidthPageLayout } from '~/core/ui/PageLayout';
import getLanguageCookie from '~/i18n/get-language-cookie';
import ErrorActions from './components/ErrorActions';

/**
 * 应用错误页面
 * 处理各种应用级别的错误，提供用户友好的错误信息和恢复选项
 */
async function ErrorPage({
  searchParams,
}: {
  searchParams: { code?: string; reason?: string };
}) {
  const client = await getSupabaseServerComponentClient();
  const logger = getLogger();

  const errorCode = searchParams.code || 'UNKNOWN_ERROR';
  const reason = searchParams.reason || 'unknown';

  try {
    // 尝试获取用户信息
    const { user } = await requireSession(client);

    // 检查用户数据是否正常
    let userData = null;

    try {
      userData = await userApiService.getUserProfile(user.id);
    } catch (error) {
      logger.error(
        { name: 'error-page:fetch-user', userId: user.id, error },
        'Failed to fetch user profile from API',
      );
    }

    // 如果用户数据正常，重定向到dashboard
    if (userData?.onboarded) {
      redirect(configuration.paths.appHome);
    }
  } catch (error) {
    // 用户未登录或session无效，继续显示错误页面
    logger.info(
      { name: 'error-page:no-session', error },
      'User not logged in, showing error page',
    );
  }

  await getLanguageCookie();

  return (
    <FullWidthPageLayout className="flex min-h-screen items-center justify-center bg-background">
      <FadeIn>
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 border border-border">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">
              应用加载失败
            </h1>
            <p className="text-muted-foreground mb-4">
              系统遇到了一些问题，无法正常加载应用数据
            </p>

            <div className="text-left bg-muted p-4 rounded-lg mb-6">
              <p className="text-sm font-mono">
                错误代码: <span className="text-destructive">{errorCode}</span>
              </p>
              {reason !== 'unknown' && (
                <p className="text-sm font-mono mt-1">
                  原因: <span className="text-destructive">{reason}</span>
                </p>
              )}
            </div>
          </div>

          <ErrorActions />

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              如果问题持续存在，请将错误代码提供给支持团队
            </p>
          </div>
        </div>
      </FadeIn>
    </FullWidthPageLayout>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  await getLanguageCookie();

  return {
    title: '应用错误 - Google-Monetize',
  };
}

export default ErrorPage;