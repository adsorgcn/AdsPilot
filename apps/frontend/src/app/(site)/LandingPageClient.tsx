'use client';

import { Suspense, lazy } from 'react';

import { HeroSection, TrustBar } from '~/components/landing';
import { Skeleton } from '~/components/ui/skeleton';

const FeaturesSection = lazy(() =>
  import('~/components/landing/FeaturesSection').then((mod) => ({
    default: mod.FeaturesSection,
  })),
);

const HowItWorksSection = lazy(() =>
  import('~/components/landing/HowItWorksSection').then((mod) => ({
    default: mod.HowItWorksSection,
  })),
);

const BenefitsSection = lazy(() =>
  import('~/components/landing/BenefitsSection').then((mod) => ({
    default: mod.BenefitsSection,
  })),
);

const PricingSection = lazy(() =>
  import('~/components/landing/PricingSection').then((mod) => ({
    default: mod.PricingSection,
  })),
);

const FinalCTASection = lazy(() =>
  import('~/components/landing/FinalCTASection').then((mod) => ({
    default: mod.FinalCTASection,
  })),
);

export function LandingPageClient() {
  // Simplified landing page without marketing statistics
  // Focus on core features and value proposition

  return (
    <>
      <HeroSection />
      <TrustBar />

      <Suspense fallback={<SectionSkeleton />}>
        <FeaturesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <HowItWorksSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <BenefitsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <PricingSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <FinalCTASection />
      </Suspense>
    </>
  );
}

export default LandingPageClient;

function SectionSkeleton() {
  return (
    <section className="my-16">
      <div className="px-5">
        <div className="text-center space-y-4 mb-12">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-20 w-3/4 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-4 p-6 rounded-xl border border-dashed border-muted bg-muted/20">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <Skeleton className="h-6 w-3/4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
