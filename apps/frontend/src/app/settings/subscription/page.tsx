import Trans from '~/core/ui/Trans';

import { SubscriptionManagement } from '~/components/settings/SubscriptionManagement';
import { withI18n } from '~/i18n/with-i18n';
import Heading from '~/core/ui/Heading';
import FadeIn from '~/components/FadeIn';
import { SettingsPageLayout } from '~/core/ui/PageLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscription',
};

const SubscriptionSettingsPage = () => {
  return (
    <FadeIn>
      <SettingsPageLayout>
        <div className={'flex flex-col space-y-6 w-full'}>
          <div className={'flex flex-col space-y-2'}>
            <Heading type={4}>
              <Trans i18nKey={'common:subscriptionSettingsTabLabel'} />
            </Heading>

            <span className={'text-muted-foreground'}>
              <Trans i18nKey={'subscription:subscriptionTabSubheading'} />
            </span>
          </div>

          <SubscriptionManagement />
        </div>
      </SettingsPageLayout>
    </FadeIn>
  );
};

export default withI18n(SubscriptionSettingsPage);
