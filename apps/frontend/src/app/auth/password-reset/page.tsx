import Link from 'next/link';

import configuration from '~/configuration';
import Heading from '~/core/ui/Heading';
import Trans from '~/core/ui/Trans';
import FadeIn from '~/components/FadeIn';

import PasswordResetRequestContainer from '~/app/auth/components/PasswordResetRequestContainer';
import { withI18n } from '~/i18n/with-i18n';

export const metadata = {
  title: 'Password Reset Request',
};

function PasswordResetPage() {
  return (
    <FadeIn>
      <div className="flex flex-col items-center space-y-6 text-center">
        <Heading type={5}>
          <Trans i18nKey={'auth:passwordResetLabel'} />
        </Heading>

        <PasswordResetRequestContainer />

        <p className="text-xs text-muted-foreground">
          <span className="mr-1">
            <Trans i18nKey={'auth:passwordRecoveredQuestion'} />
          </span>
          <Link
            className="text-primary hover:underline"
            href={configuration.paths.signIn}
          >
            <Trans i18nKey={'auth:signIn'} />
          </Link>
        </p>
      </div>
    </FadeIn>
  );
}

export default withI18n(PasswordResetPage);
