'use client';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import PricingTable from '~/components/PricingTable';
import FadeIn from '~/components/FadeIn';
import { useTranslation } from 'react-i18next';

export function PricingSection() {
  const { t } = useTranslation('marketing');

  return (
    <section className="py-24 relative">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50/50 via-transparent to-blue-50/50 dark:from-purple-900/10 dark:via-transparent dark:to-blue-900/10" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <Heading type={2}>{t('pricing.heading')}</Heading>
            <SubHeading as={'p'} className="mt-4 text-muted-foreground">
              {t('pricing.subheading')}
            </SubHeading>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-16">
            <PricingTable />
          </div>
        </FadeIn>
      </PageContainer>
    </section>
  );
}