'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import getSupabaseBrowserClient from '~/core/supabase/browser-client';
import getLogger from '~/core/logger';
import Spinner from '~/core/ui/Spinner';
import FadeIn from '~/components/FadeIn';

type MagicLinkStatus = 'loading' | 'success' | 'error';
type MagicLinkErrorCode = 'missingTokens' | 'setSession' | 'sessionCreation' | 'unknown';

class MagicLinkError extends Error {
  code: MagicLinkErrorCode;

  constructor(code: MagicLinkErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'MagicLinkError';
    this.code = code;
  }
}

const resolveMagicLinkErrorCode = (error: unknown): MagicLinkErrorCode => {
  if (error instanceof MagicLinkError) {
    return error.code;
  }

  return 'unknown';
};

/**
 * Magic Link确认页面
 * 处理Supabase magic link的hash fragment tokens
 * 从 #access_token=xxx&refresh_token=yyy 提取token并设置session
 */
export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('auth');
  const [status, setStatus] = useState<MagicLinkStatus>('loading');
  const [errorCode, setErrorCode] = useState<MagicLinkErrorCode>('unknown');

  useEffect(() => {
    const confirmAuth = async () => {
      const logger = getLogger();
      const client = getSupabaseBrowserClient();

      try {
        setStatus('loading');
        setErrorCode('unknown');

        // 从URL hash fragment中提取tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        logger.info({ type, hasAccessToken: !!accessToken }, 'Processing magic link tokens');

        if (!accessToken || !refreshToken) {
          throw new MagicLinkError('missingTokens');
        }

        // 使用tokens设置Supabase session
        const { data, error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw new MagicLinkError('setSession', error.message);
        }

        if (!data.session) {
          throw new MagicLinkError('sessionCreation');
        }

        logger.info({ userId: data.user?.id }, 'Magic link authentication successful');

        setStatus('success');

        // 获取next参数或使用默认dashboard路径
        const nextUrl = searchParams.get('next') || '/dashboard';

        // 等待session完全建立后再重定向
        // 通过getSession()验证session已经可用
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: sessionCheck } = await client.auth.getSession();
        if (!sessionCheck.session) {
          logger.warn('Session not available after setSession, waiting longer');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        logger.info({ redirectTo: nextUrl }, 'Redirecting to dashboard');
        router.push(nextUrl);

      } catch (error: any) {
        logger.error({ error: error.message }, 'Magic link authentication failed');
        const code = resolveMagicLinkErrorCode(error);

        setStatus('error');
        setErrorCode(code);

        // 5秒后重定向到登录页
        setTimeout(() => {
          router.push('/auth');
        }, 5000);
      }
    };

    confirmAuth();
  }, [router, searchParams]);

  return (
    <FadeIn>
      <div className="flex flex-col items-center space-y-6 text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <Spinner />
            <p className="text-muted-foreground">{t('magicLink.loading.description')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2 text-foreground">
            <div className="text-4xl">✓</div>
            <p className="text-lg font-semibold">{t('magicLink.success.title')}</p>
            <p className="text-sm text-muted-foreground">{t('magicLink.success.description')}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="text-4xl text-destructive">✗</div>
            <p className="text-lg font-semibold text-destructive">{t('magicLink.error.title')}</p>
            <p className="text-sm text-muted-foreground">
              {t(`magicLink.error.messages.${errorCode}`)}
            </p>
            <p className="text-xs text-muted-foreground">{t('magicLink.error.description')}</p>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
