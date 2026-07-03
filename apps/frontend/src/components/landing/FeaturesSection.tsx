'use client';

import type { ComponentType } from 'react';
import {
  SparklesIcon,
  LinkIcon,
  ChartBarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import FadeIn from '~/components/FadeIn';
import TiltCard from '~/components/animations/TiltCard';


const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  SparklesIcon,
  LinkIcon,
  ChartBarIcon,
};

type FeaturesSectionProps = {
  // Simplified props without marketing API dependencies
};

export function FeaturesSection({}: FeaturesSectionProps) {
  const { t } = useTranslation('marketing');
  const translatedFeatures = t('features.defaults', {
    returnObjects: true,
  }) as any[];

  const resolvedFeatures = translatedFeatures;

  return (
    <section className="py-24 relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/30 to-transparent dark:via-blue-900/10" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <Heading type={2}>{t('features.heading')}</Heading>
            <SubHeading as={'p'} className="mt-4 text-muted-foreground">
              {t('features.subheading')}
            </SubHeading>
          </div>
        </FadeIn>

        <FadeInStagger className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {resolvedFeatures.map((feature, index) => {
            const Icon = iconMap[feature.icon] ?? SparklesIcon;

            return (
              <FadeInStaggerItem key={feature.title}>
                <TiltCard
                  tiltStrength={10}
                  scaleOnHover={1.02}
                  glareEffect={true}
                >
                  <MarketingGlassCard
                    variant="gradient"
                    hover={false} // 禁用默认悬停效果，让TiltCard处理
                    delay={index * 0.1}
                    className="h-full group"
                  >
                    <MarketingGlassCardContent className="p-8">
                      {/* Icon with gradient background */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity" />
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/20 dark:border-slate-700/30">
                          <Icon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>

                      {/* Content */}
                      <h3 className="mt-6 text-xl font-semibold">
                        {feature.title}
                      </h3>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>

                      {/* Highlights with checkmarks */}
                      <ul className="mt-6 space-y-3">
                        {feature.highlights.map((item: string) => (
                          <li key={item} className="flex items-start gap-3">
                            <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </MarketingGlassCardContent>
                  </MarketingGlassCard>
                </TiltCard>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </PageContainer>
    </section>
  );
}