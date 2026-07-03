'use client';

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import FadeIn from '~/components/FadeIn';

export function HowItWorksSection() {
  const { t } = useTranslation('marketing');
  const steps = t('howItWorks.steps', { returnObjects: true }) as Array<{
    title: string;
    description: string;
    highlights: string[];
  }>;

  return (
    <section className="py-24 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-transparent to-purple-50/50 dark:from-blue-900/10 dark:via-transparent dark:to-purple-900/10" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <Heading type={2}>{t('howItWorks.heading')}</Heading>
            <SubHeading as={'p'} className="mt-4 text-muted-foreground">
              {t('howItWorks.subheading')}
            </SubHeading>
          </div>
        </FadeIn>

        <FadeInStagger className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
          {steps.map((step, index) => (
            <FadeInStaggerItem key={step.title} className="flex h-full">
              <div className="flex flex-col items-center text-center w-full relative">
                {/* Step number with glow effect */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="relative mb-6"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-30 blur-xl rounded-full" />
                  
                  {/* Number badge */}
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-2xl font-bold text-white shadow-lg">
                    {index + 1}
                  </div>
                </motion.div>

                {/* Connecting line (except for last item) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 dark:from-blue-700 dark:to-purple-700 opacity-30" />
                )}

                {/* Content card with glassmorphism */}
                <MarketingGlassCard 
                  variant="gradient" 
                  hover 
                  delay={index * 0.15}
                  className="w-full flex-1"
                >
                  <MarketingGlassCardContent className="p-6 flex flex-col h-full">
                    <h3 className="mb-3 text-xl font-semibold">
                      {step.title}
                    </h3>

                    <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>

                    <ul className="space-y-3 text-left text-sm text-muted-foreground flex-1 mt-4">
                      {step.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </MarketingGlassCardContent>
                </MarketingGlassCard>
              </div>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </PageContainer>
    </section>
  );
}