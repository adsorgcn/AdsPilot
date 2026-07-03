'use client';

import { ReactNode } from 'react';
import { cn } from '~/core/generic/shadcn-utils';

interface KbdProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'text-[10px] px-1 py-0.5 min-w-[16px]',
  md: 'text-xs px-1.5 py-0.5 min-w-[20px]',
  lg: 'text-sm px-2 py-1 min-w-[24px]',
};

/**
 * Kbd component
 * Displays keyboard shortcuts with consistent styling
 *
 * @example
 * <Kbd>⌘</Kbd><Kbd>K</Kbd>
 * <Kbd>Ctrl</Kbd><Kbd>S</Kbd>
 */
export default function Kbd({ children, className, size = 'md' }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'rounded border border-border/50',
        'bg-muted/50',
        'font-mono font-medium',
        'text-muted-foreground',
        'shadow-[0_1px_0_0_rgba(0,0,0,0.08)]',
        'dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)]',
        sizeMap[size],
        className
      )}
    >
      {children}
    </kbd>
  );
}

interface KeyboardShortcutProps {
  keys: string[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * KeyboardShortcut component
 * Displays multiple keys with "+" separator
 *
 * @example
 * <KeyboardShortcut keys={['⌘', 'K']} />
 * <KeyboardShortcut keys={['Ctrl', 'Shift', 'P']} />
 */
export function KeyboardShortcut({ keys, className, size = 'md' }: KeyboardShortcutProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, index) => (
        <Kbd key={index} size={size}>
          {key}
        </Kbd>
      ))}
    </span>
  );
}
