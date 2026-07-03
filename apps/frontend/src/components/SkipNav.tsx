'use client';

import Link from 'next/link';
import { cn } from '~/core/generic/shadcn-utils';

interface SkipNavProps {
  contentId?: string;
  className?: string;
}

/**
 * SkipNav component
 * Allows keyboard users to skip repetitive navigation and jump to main content
 *
 * Usage:
 * 1. Add <SkipNav /> at the top of your layout
 * 2. Add id="main-content" to your main content area
 *
 * The link is visually hidden but appears when focused via keyboard
 */
export default function SkipNav({ contentId = 'main-content', className }: SkipNavProps) {
  return (
    <Link
      href={`#${contentId}`}
      className={cn(
        // Visually hidden by default
        'fixed top-4 left-4 z-[9999]',
        'px-4 py-2 rounded-lg',
        'bg-primary text-primary-foreground',
        'font-medium text-sm',
        'shadow-lg',
        // Transitions
        'transition-all duration-200',
        // Hidden state
        '-translate-y-20 opacity-0',
        // Focused state (keyboard navigation)
        'focus:translate-y-0 focus:opacity-100',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      Skip to main content
    </Link>
  );
}
