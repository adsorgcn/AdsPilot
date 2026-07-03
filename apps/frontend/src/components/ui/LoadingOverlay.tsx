'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '~/core/generic/shadcn-utils';

export interface LoadingOverlayProps {
  /**
   * Whether the overlay is visible
   */
  visible: boolean;
  /**
   * Loading message
   */
  message?: string;
  /**
   * Variant style
   */
  variant?: 'default' | 'blur' | 'transparent';
  /**
   * Whether to show spinner
   */
  showSpinner?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * LoadingOverlay - Full-screen loading overlay
 * 
 * Displays a loading indicator over the entire screen or a specific container.
 */
export function LoadingOverlay({
  visible,
  message,
  variant = 'blur',
  showSpinner = true,
  className,
}: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            variant === 'blur' && 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
            variant === 'default' && 'bg-white dark:bg-gray-900',
            variant === 'transparent' && 'bg-transparent',
            className
          )}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-4"
          >
            {showSpinner && (
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 blur-xl opacity-50" />
                <Loader2 className="relative h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            )}
            {message && (
              <p className="text-sm font-medium text-muted-foreground">
                {message}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * InlineLoader - Inline loading spinner
 */
export function InlineLoader({
  size = 'md',
  message,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}) {
  const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-blue-600', sizeMap[size])} />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

/**
 * SparkleLoader - Animated sparkle loader
 */
export function SparkleLoader({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <motion.div
        animate={{
          rotate: [0, 360],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Sparkles className="h-8 w-8 text-purple-600" />
      </motion.div>
      {message && (
        <p className="text-sm font-medium text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * ProgressBar - Animated progress bar
 */
export function ProgressBar({
  progress,
  message,
  className,
}: {
  progress: number;
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {message && (
        <p className="text-sm font-medium text-muted-foreground">
          {message}
        </p>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-xs text-right text-muted-foreground">
        {Math.round(progress)}%
      </p>
    </div>
  );
}

/**
 * PulsingDots - Pulsing dots loader
 */
export function PulsingDots({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-blue-600"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}