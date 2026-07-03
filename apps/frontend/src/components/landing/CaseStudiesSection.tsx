'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import FadeIn from '~/components/FadeIn';

type CaseStudiesSectionProps = {
  // Simplified props without marketing API dependencies
};

export function CaseStudiesSection({}: CaseStudiesSectionProps) {
  const { t } = useTranslation('marketing');

  const resolvedTestimonials = (t('caseStudies.defaults', { returnObjects: true }) as any[]);

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 blur-3xl rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 blur-3xl rounded-full" />
      
      <PageContainer maxWidth="6xl" padding={false} className="px-5 relative">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <Heading type={2} className="text-white">{t('caseStudies.heading')}</Heading>
            <SubHeading as={'p'} className="mt-4 text-gray-300">
              {t('caseStudies.subheading')}
            </SubHeading>
          </div>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {resolvedTestimonials.map((testimonial, index) => (
            <MarketingGlassCard
              key={testimonial.name}
              variant="default"
              hover
              delay={index * 0.1}
              className="bg-white/5 dark:bg-white/5 border-white/10 backdrop-blur-xl"
            >
              <MarketingGlassCardContent className="p-6 flex flex-col justify-between h-full">
                {/* Quote */}
                <blockquote className="text-sm leading-relaxed text-gray-200 mb-6">
                  <span className="text-2xl text-blue-400 leading-none">&ldquo;</span>
                  {testimonial.quote}
                  <span className="text-2xl text-blue-400 leading-none">&rdquo;</span>
                </blockquote>

                {/* Author info */}
                <div className="flex items-center gap-4 mt-auto">
                  <Avatar name={testimonial.name} src={testimonial.avatar} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {testimonial.role} · {testimonial.company}
                    </p>
                    
                    {/* Improvement badge */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 px-3 py-1"
                    >
                      <svg className="h-3 w-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs font-semibold text-green-300">
                        {testimonial.improvement}
                      </span>
                    </motion.div>
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

function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/20 ring-2 ring-blue-500/30">
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover"
          sizes="48px"
          quality={80}
          placeholder="blur"
          blurDataURL="data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAD8D+JaQAA3AA/vuUAAA="
        />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-lg font-semibold text-white ring-2 ring-blue-500/30">
      {name.slice(0, 1)}
    </div>
  );
}