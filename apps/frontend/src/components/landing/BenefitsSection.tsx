'use client';

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import FadeIn from '~/components/FadeIn';

type BenefitsSectionProps = {
  // Simplified props without marketing API dependencies
};

export function BenefitsSection({}: BenefitsSectionProps) {
  const { t } = useTranslation('marketing');

  const resolvedPainPoints = (t('benefits.painPoints.defaults', {
    returnObjects: true,
  }) as any[]);

  return (
    <section className="py-24 relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-50/30 to-transparent dark:via-purple-900/10" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <Heading type={2}>{t('benefits.heading')}</Heading>
            <SubHeading as={'p'} className="mt-4 text-muted-foreground">
              {t('benefits.subheading')}
            </SubHeading>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {resolvedPainPoints.map((painPoint, index) => (
            <MarketingGlassCard
              key={painPoint.title}
              variant="gradient"
              hover
              delay={index * 0.1}
              className="group"
            >
              <MarketingGlassCardContent className="p-8 flex flex-col gap-4 h-full">
                {/* Decorative gradient background on hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                {/* Number badge and title */}
                <div className="relative flex items-center gap-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-300/30 dark:border-blue-700/30 text-xl font-bold text-gradient-primary"
                  >
                    {index + 1}
                  </motion.div>
                  <h3 className="text-xl font-bold text-foreground">
                    {painPoint.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="relative text-sm leading-relaxed text-muted-foreground flex-1">
                  {painPoint.description}
                </p>

                {/* Metric badge with glassmorphism */}
                <div className="relative mt-auto">
                  <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 shadow-lg">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-bold text-white">
                      {painPoint.metric}
                    </span>
                  </div>
                </div>
              </MarketingGlassCardContent>
            </MarketingGlassCard>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}