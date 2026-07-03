import * as React from 'react';
import { GlassCard, GlassCardContent } from './GlassCard';
import { Skeleton } from './skeleton';

export function SkeletonCard() {
  return (
    <GlassCard>
      <GlassCardContent className="p-6 space-y-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

export function SkeletonFeatureCard() {
  return (
    <GlassCard variant="gradient">
      <GlassCardContent className="p-8 space-y-4">
        {/* Icon skeleton */}
        <Skeleton className="h-14 w-14 rounded-2xl" />
        
        {/* Title skeleton */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Description skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        
        {/* Highlights skeleton */}
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

export function SkeletonHero() {
  return (
    <div className="space-y-8">
      {/* Badge skeleton */}
      <Skeleton className="h-8 w-32 rounded-full" />
      
      {/* Heading skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-12 w-3/4 max-w-xl" />
      </div>
      
      {/* Description skeleton */}
      <div className="space-y-2 max-w-2xl">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      
      {/* Buttons skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-12 w-40" />
      </div>
      
      {/* Selling points skeleton */}
      <div className="flex gap-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}