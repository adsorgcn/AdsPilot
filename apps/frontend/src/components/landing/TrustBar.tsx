'use client';

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { PageContainer } from '~/core/ui/PageLayout';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import FadeIn from '~/components/FadeIn';


type TrustBarProps = {
  // Simplified props without marketing API dependencies
};

export function TrustBar({}: TrustBarProps) {
  const { t } = useTranslation('marketing');

  const stats = [
    {
      label: t('trustBar.stats.activeAdvertisers'),
      value: '1000+', // Static milestone data
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: t('trustBar.stats.averageRecommendation'),
      value: '85.2/100', // Static milestone data
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      label: t('trustBar.stats.newOffers'),
      value: t('trustBar.stats.newOffersValue', { value: '450' }), // Static milestone data
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  return (
    <section className="border-y border-border/50 py-12 relative">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 via-transparent to-purple-50/30 dark:from-blue-900/5 dark:via-transparent dark:to-purple-900/5" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <div className="flex flex-col gap-12">
          <FadeIn>
            <div className="text-center">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-2xl font-bold text-foreground md:text-3xl"
              >
                {t('trustBar.tagline')}
              </motion.h2>
            </div>
          </FadeIn>

          <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {stats.map((stat, index) => (
              <FadeInStaggerItem key={stat.label}>
                <MarketingGlassCard 
                  variant="gradient" 
                  hover
                  delay={index * 0.1}
                  className="text-center group"
                >
                  <MarketingGlassCardContent className="px-8 py-6">
                    {/* Icon with gradient background */}
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-300/30 dark:border-blue-700/30 text-blue-600 dark:text-blue-400"
                    >
                      {stat.icon}
                    </motion.div>
                    
                    {/* Value with gradient text */}
                    <p className="text-3xl font-bold text-gradient-primary">
                      {stat.value}
                    </p>
                    
                    {/* Label */}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                  </MarketingGlassCardContent>
                </MarketingGlassCard>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </PageContainer>
    </section>
  );
}