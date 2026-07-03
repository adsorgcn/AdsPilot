'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '~/core/generic/shadcn-utils';

interface HoverCardProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
}

export default function HoverCard({
  children,
  className,
  disabled = false,
  onClick,
  'data-testid': testId,
}: HoverCardProps) {
  if (disabled) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6',
          className
        )}
        data-testid={testId}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        y: -4,
        transition: { duration: 0.2, ease: 'easeOut' }
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6',
        onClick && 'cursor-pointer',
        'transition-shadow duration-200',
        'hover:shadow-md',
        'dark:bg-card/30 dark:border-border/30',
        className
      )}
      data-testid={testId}
    >
      {children}
    </motion.div>
  );
}
