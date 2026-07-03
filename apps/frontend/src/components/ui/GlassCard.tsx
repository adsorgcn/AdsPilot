import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/core/generic/shadcn-utils';

const glassCardVariants = cva(
  'relative overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-white/80 dark:bg-slate-900/80 border-white/20 dark:border-slate-700/30 shadow-lg hover:shadow-xl',
        gradient: 'bg-gradient-to-br from-white/90 to-white/70 dark:from-slate-900/90 dark:to-slate-800/70 border-white/20 dark:border-slate-700/30 shadow-lg hover:shadow-xl',
        primary: 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10 border-blue-300/30 dark:border-blue-700/30 shadow-lg hover:shadow-xl',
        success: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10 border-green-300/30 dark:border-green-700/30 shadow-lg hover:shadow-xl',
        warning: 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20 dark:from-orange-500/10 dark:to-yellow-500/10 border-orange-300/30 dark:border-orange-700/30 shadow-lg hover:shadow-xl',
        error: 'bg-gradient-to-br from-red-500/20 to-pink-500/20 dark:from-red-500/10 dark:to-pink-500/10 border-red-300/30 dark:border-red-700/30 shadow-lg hover:shadow-xl',
      },
      hover: {
        true: 'hover:scale-[1.02] hover:border-white/40 dark:hover:border-slate-600/40 cursor-pointer',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      hover: false,
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  children: React.ReactNode;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, hover, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(glassCardVariants({ variant, hover }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = 'GlassCard';

const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
GlassCardHeader.displayName = 'GlassCardHeader';

const GlassCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
GlassCardTitle.displayName = 'GlassCardTitle';

const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
GlassCardDescription.displayName = 'GlassCardDescription';

const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
GlassCardContent.displayName = 'GlassCardContent';

const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
GlassCardFooter.displayName = 'GlassCardFooter';

export {
  GlassCard,
  GlassCardHeader,
  GlassCardFooter,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
};