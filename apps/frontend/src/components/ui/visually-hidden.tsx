'use client';

import { ReactNode } from 'react';
import { cn } from '~/core/generic/shadcn-utils';

interface VisuallyHiddenProps {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * VisuallyHidden component
 * Hides content visually but keeps it accessible to screen readers
 *
 * Use this for:
 * - Skip navigation links
 * - Icon button labels
 * - Form labels when visual label exists
 * - Additional context for screen readers
 */
export default function VisuallyHidden({
  children,
  className,
  as: Component = 'span',
}: VisuallyHiddenProps) {
  return (
    <Component
      className={cn(
        'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',
        '[clip:rect(0,0,0,0)]',
        className
      )}
    >
      {children}
    </Component>
  );
}
