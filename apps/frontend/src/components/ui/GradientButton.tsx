import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/core/generic/shadcn-utils';

const gradientButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 focus-visible:ring-blue-500',
        success:
          'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105 focus-visible:ring-green-500',
        warning:
          'bg-gradient-to-r from-orange-600 to-yellow-600 text-white shadow-lg hover:shadow-xl hover:scale-105 focus-visible:ring-orange-500',
        error:
          'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg hover:shadow-xl hover:scale-105 focus-visible:ring-red-500',
        outline:
          'border-2 border-gradient-to-r from-blue-600 to-purple-600 bg-transparent text-blue-600 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 hover:text-white hover:scale-105',
        ghost:
          'bg-transparent hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 text-blue-600',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-10 px-6 text-base',
        lg: 'h-12 px-8 text-lg',
        xl: 'h-14 px-10 text-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  loading?: boolean;
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(gradientButtonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
GradientButton.displayName = 'GradientButton';

export { GradientButton, gradientButtonVariants };