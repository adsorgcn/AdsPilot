import React from 'react';
import { cva } from 'class-variance-authority';
import classNames from 'clsx';

type Color = `normal` | 'success' | 'warn' | 'error' | 'info' | 'custom';
type Size = `normal` | `small` | 'custom';
type Variant = 'default' | 'secondary' | 'outline' | 'destructive';

const classNameBuilder = getClassNameBuilder();

const Badge = React.forwardRef<HTMLDivElement, {
  color?: Color;
  size?: Size;
  variant?: Variant; // shadcn/ui compatibility
  className?: string;
  children: React.ReactNode;
}>((function Badge({ children, color, size, variant, className, ...props }, ref) {
  // Map shadcn/ui variant to color
  const mappedColor = variant
    ? variantToColor(variant)
    : color;

  const badgeClassName = classNameBuilder({
    color: mappedColor,
    size,
  });

  return (
    <div ref={ref} className={classNames(badgeClassName, className)}>{children}</div>
  );
}));

function variantToColor(variant: Variant): Color {
  switch (variant) {
    case 'destructive':
      return 'error';
    case 'secondary':
    case 'outline':
    case 'default':
    default:
      return 'normal';
  }
}

function getClassNameBuilder() {
  return cva([`flex space-x-2 items-center font-medium`], {
    variants: {
      color: {
        normal: `text-gray-500 bg-gray-100 dark:text-gray-300 dark:bg-dark-800/80`,
        success: `bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-600`,
        warn: `bg-yellow-50 dark:bg-yellow-100/10 text-yellow-800`,
        error: `bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-600`,
        info: `bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-600`,
        custom: '',
      },
      size: {
        normal: `rounded-lg px-3 py-2 text-sm`,
        small: `rounded px-2 py-1 text-xs`,
        custom: '',
      },
    },
    defaultVariants: {
      color: `normal`,
      size: `normal`,
    },
  });
}

export default Badge;
export { Badge };
