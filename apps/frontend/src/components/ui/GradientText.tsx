import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/core/generic/shadcn-utils';

const gradientTextVariants = cva(
  'bg-clip-text text-transparent bg-gradient-to-r font-bold',
  {
    variants: {
      variant: {
        primary: 'from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400',
        accent: 'from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400',
        success: 'from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400',
        warning: 'from-orange-600 to-yellow-600 dark:from-orange-400 dark:to-yellow-400',
        error: 'from-red-600 to-pink-600 dark:from-red-400 dark:to-pink-400',
        rainbow: 'from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400',
      },
      size: {
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl',
        '4xl': 'text-4xl',
      },
      animated: {
        true: 'animate-gradient bg-[length:200%_auto]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'base',
      animated: false,
    },
  }
);

export interface GradientTextProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof gradientTextVariants> {
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
}

const GradientText = React.forwardRef<HTMLElement, GradientTextProps>(
  ({ className, variant, size, animated, as: Component = 'span', children, ...props }, ref) => {
    return (
      <Component
        ref={ref as any}
        className={cn(gradientTextVariants({ variant, size, animated }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
GradientText.displayName = 'GradientText';

export { GradientText, gradientTextVariants };