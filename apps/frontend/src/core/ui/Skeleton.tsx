import { cn as classNames } from '~/core/generic/shadcn-utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * @name Skeleton
 * @description Simple skeleton loading component
 *
 * Usage:
 * ```tsx
 * <Skeleton className="h-4 w-20" />
 * <Skeleton className="h-40 w-full" />
 * ```
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={classNames(
        'animate-pulse rounded-md bg-muted/70',
        className,
      )}
      {...props}
    />
  );
}

export default Skeleton;
