import * as React from 'react';
import { GlassCard, GlassCardContent } from './GlassCard';
import { Skeleton } from './skeleton';

export function SkeletonMetricCard() {
  return (
    <GlassCard>
      <GlassCardContent className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="mt-4 h-8 w-24" />
        <Skeleton className="mt-2 h-4 w-32" />
      </GlassCardContent>
    </GlassCard>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      {/* Metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      
      {/* Chart area */}
      <GlassCard>
        <GlassCardContent className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </GlassCardContent>
      </GlassCard>
      
      {/* Table area */}
      <GlassCard>
        <GlassCardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <SkeletonTable />
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}