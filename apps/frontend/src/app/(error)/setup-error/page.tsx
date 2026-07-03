import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import requireSession from '~/lib/user/require-session';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { userApiService } from '~/lib/api/services/UserApiService';
import configuration from '~/configuration';
import ManualSetupForm from './components/ManualSetupForm';
import getLogger from '~/core/logger';
import FadeIn from '~/components/FadeIn';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['setup']);

  return {
    title: t('metadata.title'),
  };
}

/**
 * 当自动设置失败时的降级页面
 */
async function SetupErrorPage() {
  const client = await getSupabaseServerComponentClient();
  const { user } = await requireSession(client);
  const logger = getLogger();

  // 检查用户数据是否已创建
  let userData = null;

  try {
    userData = await userApiService.getUserProfile(user.id);
  } catch (error) {
    logger.error(
      { name: 'setup-error:fetch-user', userId: user.id, error },
      'Failed to fetch user profile from API',
    );
  }

  if (userData?.onboarded) {
    // 用户已设置完成,重定向到dashboard
    redirect(configuration.paths.appHome);
  }

  const languageCookie = await getLanguageCookie();
  const i18n = await initializeServerI18n(languageCookie);
  const t = i18n.getFixedT(null, ['setup']);

  return (
    <div className="flex min-h-[50vh] items-center justify-center py-24">
      <FadeIn>
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 border border-border">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('page.description')}
          </p>
        </div>

        <ManualSetupForm userId={user.id} userEmail={user.email} />
        </div>
      </FadeIn>
    </div>
  );
}

export default SetupErrorPage;
