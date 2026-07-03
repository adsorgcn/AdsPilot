'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/core/generic/shadcn-utils';

export interface SkeletonProps {
  /**
   * Width of the skeleton
   */
  width?: string | number;
  /**
   * Height of the skeleton
   */
  height?: string | number;
  /**
   * Border radius
   */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /**
   * Additional CSS classes
   */
  className?: string;
}

const roundedMap = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

/**
 * Skeleton - Loading skeleton component
 * 
 * Displays an animated placeholder while content is loading.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  rounded = 'md',
  className,
}: SkeletonProps) {
  return (
    <motion.div
      className={cn(
        'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700',
        roundedMap[rounded],
        className
      )}
      style={{ width, height }}
      animate={{
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

/**
 * SkeletonCard - Card skeleton loader
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 p-4 rounded-lg border border-border bg-card', className)}>
      <Skeleton height="1.5rem" width="60%" />
      <Skeleton height="1rem" width="100%" />
      <Skeleton height="1rem" width="80%" />
      <div className="flex gap-2 pt-2">
        <Skeleton height="2rem" width="5rem" rounded="md" />
        <Skeleton height="2rem" width="5rem" rounded="md" />
      </div>
    </div>
  );
}

/**
 * SkeletonTable - Table skeleton loader
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} height="1rem" width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              height="1rem"
              width={`${100 / columns}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonMetricCard - Metric card skeleton loader
 */
export function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 p-4 rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between">
        <Skeleton height="1rem" width="40%" />
        <Skeleton height="1.5rem" width="1.5rem" rounded="full" />
      </div>
      <Skeleton height="2rem" width="50%" />
      <div className="flex items-center gap-2">
        <Skeleton height="0.75rem" width="3rem" />
        <Skeleton height="1rem" width="4rem" />
      </div>
    </div>
  );
}

/**
 * SkeletonChart - Chart skeleton loader
 */
export function SkeletonChart({
  height = '300px',
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4 p-4 rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between">
        <Skeleton height="1.5rem" width="40%" />
        <div className="flex gap-2">
          <Skeleton height="2rem" width="4rem" rounded="md" />
          <Skeleton height="2rem" width="4rem" rounded="md" />
        </div>
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end justify-around gap-2 px-4 pb-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              height={`${Math.random() * 60 + 40}%`}
              width="100%"
              rounded="sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonAvatar - Avatar skeleton loader
 */
export function SkeletonAvatar({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton
      className={cn(sizeMap[size], className)}
      rounded="full"
    />
  );
}

/**
 * SkeletonText - Text skeleton loader with multiple lines
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="1rem"
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
}