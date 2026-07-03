import dynamic from 'next/dynamic';
import Trans from '~/core/ui/Trans';
import Heading from '~/core/ui/Heading';
import FadeIn from '~/components/FadeIn';

import { withI18n } from '~/i18n/with-i18n';

// ✅ 懒加载OAuth提供者组件 - 减少认证页面包体积
const OAuthProviders = dynamic(
  () => import('~/app/auth/components/OAuthProviders'),
  {
    loading: () => <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />,
  }
);

export const metadata = {
  title: '登录',
};

interface AuthPageProps {
  searchParams: {
    ref?: string;
    referralCode?: string;
    next?: string;
  };
}

function AuthPage({ searchParams }: AuthPageProps) {
  // Support both 'ref' and 'referralCode' query parameters
  const referralCode = searchParams.ref || searchParams.referralCode;
  const returnUrl = searchParams.next;

  return (
    <FadeIn>
      <div className="flex flex-col items-center space-y-6 text-center">
        <div>
          <Heading
            type={3}
            className="text-2xl font-semibold tracking-tight md:text-3xl"
          >
            <Trans i18nKey={'auth:continueToGoogle-Monetize'} />
          </Heading>
        </div>

        <OAuthProviders
          referralCode={referralCode}
          returnUrl={returnUrl}
        />

        <p className="text-sm text-muted-foreground md:text-base">
          <Trans i18nKey={'auth:oauthOnlyNotice'} />
        </p>
      </div>
    </FadeIn>
  );
}

export default withI18n(AuthPage);
