import { cn } from '~/core/generic/shadcn-utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/50',
        className,
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card p-6">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="h-9 w-16" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
