'use client';

import { motion } from 'framer-motion';
import { cn } from '~/core/generic/shadcn-utils';

interface LoadingDotsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-1 w-1',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
};

export default function LoadingDots({ className, size = 'md' }: LoadingDotsProps) {
  const dotSize = sizeMap[size];

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn('rounded-full bg-current', dotSize)}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const spinnerSizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  const spinnerSize = spinnerSizeMap[size];

  return (
    <motion.div
      className={cn('relative', spinnerSize, className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <div className={cn(
        'absolute inset-0 rounded-full',
        'border-2 border-muted',
        'border-t-primary'
      )} />
    </motion.div>
  );
}
