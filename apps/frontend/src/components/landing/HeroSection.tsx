'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRightIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import AnimatedCounter from '~/components/animations/AnimatedCounter';
import RippleButton from '~/components/animations/RippleButton';

export function HeroSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('marketing');

  const stats = [
    {
      label: t('hero.stats.totalEvaluations'),
      value: '1,000+', // Static milestone data
    },
    {
      label: t('hero.stats.averageRecommendation'),
      value: '98/100', // Static quality metric
    },
    {
      label: t('hero.stats.activeAdvertisers'),
      value: '100+', // Static milestone data
    },
    {
      label: t('hero.stats.timeToValue'),
      value: t('hero.stats.timeToValueValue', { value: 30 }), // Static average value
    },
  ];

  const sellingPoints = [
    t('hero.sellingPoints.noCreditCard'),
    t('hero.sellingPoints.quickSetup'),
  ];

  const ctaHref = useCallback(
    (target: string) => {
      if (target.startsWith('http')) {
        return target;
      }

      const path = target.startsWith('/') ? target : `/${target}`;
      const queryString = searchParams?.toString();
      return queryString ? `${path}?${queryString}` : path;
    },
    [searchParams],
  );

  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      
      {/* Grid background pattern */}
      <div className="absolute inset-0 bg-grid-pattern" />
      
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl rounded-full" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <FadeIn direction="up">
            <div className="space-y-8">
              {/* Badge with glassmorphism */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 border border-white/20 dark:border-slate-700/30 shadow-lg"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                <span className="text-sm font-medium text-gradient-primary">
                  {t('hero.badge')}
                </span>
              </motion.div>

              <Heading type={1}>
                <span className="block text-4xl leading-tight lg:text-5xl xl:text-6xl">
                  {t('hero.headline.prefix')}
                  <span className="block mt-2 text-gradient">
                    {t('hero.headline.highlight')}
                  </span>
                </span>
              </Heading>

              <SubHeading as={'p'} className="max-w-2xl text-left text-lg text-muted-foreground">
                {t('hero.description')}
              </SubHeading>

              <div className="flex flex-col items-start gap-4 sm:flex-row">
                <RippleButton
                  size="lg"
                  className="flex items-center gap-2 text-lg bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8"
                  onClick={() => router.push(ctaHref('/auth'))}
                >
                  {t('hero.primaryCta')}
                  <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </RippleButton>

                <RippleButton
                  size="lg"
                  variant="outline"
                  className="flex items-center gap-2 text-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground h-14 px-8"
                  onClick={() => router.push(ctaHref('/contact'))}
                >
                  <PlayCircleIcon className="h-5 w-5" />
                  {t('hero.secondaryCta')}
                </RippleButton>
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-muted-foreground">
                {sellingPoints.map((point) => (
                  <div key={point} className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                      ✓
                    </span>
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={0.2}>
            <div className="relative">
              <div className="absolute inset-0 -translate-x-6 translate-y-6 rounded-3xl bg-gradient-to-r from-primary/30 to-primary/20 blur-3xl" />

              <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl">
                <Image
                  src="/assets/images/dashboard.webp"
                  alt="Google-Monetize Dashboard"
                  width={1280}
                  height={800}
                  priority
                  quality={90}
                  placeholder="blur"
                  blurDataURL="data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAD8D+JaQAA3AA/vuUAAA="
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
                />
              </div>

              {/* Stats cards with GlassCard and Animated Counter */}
              <FadeInStagger className="absolute -bottom-10 left-6 flex w-max gap-4">
                {stats.slice(0, 2).map((stat, index) => (
                  <FadeInStaggerItem key={stat.label}>
                    <MarketingGlassCard variant="gradient" delay={0.3 + index * 0.1}>
                      <MarketingGlassCardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <div className="text-lg font-semibold text-gradient-primary">
                          {index === 0 ? (
                            <AnimatedCounter
                              value={1000}
                              prefix=""
                              suffix="+"
                              duration={2000 + index * 500}
                              animationType="slide"
                            />
                          ) : index === 1 ? (
                            <div className="flex items-baseline gap-1">
                              <AnimatedCounter
                                value={98}
                                duration={2500}
                                animationType="flip"
                              />
                              <span>/100</span>
                            </div>
                          ) : (
                            stat.value
                          )}
                        </div>
                      </MarketingGlassCardContent>
                    </MarketingGlassCard>
                  </FadeInStaggerItem>
                ))}
              </FadeInStagger>

              <FadeInStagger className="absolute -top-10 right-6 flex w-max gap-4">
                {stats.slice(2).map((stat, index) => (
                  <FadeInStaggerItem key={stat.label}>
                    <MarketingGlassCard variant="gradient" delay={0.5 + index * 0.1}>
                      <MarketingGlassCardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <div className="text-lg font-semibold text-gradient-primary">
                          {index === 0 ? (
                            <AnimatedCounter
                              value={100}
                              prefix=""
                              suffix="+"
                              duration={3000}
                              animationType="count"
                            />
                          ) : (
                            <div className="flex items-baseline gap-1">
                              <AnimatedCounter
                                value={30}
                                duration={2800}
                                animationType="typewriter"
                              />
                              <span className="text-sm">天</span>
                            </div>
                          )}
                        </div>
                      </MarketingGlassCardContent>
                    </MarketingGlassCard>
                  </FadeInStaggerItem>
                ))}
              </FadeInStagger>
            </div>
          </FadeIn>
        </div>
      </PageContainer>
    </section>
  );
}