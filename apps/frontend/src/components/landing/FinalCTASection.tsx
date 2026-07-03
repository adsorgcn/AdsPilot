'use client';

import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { PageContainer } from '~/core/ui/PageLayout';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import FadeIn from '~/components/FadeIn';

export function FinalCTASection() {
  const router = useRouter();
  const { t } = useTranslation('marketing');

  return (
    <section className="relative overflow-hidden py-24">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />
      
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1),_transparent_70%)]" />
      
      {/* Animated gradient orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/30 blur-3xl rounded-full"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/30 blur-3xl rounded-full"
      />

      <PageContainer maxWidth="5xl" padding={false} className="px-5">
        <FadeIn>
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            {/* Sparkle icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, type: "spring" }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30"
            >
              <SparklesIcon className="h-8 w-8 text-white" />
            </motion.div>

            <Heading type={2} className="text-white">
              {t('finalCta.heading')}
            </Heading>
            <SubHeading as={'p'} className="text-white/90 text-lg">
              {t('finalCta.subheading')}
            </SubHeading>

            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="large"
                  className="group flex items-center gap-2 text-lg bg-white text-gray-900 hover:bg-gray-50 font-bold shadow-2xl border-2 border-white"
                  onClick={() => router.push('/auth')}
                >
                  {t('finalCta.primaryCta')}
                  <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="large"
                  variant="outline"
                  className="border-2 border-white/90 bg-white/10 text-white hover:bg-white/20 font-semibold backdrop-blur-md shadow-lg"
                  onClick={() => router.push('/contact')}
                >
                  {t('finalCta.secondaryCta')}
                </Button>
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {t('finalCta.note')}
            </motion.p>
          </div>
        </FadeIn>
      </PageContainer>
    </section>
  );
}