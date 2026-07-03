'use client';

import { cn } from '~/core/generic/shadcn-utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/50',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
