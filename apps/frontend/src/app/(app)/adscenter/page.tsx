'use client';

import dynamic from 'next/dynamic';

const EnhancedAdsCenterPage = dynamic(
  () => import('~/components/ads-center/EnhancedAdsCenterPage').then(mod => ({ default: mod.EnhancedAdsCenterPage })),
  {
    loading: () => <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />,
  }
);

export default function AdsCenterRoute() {
  return <EnhancedAdsCenterPage />;
}